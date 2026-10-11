// "Eyes and brain" lesson for the reading trainer. Animated demos of what reading looks like from
// inside: the eye stops (fixations) and jumps (saccades), only a few letters are sharp at each stop,
// and the brain's predictions decide how long each stop lasts. Based on eye-tracking research
// (Rayner and colleagues); the numbers below are typical values for skilled English readers.
// planFixations and zoneFor are pure and exported in Node for tests.
(() => {
  "use strict";

  const SHARP = 3;          // letters each side of the fixation that are seen clearly (about 7 in all)
  const PREVIEW_LEFT = 4;   // rough preview: a few letters to the left…
  const PREVIEW_RIGHT = 14; // …and up to about 15 to the right, in reading direction
  const FIXATION_MS = 250;  // a typical stop

  const DEMO_TEXT = "The best readers let their eyes jump forward in steady hops, landing near the middle of each long word and skipping many of the little ones like a, of and the.";

  // What the eye sees of a letter `distance` characters from where it is looking.
  function zoneFor(distance) {
    if (distance === 0) return "fix";
    if (Math.abs(distance) <= SHARP) return "sharp";
    if (distance >= -PREVIEW_LEFT && distance <= PREVIEW_RIGHT) return "preview";
    return "hidden";
  }

  // Where a reader's eye stops in `text`. A skilled reader lands just left of the middle of each word
  // and skips short words already seen in the preview. With `regressions`, every third word also sends
  // the eye back to the word before, the habit that costs slow readers the most time.
  function planFixations(text, { regressions = false } = {}) {
    const words = [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, letters: m[0].replace(/[^A-Za-z]/g, "").length }));
    const fixations = [];
    let last = -Infinity;
    let backs = 0;
    words.forEach((word, k) => {
      const target = word.start + Math.floor(word.letters * 0.4);
      if (!regressions && word.letters <= 3 && target - last < 10) return;
      fixations.push(target);
      last = target;
      if (regressions && k % 3 === 2) {
        fixations.push(words[k - 1].start + 1, target);
        backs++;
      }
    });
    return { fixations, backs };
  }

  const api = { DEMO_TEXT, FIXATION_MS, zoneFor, planFixations };
  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const PREDICT = [
    { stem: "It started to rain, so she opened her", options: ["umbrella", "fridge", "homework"], answer: 0 },
    { stem: "He was so thirsty that he drank a whole glass of", options: ["sand", "water", "music"], answer: 1 },
    { stem: "The bees flew home to their", options: ["garage", "office", "hive"], answer: 2 },
  ];

  const LOOP = [
    { title: "Look", text: "The eye stops for about a quarter of a second. Only about 7 letters are sharp." },
    { title: "Preview", text: "Letters to the right are blurry but show the next word's length and first letters." },
    { title: "Predict", text: "The brain guesses what comes next. Words it expected get a short stop, or none." },
    { title: "Jump", text: "The eye leaps about 7–9 letters forward. You are blind during the jump." },
  ];

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }
  // Timers end themselves when the lesson is replaced or its screen is closed, so no one has to
  // remember to stop them. (The root itself stays on the page: the trainer reuses it for every view.)
  function every(ms, fn, root) {
    const id = setInterval(() => {
      if (!root.querySelector("#rl-line") || !root.closest(".screen")?.classList.contains("active")) { clearInterval(id); return; }
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function render(root) {
    clearTimers();
    const chars = [...DEMO_TEXT].map((c, i) => `<span data-c="${i}">${escapeHtml(c)}</span>`).join("");
    root.innerHTML = `
      <p class="feature-eyebrow">Lesson · Eyes and brain</p>
      <h3 class="rd-title">How your eyes and brain read together</h3>
      <p class="feature-intro">Your eyes are rarely what slows you down. Your brain's understanding is. Fast readers are not seeing more; they waste fewer stops and let their brain predict more.</p>

      <section class="feature-card rl-section">
        <h3>1. Your eyes hop, they do not glide</h3>
        <p>Watch the eye move through the sentence. Letters you could not make out at that moment are shown as x.</p>
        <div class="rl-line" id="rl-line" aria-hidden="true"><span class="rl-eye" id="rl-eye"><span></span></span>${chars}</div>
        <p class="sr-only">Animated demo: the eye stops on a word, sees about seven letters sharply, previews more to the right, then jumps forward.</p>
        <div class="rl-legend"><span><i class="rl-sw sharp"></i>Sharp</span><span><i class="rl-sw preview"></i>Rough preview</span><span><i class="rl-sw hidden"></i>Not readable</span></div>
        <div class="rl-buttons">
          <button class="btn btn-primary" data-demo="skilled" type="button">▶ Skilled reader</button>
          <button class="btn btn-ghost" data-demo="regress" type="button">▶ Reader who goes back</button>
        </div>
        <div class="rd-stats rl-stats">
          <div><strong id="rl-stops">0</strong><span>stops</span></div>
          <div><strong id="rl-backs">0</strong><span>jumps back</span></div>
          <div><strong id="rl-time">0.0s</strong><span>time</span></div>
        </div>
        <p class="settings-note" id="rl-verdict" role="status">Try both and compare the time.</p>
      </section>

      <section class="feature-card rl-section">
        <h3>2. The eye–brain loop</h3>
        <p>This loop repeats about four times a second while you read.</p>
        <ol class="rl-loop" id="rl-loop">${LOOP.map((s, i) => `<li data-step="${i}"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.text)}</span></li>`).join("")}</ol>
      </section>

      <section class="feature-card rl-section">
        <h3>3. Feel your brain predict</h3>
        <p>Pick the word that comes next. Notice how fast you know it.</p>
        <div id="rl-predict">${PREDICT.map((p, i) => `<div class="rl-predict" data-item="${i}">
          <p>${escapeHtml(p.stem)} <span class="rl-blank">____</span></p>
          <div class="rl-choices">${p.options.map((o, oi) => `<button class="btn btn-ghost" type="button" data-predict="${i}:${oi}">${escapeHtml(o)}</button>`).join("")}</div>
        </div>`).join("")}</div>
        <p class="settings-note" id="rl-predict-note" role="status"></p>
      </section>

      <section class="feature-card rl-section">
        <h3>4. Train both halves</h3>
        <p><strong>Eyes: waste fewer stops</strong></p>
        <ul class="rd-steps">
          <li>Do not go back. If something is unclear, finish the sentence first; the next words usually explain it.</li>
          <li>Let small words go. Your preview already caught "the" and "of".</li>
          <li>Off the app, run a finger or pen under the line a little faster than is comfortable.</li>
        </ul>
        <button class="btn btn-ghost" type="button" data-level="2">Practise: Guide your eyes →</button>
        <p><strong>Brain: help it predict</strong></p>
        <ul class="rd-steps">
          <li>Preview first: title, headings and the first sentence of each paragraph.</li>
          <li>Ask a question before you start, so your brain knows what to look for.</li>
          <li>Read in phrases, and keep your inner voice: let it say phrases, not single words.</li>
          <li>Picture what you read, and after each paragraph say its point in about five words.</li>
        </ul>
        <button class="btn btn-ghost" type="button" data-level="4">Practise: Preview, then read →</button>
      </section>

      <details class="feature-card rl-section">
        <summary><strong>What does not work</strong></summary>
        <ul class="rd-steps">
          <li>Eye exercises to "widen your vision". The sharp zone is about 7 letters for everyone and does not grow.</li>
          <li>Reading a whole line or page "at a glance". That is skimming, and understanding drops.</li>
          <li>Switching off your inner voice completely. It helps you understand anything complex.</li>
        </ul>
        <p class="settings-note">The biggest long-term boost is vocabulary and background knowledge: every word you know instantly is a shorter stop, and every topic you know is a better prediction.</p>
      </details>

      <button class="btn btn-primary btn-big" type="button" data-action="home">Back to levels</button>
    `;
    setupDemo(root);
    setupLoop(root);
    setupPredict(root);
  }

  function setupDemo(root) {
    const line = root.querySelector("#rl-line");
    const eye = root.querySelector("#rl-eye");
    const spans = [...line.querySelectorAll("[data-c]")];
    const out = (id, text) => { root.querySelector(id).textContent = text; };
    let demoTimer = null;

    function show(fix) {
      spans.forEach((span, i) => {
        const zone = zoneFor(i - fix);
        span.className = `rl-${zone}`;
        const c = DEMO_TEXT[i];
        span.textContent = zone === "hidden" && /[A-Za-z]/.test(c) ? "x" : c;
      });
      const target = spans[fix];
      // offsetTop is the top of the letters, not of the line: lift the marker (dot + pointer, 13px) above it.
      eye.style.transform = `translate(${target.offsetLeft + target.offsetWidth / 2}px, ${target.offsetTop - 14}px)`;
      if (!reducedMotion()) {
        eye.classList.remove("hop");
        void eye.offsetWidth; // restart the hop animation
        eye.classList.add("hop");
      }
    }

    function play(regressions) {
      if (demoTimer) clearInterval(demoTimer);
      const { fixations } = planFixations(DEMO_TEXT, { regressions });
      let i = 0;
      let backs = 0;
      out("#rl-verdict", "Watching…");
      const step = () => {
        if (i >= fixations.length) {
          clearInterval(demoTimer);
          demoTimer = null;
          const seconds = (fixations.length * FIXATION_MS / 1000).toFixed(1);
          out("#rl-verdict", regressions
            ? `${fixations.length} stops, ${backs} of them going back over words already seen: ${seconds}s for one sentence.`
            : `${fixations.length} stops in ${seconds}s. Short words were skipped because the preview had already caught them.`);
          return;
        }
        if (i > 0 && fixations[i] < fixations[i - 1]) backs++;
        show(fixations[i]);
        out("#rl-stops", String(i + 1));
        out("#rl-backs", String(backs));
        out("#rl-time", `${((i + 1) * FIXATION_MS / 1000).toFixed(1)}s`);
        i++;
      };
      step();
      demoTimer = every(FIXATION_MS, step, root);
    }

    root.querySelectorAll("[data-demo]").forEach((button) => {
      button.addEventListener("click", () => play(button.dataset.demo === "regress"));
    });
    show(planFixations(DEMO_TEXT).fixations[0]);
  }

  function setupLoop(root) {
    const steps = [...root.querySelectorAll("#rl-loop li")];
    let active = 0;
    const paint = () => steps.forEach((li, i) => li.classList.toggle("active", i === active));
    paint();
    every(1600, () => { active = (active + 1) % steps.length; paint(); }, root);
  }

  function setupPredict(root) {
    let answered = 0;
    let missed = 0;
    root.querySelector("#rl-predict").addEventListener("click", (event) => {
      const button = event.target.closest("[data-predict]");
      if (!button) return;
      const [i, oi] = button.dataset.predict.split(":").map(Number);
      const item = PREDICT[i];
      const box = root.querySelector(`[data-item="${i}"]`);
      if (box.classList.contains("done")) return;
      box.classList.add("done");
      box.querySelector(".rl-blank").textContent = item.options[item.answer];
      box.querySelectorAll("[data-predict]").forEach((b, bi) => b.classList.toggle("rl-right", bi === item.answer));
      if (oi !== item.answer) { button.classList.add("rl-wrong"); missed++; }
      answered++;
      if (answered === PREDICT.length) {
        root.querySelector("#rl-predict-note").textContent = (missed ? "Most of the time you knew the word before you saw it, and when you guessed wrong, the sentence still made you expect something. " : "You knew each word before you saw it. ") + "That is prediction: a word your brain expects needs only a quick glance, or none at all. Previewing a text gives your brain more to predict with.";
      }
    });
  }

  window.SpellReadingLesson = { render, stop: clearTimers, ...api };
})();
