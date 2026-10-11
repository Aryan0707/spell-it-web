// "Eyes and brain" lesson for the reading trainer. Animated demos of what reading looks like from
// inside, driven by a simple model of eye movements built from eye-tracking research (Rayner 1998, 2009;
// Rayner et al. 2016; Ehrlich & Rayner 1981 on predictability; Parker et al. 2019 on return sweeps).
// Typical values for skilled adult readers of English:
//   - fixations average 200–250 ms and range from about 150 to over 400: longer for long, rare or
//     unexpected words, shorter for common and predictable ones;
//   - jumps (saccades) cover about 7–9 letters and last 20–40 ms; vision is suppressed during them;
//   - sharp vision covers about 7 letters; a word can be fully recognised up to about 7–8 letters to the
//     right; a rougher preview (length, first letters) reaches about 14–15 letters right and 3–4 left;
//   - short and predictable words are often skipped; words of 10 or more letters often get two stops;
//   - about 10–15% of jumps go backwards, mostly at hard words;
//   - the long jump back to the next line often lands a few letters too far right, followed by a short
//     correcting jump to the left.
// The model is deliberately simple and deterministic: it shows these effects, it does not predict any one
// person's eyes. planReading, zoneFor and fixationMs are pure and exported in Node for tests.
(() => {
  "use strict";

  const SHARP = 3;          // letters each side of the fixation that are seen clearly (about 7 in all)
  const RECOGNISE = 7;      // a word ending within this many letters to the right can be recognised whole
  const PREVIEW_LEFT = 4;   // rough preview: a few letters to the left…
  const PREVIEW_RIGHT = 14; // …and up to about 15 to the right, in reading direction
  const FIXATION_MS = 230;  // a typical stop, for text that talks about "a quarter of a second"

  const DEMO_TEXT = "The best readers let their eyes jump forward in steady hops, landing near the middle of each long word and skipping many of the little ones like a, of and the.";
  const RACE_TEXT = "Scientists recently discovered that octopuses can solve surprisingly complicated puzzles in the laboratory.";
  const CONTEXT = {
    natural: "It started to rain, so she opened her umbrella and walked home.",
    // Word positions (0-based) a reader can guess from the words before them.
    predictable: [2, 3, 7, 8, 11],
    scrambled: "Umbrella her walked so rain home to opened and she it started.",
  };

  // The most common English words. Common words are recognised faster than rare ones (the word
  // frequency effect); this short list is enough to show it.
  const COMMON = new Set(("the of and a to in is you that it he was for on are as with his they i at be this have from or one had by " +
    "but not what all were we when your can said there use an each which she do how their if will up other about out many then " +
    "them these so some her would make like him into time has look two more go see no way could people my than first been call " +
    "who its now find long down day did get come made may part over new after also just where most know very little ones best " +
    "eyes let jump word words home rain read readers started opened walked near middle each long hops steady forward landing").split(" "));

  // Profiles. "skilled": an experienced adult reader. "developing": a reader still building fluency, who
  // looks at nearly every word, stops longer and goes back more often.
  const PROFILES = {
    // Skilled readers give a second stop only to the longest words and rarely go back.
    skilled: { skipLetters: 3, refixAt: 12, regressAt: 12, slow: 1 },
    developing: { skipLetters: 0, refixAt: 7, regressAt: 7, slow: 1.35 },
  };

  const lettersOf = (word) => word.replace(/[^A-Za-z]/g, "");

  // How long the eye stays on a word: longer words and rarer words take longer, predictable ones less.
  function fixationMs(word, { predictable = false, slow = 1 } = {}) {
    const letters = lettersOf(word);
    let ms = 175 + 9 * letters.length;
    if (!COMMON.has(letters.toLowerCase())) ms += 45;
    if (predictable) ms -= 35;
    return Math.round(Math.min(600, Math.max(150, ms * slow)));
  }

  // Duration of a jump of `chars` letters: about 20 ms plus a little per letter (roughly 2–3 ms per degree).
  const saccadeMs = (chars) => Math.round(20 + Math.min(40, Math.abs(chars) * 0.7));

  // What the eye sees of a letter `distance` characters from where it is looking.
  function zoneFor(distance) {
    if (distance === 0) return "fix";
    if (Math.abs(distance) <= SHARP) return "sharp";
    if (distance > SHARP && distance <= RECOGNISE) return "recognise";
    if (distance >= -PREVIEW_LEFT && distance <= PREVIEW_RIGHT) return "preview";
    return "hidden";
  }

  // Where the eye stops while reading `text`, and for how long.
  //   profile: "skilled" or "developing"
  //   predictable: positions of words the reader can guess from what came before
  //   lineStarts: character positions where each visual line starts (from the page layout), so the long
  //     jump to the next line can be modelled
  // Returns { fixations: [{ at, ms, word, kind }], skipped: [word positions], backs, totalMs } where kind is
  // "first" (first stop on a word), "refix" (a second stop on a long word), "regress" (a jump back),
  // "return" (landing after the jump to a new line) or "correct" (the short jump that fixes that landing).
  function planReading(text, { profile = "skilled", predictable = [], lineStarts = [] } = {}) {
    const p = PROFILES[profile] || PROFILES.skilled;
    const guessable = new Set(predictable);
    const words = [...text.matchAll(/\S+/g)].map((m, k) => {
      const letters = lettersOf(m[0]);
      const lead = m[0].search(/[A-Za-z]/);
      const start = m.index + Math.max(0, lead);
      return { k, raw: m[0], start, end: start + letters.length - 1, letters: letters.length, rare: !COMMON.has(letters.toLowerCase()) };
    }).filter((w) => w.letters > 0);
    const lineOf = (at) => { let line = 0; for (const s of lineStarts) if (at >= s) line++; return line; };

    const fixations = [];
    const skipped = [];
    let last = -Infinity;
    let pendingBack = null; // a hard word the reader will glance back at after the next stop
    let backs = 0;
    const stop = (at, ms, word, kind) => { fixations.push({ at, ms, word, kind }); last = at; };

    words.forEach((w, i) => {
      const guess = guessable.has(w.k);
      // Skip a word already recognised from the preview: short (or guessable) and ending within reach.
      const reach = RECOGNISE + (guess ? 3 : 0);
      const shortEnough = w.letters <= p.skipLetters || (guess && p.skipLetters && w.letters <= 6);
      const sameLine = !lineStarts.length || lineOf(w.start) === lineOf(Math.max(0, last));
      if (i > 0 && shortEnough && w.end - last <= reach && sameLine) { skipped.push(w.k); return; }

      const target = w.start + Math.floor(w.letters * 0.4); // just left of the middle: the best place to land
      const ms = fixationMs(w.raw, { predictable: guess, slow: p.slow });
      if (last >= 0 && lineStarts.length && lineOf(target) > lineOf(last)) {
        // Return sweep: lands a few letters too far right, then a short jump left fixes it.
        const lineStart = Math.max(...lineStarts.filter((s) => s <= target));
        const landing = Math.max(target + 3, lineStart + 6);
        stop(landing, Math.round(160 * p.slow), w.k, "return");
        stop(target, ms, w.k, "correct");
      } else {
        stop(target, ms, w.k, "first");
      }
      if (w.letters >= p.refixAt) stop(w.start + Math.floor(w.letters * 0.75), Math.round(ms * 0.6), w.k, "refix");

      if (pendingBack) {
        stop(pendingBack.start + Math.floor(pendingBack.letters * 0.4), Math.round(190 * p.slow), pendingBack.k, "regress");
        backs++;
        stop(target, Math.round(150 * p.slow), w.k, "first"); // and forward again to where reading continues
        pendingBack = null;
      }
      if (w.letters >= p.regressAt && w.rare) pendingBack = w;
    });

    const totalMs = fixations.reduce((sum, f, i) => sum + f.ms + (i ? saccadeMs(f.at - fixations[i - 1].at) : 0), 0);
    return { fixations, skipped, backs, totalMs };
  }

  // Kept for older callers: the stops only, as character positions.
  function planFixations(text, { regressions = false } = {}) {
    const plan = planReading(text, { profile: regressions ? "developing" : "skilled" });
    return { fixations: plan.fixations.map((f) => f.at), backs: plan.backs };
  }

  const api = { DEMO_TEXT, RACE_TEXT, CONTEXT, FIXATION_MS, PROFILES, zoneFor, fixationMs, saccadeMs, planReading, planFixations };
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
    { title: "Look", text: "The eye stops for 200–250 ms on average: longer on long or rare words. Only about 7 letters are sharp." },
    { title: "Preview", text: "The next word can often be recognised from up to 7–8 letters away. Further right, only its length and first letters show." },
    { title: "Predict", text: "The brain guesses what comes next. Words it expected get a shorter stop, or none at all." },
    { title: "Jump", text: "The eye leaps about 7–9 letters in 20–40 ms. You are blind during the jump." },
  ];

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

  // Everything time-based checks this before each step, so leaving the lesson stops it at once.
  let session = 0;
  let loopTimer = null;
  function clearTimers() { session++; clearInterval(loopTimer); loopTimer = null; }
  const alive = (root, id) => id === session && root.querySelector("#rl-line") && root.closest(".screen")?.classList.contains("active");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const lineHtml = (text, id) =>
    `<div class="rl-line" id="${id}" aria-hidden="true"><svg class="rl-path" aria-hidden="true"></svg><span class="rl-eye idle"><span></span></span>${[...text].map((c, i) => `<span data-c="${i}">${escapeHtml(c)}</span>`).join("")}</div>`;

  // One animated line of text with an eye. play() runs a plan from planReading and resolves with it.
  function eyeLine(root, line, text) {
    const spans = [...line.querySelectorAll("[data-c]")];
    const eye = line.querySelector(".rl-eye");
    const svg = line.querySelector(".rl-path");
    // Path points sit in the gap just above the letters, so the text underneath stays readable.
    const centre = (at) => ({ x: spans[at].offsetLeft + spans[at].offsetWidth / 2, y: spans[at].offsetTop - 7 });

    function show(at) {
      spans.forEach((span, i) => {
        const zone = zoneFor(i - at);
        span.className = `rl-${zone}`;
        span.textContent = zone === "hidden" && /[A-Za-z]/.test(text[i]) ? "x" : text[i];
      });
      const t = spans[at];
      eye.classList.remove("idle");
      eye.style.transform = `translate(${t.offsetLeft + t.offsetWidth / 2}px, ${t.offsetTop - 14}px)`;
    }

    function reset() {
      spans.forEach((span, i) => { span.className = ""; span.textContent = text[i]; });
      svg.innerHTML = "";
      eye.classList.add("idle");
      line.classList.remove("rl-jumping");
    }

    // Visual line starts, from where the browser wrapped the text at the current size.
    function lineStarts() {
      const starts = [];
      spans.forEach((span, i) => { if (i > 0 && span.offsetTop > spans[i - 1].offsetTop + 2 && /\S/.test(text[i])) starts.push(i); });
      return starts;
    }

    // The eye's path, drawn like an eye tracker's output: a dot per stop (bigger = longer), joined by the
    // jumps in order. Jumps back are dashed coral; the sweep to a new line is dotted blue.
    function drawPath(plan) {
      svg.setAttribute("viewBox", `0 0 ${line.clientWidth} ${line.clientHeight}`);
      svg.setAttribute("width", line.clientWidth);
      svg.setAttribute("height", line.clientHeight);
      const pts = plan.fixations.map((f) => ({ ...centre(f.at), f }));
      const jumps = pts.slice(1).map((p, i) => {
        const a = pts[i];
        const cls = p.f.kind === "regress" ? "back" : p.f.kind === "return" ? "sweep" : "fwd";
        return `<line class="rl-jump ${cls}" x1="${a.x}" y1="${a.y}" x2="${p.x}" y2="${p.y}"/>`;
      }).join("");
      const dots = pts.map((p, i) => {
        const r = (2 + Math.sqrt(p.f.ms) * 0.22).toFixed(1); // 150 ms → about 4.7, 400 ms → about 6.4
        return `<g class="rl-stop ${p.f.kind}" style="--i:${i}"><circle cx="${p.x}" cy="${p.y}" r="${r}"/></g>`;
      }).join("");
      svg.innerHTML = jumps + dots;
      svg.classList.toggle("animate", !reducedMotion());
    }

    async function play(options, { scale = 1, onStop } = {}) {
      const id = session;
      const stopped = () => { if (line.isConnected) reset(); return null; }; // a newer demo took over
      reset();
      const plan = planReading(text, { ...options, lineStarts: lineStarts() });
      let elapsed = 0;
      let backs = 0;
      for (let i = 0; i < plan.fixations.length; i++) {
        while (document.hidden && alive(root, id)) await sleep(250); // wait while the app is in the background
        if (!alive(root, id)) return stopped();
        const f = plan.fixations[i];
        if (i > 0) {
          const jump = saccadeMs(f.at - plan.fixations[i - 1].at);
          if (f.kind === "regress") backs++;
          line.classList.add("rl-jumping"); // blind during the jump
          eye.style.transitionDuration = reducedMotion() ? "0ms" : `${Math.round(jump * scale)}ms`;
          const t = spans[f.at];
          eye.style.transform = `translate(${t.offsetLeft + t.offsetWidth / 2}px, ${t.offsetTop - 14}px)`;
          await sleep(jump * scale);
          elapsed += jump;
          line.classList.remove("rl-jumping");
          if (!alive(root, id)) return stopped();
        }
        show(f.at);
        eye.dataset.kind = f.kind;
        onStop?.({ index: i + 1, backs, elapsed: elapsed + f.ms, fixation: f });
        await sleep(f.ms * scale);
        elapsed += f.ms;
      }
      if (!alive(root, id)) return stopped();
      reset();
      drawPath(plan);
      return plan;
    }

    return { play, reset };
  }

  function render(root) {
    clearTimers();
    root.innerHTML = `
      <p class="feature-eyebrow">Lesson · Eyes and brain</p>
      <h3 class="rd-title">How your eyes and brain read together</h3>
      <p class="feature-intro">Your eyes are rarely what slows you down. Your brain's understanding is. Fast readers are not seeing more; they waste fewer stops and let their brain predict more.</p>

      <section class="feature-card rl-section">
        <h3>1. Your eyes hop, they do not glide</h3>
        <p>Watch the eye move through the sentence. Letters you could not make out at that moment are shown as x. Afterwards, the eye's path stays above the text: each dot is a stop, and a bigger dot means a longer one.</p>
        ${lineHtml(DEMO_TEXT, "rl-line")}
        <p class="sr-only">Animated demo: the eye stops on a word, sees about seven letters sharply, can recognise a short next word, previews more to the right, then jumps forward. Short words are often skipped and long words can get two stops.</p>
        <div class="rl-legend"><span><i class="rl-sw sharp"></i>Sharp</span><span><i class="rl-sw recognise"></i>Can be recognised</span><span><i class="rl-sw preview"></i>Rough preview</span><span><i class="rl-sw hidden"></i>Not readable</span></div>
        <p class="rl-path-key"><span><i></i>Jump forward</span><span><i class="back"></i>Jump back</span><span><i class="sweep"></i>Sweep to next line</span></p>
        <div class="rl-buttons">
          <button class="btn btn-primary" data-demo="skilled" type="button">▶ Skilled reader</button>
          <button class="btn btn-ghost" data-demo="developing" type="button">▶ Developing reader</button>
        </div>
        <label class="rl-slow"><input type="checkbox" id="rl-slow"> <span>Slow motion (4×): see the blind moment during each jump</span></label>
        <div class="rd-stats rl-stats">
          <div><strong id="rl-stops">0</strong><span>stops</span></div>
          <div><strong id="rl-backs">0</strong><span>jumps back</span></div>
          <div><strong id="rl-time">0.0s</strong><span>reading time</span></div>
        </div>
        <p class="settings-note" id="rl-now" aria-live="off"></p>
        <p class="settings-note" id="rl-verdict" role="status">Try both and compare. Times are real reading times, even in slow motion.</p>
      </section>

      <section class="feature-card rl-section">
        <h3>2. Same sentence, two readers</h3>
        <p>A developing reader looks at nearly every word, stops longer, and goes back at hard words. A skilled reader skips short words and moves on. Neither is seeing more letters per stop.</p>
        <p class="rl-tag">Developing reader <span id="rl-race-dev"></span></p>
        ${lineHtml(RACE_TEXT, "rl-race-a")}
        <p class="rl-tag">Skilled reader <span id="rl-race-skill"></span></p>
        ${lineHtml(RACE_TEXT, "rl-race-b")}
        <div class="rl-buttons"><button class="btn btn-primary" data-race="1" type="button">▶ Race</button></div>
        <p class="settings-note" id="rl-race-verdict" role="status"></p>
      </section>

      <section class="feature-card rl-section">
        <h3>3. Context makes words faster</h3>
        <p>The same words, once in a sentence that makes sense and once scrambled. In context your brain can guess "rain", "umbrella" and "home" before the eye gets there, so they get shorter stops or none.</p>
        <p class="rl-tag">In context <span id="rl-ctx-a"></span></p>
        ${lineHtml(CONTEXT.natural, "rl-ctx-line-a")}
        <p class="rl-tag">Scrambled <span id="rl-ctx-b"></span></p>
        ${lineHtml(CONTEXT.scrambled, "rl-ctx-line-b")}
        <div class="rl-buttons"><button class="btn btn-primary" data-context="1" type="button">▶ Compare</button></div>
        <p class="settings-note" id="rl-ctx-verdict" role="status"></p>
      </section>

      <section class="feature-card rl-section">
        <h3>4. The eye–brain loop</h3>
        <p>This loop repeats about four times a second while you read.</p>
        <ol class="rl-loop" id="rl-loop">${LOOP.map((s, i) => `<li data-step="${i}"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.text)}</span></li>`).join("")}</ol>
      </section>

      <section class="feature-card rl-section">
        <h3>5. Feel your brain predict</h3>
        <p>Pick the word that comes next. Notice how fast you know it.</p>
        <div id="rl-predict">${PREDICT.map((p, i) => `<div class="rl-predict" data-item="${i}">
          <p>${escapeHtml(p.stem)} <span class="rl-blank">____</span></p>
          <div class="rl-choices">${p.options.map((o, oi) => `<button class="btn btn-ghost" type="button" data-predict="${i}:${oi}">${escapeHtml(o)}</button>`).join("")}</div>
        </div>`).join("")}</div>
        <p class="settings-note" id="rl-predict-note" role="status"></p>
      </section>

      <section class="feature-card rl-section">
        <h3>6. Train both halves</h3>
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

      <p class="settings-note">The demos use typical values from eye-tracking research on skilled adult readers. Real eyes vary from person to person and line to line.</p>
      <button class="btn btn-primary btn-big" type="button" data-action="home">Back to levels</button>
    `;
    setupDemo(root);
    setupRace(root);
    setupContext(root);
    setupLoop(root);
    setupPredict(root);
  }

  const scaleFor = (root) => (root.querySelector("#rl-slow")?.checked ? 4 : 1);
  const KIND_TEXT = { first: "", refix: "second stop on a long word", regress: "jump back", return: "new line: landed too far right", correct: "short jump to fix the landing" };

  function setupDemo(root) {
    const demo = eyeLine(root, root.querySelector("#rl-line"), DEMO_TEXT);
    const out = (sel, text) => { root.querySelector(sel).textContent = text; };
    root.querySelectorAll("[data-demo]").forEach((button) => button.addEventListener("click", async () => {
      session++;
      const profile = button.dataset.demo;
      out("#rl-verdict", "Watching…");
      const plan = await demo.play({ profile }, {
        scale: scaleFor(root),
        onStop: ({ index, backs, elapsed, fixation }) => {
          out("#rl-stops", String(index));
          out("#rl-backs", String(backs));
          out("#rl-time", seconds(elapsed));
          out("#rl-now", `${fixation.ms} ms${KIND_TEXT[fixation.kind] ? ` · ${KIND_TEXT[fixation.kind]}` : ""}`);
        },
      });
      if (!plan) return;
      out("#rl-now", "");
      const words = DEMO_TEXT.split(/\s+/).length;
      out("#rl-verdict", profile === "skilled"
        ? `${plan.fixations.length} stops for ${words} words in ${seconds(plan.totalMs)}. ${plan.skipped.length} short words were skipped: the preview had already caught them.`
        : `${plan.fixations.length} stops for ${words} words in ${seconds(plan.totalMs)}, ${plan.backs} of them jumps back. Nearly every word got its own stop, and stops were longer.`);
    }));
  }

  function setupRace(root) {
    const dev = eyeLine(root, root.querySelector("#rl-race-a"), RACE_TEXT);
    const skilled = eyeLine(root, root.querySelector("#rl-race-b"), RACE_TEXT);
    root.querySelector("[data-race]").addEventListener("click", async () => {
      session++;
      const tag = (sel) => root.querySelector(sel);
      const progress = (sel) => ({ index, backs, elapsed }) => { tag(sel).textContent = `${index} stops · ${backs} back · ${seconds(elapsed)}`; };
      tag("#rl-race-verdict").textContent = "Racing…";
      const scale = scaleFor(root);
      const [a, b] = await Promise.all([
        dev.play({ profile: "developing" }, { scale, onStop: progress("#rl-race-dev") }),
        skilled.play({ profile: "skilled" }, { scale, onStop: progress("#rl-race-skill") }),
      ]);
      if (!a || !b) return;
      tag("#rl-race-verdict").textContent = `The skilled reader finished in ${seconds(b.totalMs)} with ${b.fixations.length} stops; the developing reader took ${seconds(a.totalMs)} with ${a.fixations.length} stops and ${a.backs} jumps back. Same eyes, same letters per stop: the difference is fewer wasted stops.`;
    });
  }

  // Compare each guessable word in context with the same word scrambled: that is where the effect shows.
  function contextVerdict(inContext, scrambled) {
    const wordsA = CONTEXT.natural.split(/\s+/);
    const wordsB = CONTEXT.scrambled.split(/\s+/);
    const clean = (w) => w.replace(/[^A-Za-z]/g, "").toLowerCase();
    // The word's own stops only: a landing after a line break depends on screen width, not on the word.
    const timeOf = (plan, k) => plan.fixations.filter((f) => f.word === k && f.kind !== "return").reduce((sum, f) => sum + f.ms, 0);
    const parts = CONTEXT.predictable.map((k) => {
      const word = clean(wordsA[k]);
      const j = wordsB.findIndex((w) => clean(w) === word);
      const a = timeOf(inContext, k);
      const b = j < 0 ? null : timeOf(scrambled, j);
      const say = (ms) => (ms ? `${ms} ms` : "skipped");
      return b === null || a === b ? null : `"${word}" ${say(a)} in context, ${say(b)} scrambled`;
    }).filter(Boolean);
    // The page estimate uses plans without line breaks, so it does not change with screen width.
    const flat = (text, opts) => planReading(text, opts).totalMs;
    const perWord = (flat(CONTEXT.scrambled) - flat(CONTEXT.natural, { predictable: CONTEXT.predictable })) / wordsA.length;
    return `${parts.join("; ")}. Each saving is small, but it happens on every guessable word: at this rate a 300-word page takes about ${Math.max(0, Math.round((perWord * 300) / 1000))} seconds less. More importantly, words that fit what you expected are understood with less effort.`;
  }

  function setupContext(root) {
    const natural = eyeLine(root, root.querySelector("#rl-ctx-line-a"), CONTEXT.natural);
    const scrambled = eyeLine(root, root.querySelector("#rl-ctx-line-b"), CONTEXT.scrambled);
    root.querySelector("[data-context]").addEventListener("click", async () => {
      session++;
      const tag = (sel) => root.querySelector(sel);
      const progress = (sel) => ({ index, elapsed }) => { tag(sel).textContent = `${index} stops · ${seconds(elapsed)}`; };
      tag("#rl-ctx-verdict").textContent = "Reading both…";
      const scale = scaleFor(root);
      const [a, b] = await Promise.all([
        natural.play({ profile: "skilled", predictable: CONTEXT.predictable }, { scale, onStop: progress("#rl-ctx-a") }),
        scrambled.play({ profile: "skilled" }, { scale, onStop: progress("#rl-ctx-b") }),
      ]);
      if (!a || !b) return;
      tag("#rl-ctx-verdict").textContent = contextVerdict(a, b);
    });
  }

  function setupLoop(root) {
    const steps = [...root.querySelectorAll("#rl-loop li")];
    let active = 0;
    const paint = () => steps.forEach((li, i) => li.classList.toggle("active", i === active));
    paint();
    loopTimer = setInterval(() => {
      if (!root.querySelector("#rl-loop") || !root.closest(".screen")?.classList.contains("active")) { clearInterval(loopTimer); return; }
      active = (active + 1) % steps.length;
      paint();
    }, 1600);
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
