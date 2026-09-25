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

  let currentAudio = null;
  let playbackId = 0;
  let settlePlayback = null;

  function stop() {
    playbackId += 1;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (settlePlayback) {
      settlePlayback();
      settlePlayback = null;
    }
  }

  async function speak(text) {
    stop();
    const requestId = playbackId;
    const url = await fetchAudioUrl(text);
    if (requestId !== playbackId) return;
    const audio = new Audio(url);
    currentAudio = audio;
    await new Promise((resolve, reject) => {
      settlePlayback = resolve;
      audio.onended = resolve;
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.play().catch(reject);
    });
    if (requestId === playbackId) {
      currentAudio = null;
      settlePlayback = null;
    }
  }

  window.SpellTTS = {
    loadConfig,
    saveConfig,
    isEnabled,
    listVoices,
    speak,
    stop,
    DEFAULT_VOICE_ID,
    DEFAULT_VOICE_NAME,
  };
})();
