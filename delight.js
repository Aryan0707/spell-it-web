/* ============================================================
   SpellDelight — the "feel good" layer.
   Confetti, streak flare, XP pops, combo callouts, count-ups.
   Non-invasive: safe to no-op if the DOM isn't ready.
   ============================================================ */
(function () {
  "use strict";

  // ---------- Combo callout tiers ----------
  // TODO(user): shape the app's personality here.
  // Each tier fires at exactly the streak listed. Pick words that
  // sound like YOU cheering — playful, calm, hype, whatever. Keep them short
  // (1-2 words) so they read at a glance. See README of this block for ideas.
  //
  // Tradeoffs:
  //   - Too many tiers → callouts feel spammy.
  //   - Callouts starting too early (< 3) → they lose meaning.
  //   - Same word repeated → users stop noticing (variable rewards matter).
  const COMBO_TIERS = [
    // { at: 3,  text: "Nice!",       emoji: "✨" },
    // { at: 5,  text: "On fire!",    emoji: "🔥" },
    // { at: 8,  text: "Rolling!",    emoji: "🚀" },
    // { at: 12, text: "Unreal!",     emoji: "⚡" },
    // { at: 20, text: "Legendary!",  emoji: "👑" },
  ];

  // Fallback tiers so the app still feels alive if the user hasn't
  // customised COMBO_TIERS yet. Remove this once yours is filled in.
  const DEFAULT_TIERS = [
    { at: 3,  text: "3 in a row",  emoji: "" },
    { at: 5,  text: "5 in a row",  emoji: "" },
    { at: 8,  text: "8 in a row",  emoji: "" },
    { at: 12, text: "12 in a row", emoji: "" },
    { at: 20, text: "20 in a row", emoji: "" },
  ];

  function activeTiers() {
    return COMBO_TIERS.length ? COMBO_TIERS : DEFAULT_TIERS;
  }

  // ---------- confetti ----------
  let canvas, ctx, particles = [], rafId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "delight-canvas";
    canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;";
    document.body.appendChild(canvas);
    resize();
    window.addEventListener("resize", resize);
    ctx = canvas.getContext("2d");
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const CONFETTI_COLORS = [
    "#4FD1B4", "#7DE6CE", "#3FBFA3", "#E6EDF3",
  ];

  function burstAt(x, y, count) {
    ensureCanvas();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        g: 0.22 + Math.random() * 0.08,
        life: 60 + Math.random() * 30,
        age: 0,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        shape: Math.random() < 0.5 ? "rect" : "circle",
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    if (!ctx) { rafId = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age++;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (p.age >= p.life || p.y > window.innerHeight + 40) particles.splice(i, 1);
    }
    if (particles.length) rafId = requestAnimationFrame(tick);
    else { rafId = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // ---------- flying XP number ----------
  function flyXP(text, fromEl, toEl) {
    if (!fromEl || !toEl) return;
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const node = document.createElement("div");
    node.className = "delight-xp";
    node.textContent = text;
    node.style.left = (from.left + from.width / 2) + "px";
    node.style.top = (from.top + from.height / 2) + "px";
    document.body.appendChild(node);
    // force layout, then animate to the streak pill
    requestAnimationFrame(() => {
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      node.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.6)`;
      node.style.opacity = "0";
    });
    setTimeout(() => node.remove(), 900);
  }

  // ---------- combo callout ----------
  function comboFor(streak) {
    const tiers = activeTiers();
    return tiers.find(t => t.at === streak) || null;
  }

  function showCombo(tier) {
    if (!tier) return;
    const node = document.createElement("div");
    node.className = "delight-combo";
    node.innerHTML = `${tier.emoji ? `<span class="delight-combo-emoji">${tier.emoji}</span>` : ""}<span class="delight-combo-text">${tier.text}</span>`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1400);
  }

  // ---------- streak pill flare ----------
  function flareStreakPill(streak) {
    const pill = document.querySelector(".streak-pill");
    if (!pill) return;
    // color escalation
    let cls = "";
    if (streak >= 20) cls = "s-max";
    else if (streak >= 10) cls = "s-hot";
    else if (streak >= 5) cls = "s-warm";
    else if (streak >= 3) cls = "s-lit";
    pill.classList.remove("s-lit", "s-warm", "s-hot", "s-max");
    if (cls) pill.classList.add(cls);
    pill.classList.remove("bounce");
    // reflow to restart animation
    void pill.offsetWidth;
    pill.classList.add("bounce");
  }

  // ---------- progress glow ----------
  function pulseProgress() {
    const fill = document.getElementById("progress-fill");
    if (!fill) return;
    fill.classList.remove("glow");
    void fill.offsetWidth;
    fill.classList.add("glow");
  }

  // ---------- wrong flash ----------
  function wrongFlash() {
    let flash = document.getElementById("delight-wrong-flash");
    if (!flash) {
      flash = document.createElement("div");
      flash.id = "delight-wrong-flash";
      document.body.appendChild(flash);
    }
    flash.classList.remove("show");
    void flash.offsetWidth;
    flash.classList.add("show");
  }

  // ---------- count-up ----------
  function countUp(el, target, duration = 900) {
    if (!el) return;
    const start = 0;
    const end = Number(target) || 0;
    if (end === start) { el.textContent = String(end); return; }
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(start + (end - start) * eased);
      el.textContent = String(val);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = String(end);
    }
    requestAnimationFrame(step);
  }

  function countUpHomeStats() {
    const ids = ["stat-best", "stat-correct", "stat-due"];
    for (const id of ids) {
      const node = document.getElementById(id);
      if (!node) continue;
      const target = Number(node.textContent) || 0;
      if (target > 0) countUp(node, target, 900);
    }
  }

  // ---------- public API ----------
  function correct({ streak = 0, fromEl = null } = {}) {
    // A correct answer is acknowledged by the green slots and the streak count, not by fireworks.
    flareStreakPill(streak);
    pulseProgress();

    // Combo callout on milestone streaks.
    const tier = comboFor(streak);
    if (tier) showCombo(tier);
  }

  function wrong() {
    wrongFlash();
    // reset streak pill flare
    const pill = document.querySelector(".streak-pill");
    if (pill) pill.classList.remove("s-lit", "s-warm", "s-hot", "s-max", "bounce");
  }

  window.SpellDelight = {
    correct,
    wrong,
    countUpHomeStats,
    _burstAt: burstAt, // exposed for future tile-placement sparkles
  };

  // ---------- home v2 polish ----------
  function setGreeting() {
    const el = document.getElementById("hero-greeting");
    const title = document.getElementById("hero-title");
    if (!el) return;
    const h = new Date().getHours();
    let g = "Welcome back";
    if (h < 5) g = "Working late";
    else if (h < 12) g = "Good morning";
    else if (h < 17) g = "Good afternoon";
    else if (h < 22) g = "Good evening";
    else g = "Good evening";
    el.textContent = g;

    // Rotate the hero title so it doesn't feel static.
    if (title) {
      const streak = Number(document.getElementById("stat-best")?.textContent) || 0;
      const due = Number(document.getElementById("stat-due")?.textContent) || 0;
      const lines = [];
      if (streak >= 3) lines.push(`Day ${streak} of your streak.`);
      if (due > 0) lines.push(`${due} word${due === 1 ? "" : "s"} to revisit.`);
      lines.push("Ready when you are.");
      lines.push("A little practice adds up.");
      lines.push("Two minutes is enough.");
      // Pick one deterministically per hour so it doesn't flicker.
      const bucket = Math.floor(Date.now() / 3600000);
      title.textContent = lines[bucket % lines.length];
    }
  }

  // Ring progress: fill based on mastered % of a rolling target.
  function updateHeroRing() {
    const fg = document.getElementById("hero-ring-fg");
    if (!fg) return;
    const mastered = Number(document.getElementById("stat-correct")?.textContent) || 0;
    // Grows the target as they master more — always feels almost-there.
    const target = Math.max(20, Math.ceil((mastered + 5) / 10) * 10);
    const pct = Math.min(1, mastered / target);
    const circumference = 2 * Math.PI * 42;
    fg.style.strokeDasharray = String(circumference);
    fg.style.strokeDashoffset = String(circumference * (1 - pct));
  }

  // Word of the Day — pulled from the word bank, seeded by the date so it's
  // stable through the day but changes at midnight local.
  function pickWordOfDay() {
    // WORD_LIST is a script-scope global from words.js (classic script).
    const bank = (typeof WORD_LIST !== "undefined" && Array.isArray(WORD_LIST)) ? WORD_LIST : null;
    if (!bank || !bank.length) return null;
    // Prefer medium/hard/expert words for interest; fall back to whole bank.
    const interesting = bank.filter(w => w && ["medium", "hard", "expert"].includes(w.difficulty)) ;
    const pool = interesting.length ? interesting : bank;
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return pool[seed % pool.length];
  }

  function renderWOTD() {
    const wEl = document.getElementById("wotd-word");
    const hEl = document.getElementById("wotd-hint");
    if (!wEl || !hEl) return;
    const entry = pickWordOfDay();
    if (!entry) {
      wEl.textContent = "…";
      hEl.textContent = "Words will appear here soon.";
      return;
    }
    wEl.textContent = entry.word;
    hEl.textContent = entry.definition || entry.hint || entry.tip || "Tap Learn to add this to your session.";

    // Wire buttons
    const hear = document.getElementById("btn-wotd-hear");
    const learn = document.getElementById("btn-wotd-learn");
    if (hear && !hear._wired) {
      hear._wired = true;
      hear.addEventListener("click", () => {
        // SpellSpeech picks ElevenLabs when it is configured and falls back to the device voice.
        // Calling SpellTTS directly rejected whenever no ElevenLabs key was set, so nothing was heard.
        if (window.SpellSpeech) {
          window.SpellSpeech.speak(entry.word);
        } else if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance(entry.word);
          window.speechSynthesis.speak(u);
        }
      });
    }
    if (learn && !learn._wired) {
      learn._wired = true;
      learn.addEventListener("click", () => {
        // Trigger the main start button — a full session, WOTD as first hint.
        const start = document.getElementById("btn-start");
        if (start) start.click();
      });
    }
  }

  function wireHeaderProgress() {
    const btn = document.getElementById("btn-header-progress");
    const target = document.getElementById("btn-history");
    if (!btn || !target || btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", () => target.click());
  }

  function refreshHome() {
    setGreeting();
    updateHeroRing();
    renderWOTD();
    wireHeaderProgress();
  }

  // Animate home stats + refresh the extras whenever home becomes visible.
  document.addEventListener("DOMContentLoaded", () => {
    const home = document.getElementById("screen-home");
    if (!home) return;
    const onActive = () => { countUpHomeStats(); refreshHome(); };
    if (home.classList.contains("active")) onActive();
    const obs = new MutationObserver(() => {
      if (home.classList.contains("active")) onActive();
    });
    obs.observe(home, { attributes: true, attributeFilter: ["class"] });
    // Also refresh when data changes (streak/mastered ticks up mid-session)
    window.addEventListener("spellit-change", () => {
      if (home.classList.contains("active")) { updateHeroRing(); }
    });
  });
})();
