// Sound effects (synthesized, no audio files) and haptic feedback.
(() => {
  "use strict";

  const SOUND_KEY = "spellit_sound_enabled";
  const HAPTIC_KEY = "spellit_haptic_enabled";

  function isSoundEnabled() {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === "true";
  }
  function isHapticEnabled() {
    const v = localStorage.getItem(HAPTIC_KEY);
    return v === null ? true : v === "true";
  }
  function setSoundEnabled(v) {
    localStorage.setItem(SOUND_KEY, String(v));
  }
  function setHapticEnabled(v) {
    localStorage.setItem(HAPTIC_KEY, String(v));
  }

  let audioCtx = null;
  function getCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  // Call once from a real user gesture (e.g. Start Practice tap) to unlock audio on iOS/Safari.
  function unlock() {
    getCtx();
  }

  function tone(ctx, freq, startTime, duration, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playCorrect() {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(ctx, 587.33, now, 0.14, "sine", 0.15); // D5
    tone(ctx, 880, now + 0.09, 0.22, "sine", 0.15); // A5
  }

  function playWrong() {
    if (!isSoundEnabled()) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(ctx, 185, now, 0.22, "triangle", 0.13);
    tone(ctx, 164.81, now + 0.1, 0.26, "triangle", 0.12);
  }

  function vibrateCorrect() {
    if (!isHapticEnabled() || !("vibrate" in navigator)) return;
    navigator.vibrate(12);
  }
  function vibrateWrong() {
    if (!isHapticEnabled() || !("vibrate" in navigator)) return;
    navigator.vibrate([25, 45, 25]);
  }

  window.SpellSFX = {
    isSoundEnabled,
    isHapticEnabled,
    setSoundEnabled,
    setHapticEnabled,
    unlock,
    playCorrect,
    playWrong,
    vibrateCorrect,
    vibrateWrong,
  };
})();
