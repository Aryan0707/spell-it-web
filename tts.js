// ElevenLabs text-to-speech, called directly from the browser with a key
// the user pastes in Settings (stored only in this browser's localStorage).
(() => {
  "use strict";

  const CONFIG_KEY = "spellit_tts_config";
  const API_BASE = "https://api.elevenlabs.io/v1";
  const DEFAULT_MODEL = "eleven_turbo_v2_5";
  const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — ElevenLabs' standard default voice
  const DEFAULT_VOICE_NAME = "Rachel";

  const audioCache = new Map(); // `${voiceId}::${text}` -> blob URL
  const CACHE_LIMIT = 60;

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { apiKey: "", voiceId: DEFAULT_VOICE_ID, voiceName: DEFAULT_VOICE_NAME, useElevenLabs: false };
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function isEnabled() {
    const cfg = loadConfig();
    return !!(cfg.useElevenLabs && cfg.apiKey && cfg.apiKey.trim());
  }

  async function listVoices() {
    const cfg = loadConfig();
    if (!cfg.apiKey) throw new Error("No ElevenLabs API key configured");

    const res = await fetch(`${API_BASE}/voices`, {
      headers: { "xi-api-key": cfg.apiKey.trim() },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ElevenLabs error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    return (json.voices || []).map((v) => ({ id: v.voice_id, name: v.name }));
  }

  function cacheKey(voiceId, text) {
    return `${voiceId}::${text.toLowerCase()}`;
  }

  async function fetchAudioUrl(text) {
    const cfg = loadConfig();
    if (!cfg.apiKey) throw new Error("No ElevenLabs API key configured");
    const voiceId = cfg.voiceId || DEFAULT_VOICE_ID;

    const key = cacheKey(voiceId, text);
    if (audioCache.has(key)) return audioCache.get(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": cfg.apiKey.trim(),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: DEFAULT_MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`ElevenLabs error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    if (audioCache.size >= CACHE_LIMIT) {
      const oldestKey = audioCache.keys().next().value;
      URL.revokeObjectURL(audioCache.get(oldestKey));
      audioCache.delete(oldestKey);
    }
    audioCache.set(key, url);
    return url;
  }

  // One <audio> element is reused for every word. iOS Safari and Chrome only let an element play
  // if it was first started by a tap, and a fresh `new Audio(url)` created after the network
  // fetch has lost that tap. unlock() plays a silent clip on the first gesture so later words can play.
  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  let audio = null;
  let unlocked = false;
  let playbackId = 0;
  let settlePlayback = null;
  let lastError = "";

  function getAudio() {
    if (!audio) audio = new Audio();
    return audio;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      const el = getAudio();
      el.src = SILENT_WAV;
      el.play().catch(() => { unlocked = false; });
    } catch (e) { unlocked = false; }
  }

  function stop() {
    playbackId += 1;
    if (audio) audio.pause();
    if (settlePlayback) {
      settlePlayback();
      settlePlayback = null;
    }
  }

  async function play(url, requestId) {
    const el = getAudio();
    el.src = url;
    await new Promise((resolve, reject) => {
      settlePlayback = resolve;
      el.onended = resolve;
      el.onerror = () => reject(new Error("Audio playback failed"));
      el.play().catch(reject);
    });
    if (requestId === playbackId) settlePlayback = null;
  }

  // Plays any audio URL (used by the offline natural voice) through the same unlocked element.
  function playUrl(url) {
    stop();
    return play(url, playbackId);
  }

  async function speak(text) {
    stop();
    const requestId = playbackId;
    try {
      const url = await fetchAudioUrl(text);
      if (requestId !== playbackId) return;
      await play(url, requestId);
      lastError = "";
    } catch (err) {
      // Remembered so Settings can say why the app fell back to the device voice.
      if (requestId === playbackId) lastError = err.message || String(err);
      throw err;
    }
  }

  window.SpellTTS = {
    loadConfig,
    saveConfig,
    isEnabled,
    listVoices,
    speak,
    playUrl,
    stop,
    unlock,
    get lastError() { return lastError; },
    DEFAULT_VOICE_ID,
    DEFAULT_VOICE_NAME,
  };
})();
