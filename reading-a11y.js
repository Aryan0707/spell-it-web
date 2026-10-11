// Accessibility layer for the reading trainer and the Eyes and brain lesson.
// It watches the trainer's root (#reading-view) and, after every view the trainer draws, it:
//   - moves focus to the view's heading (without scrolling),
//   - adds a text-size control (4 steps, kept in localStorage under spellit_reading_prefs),
//   - makes the tap-to-find words reachable by keyboard (arrow keys, Enter or Space) and offers a
//     "type the answer" field, and says the result in a polite live region,
//   - adds a photosensitivity note and a "Slower start" option to the sprint level,
//   - gives the level tiles a spoken status (passed, locked).
// The rules below the DOM line are pure and exported in Node for tests.
(() => {
  "use strict";

  const PREFS_KEY = "spellit_reading_prefs";
  const SIZE_STEPS = [
    { n: 1, scale: 1, label: "Normal" },
    { n: 2, scale: 1.15, label: "Large" },
    { n: 3, scale: 1.3, label: "Larger" },
    { n: 4, scale: 1.5, label: "Largest" },
  ];
  const DEFAULT_SIZE = 1;
  // More than this many changes a second is the limit the web accessibility guidelines give for flashing.
  const FLASH_LIMIT_PER_SECOND = 3;
  const SLOW_START_MS = 3000;

  function clampSize(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_SIZE;
    return Math.min(SIZE_STEPS.length, Math.max(1, n));
  }

  function sanitizePrefs(raw) {
    const prefs = { size: DEFAULT_SIZE, slowStart: false };
    if (!raw || typeof raw !== "object") return prefs;
    prefs.size = clampSize(raw.size);
    prefs.slowStart = raw.slowStart === true;
    return prefs;
  }

  // A step up or down the size ladder, never past either end.
  function stepSize(size, direction) {
    return clampSize(clampSize(size) + (direction < 0 ? -1 : 1));
  }

  // Where the keyboard focus goes next among `count` words. Left/Up and Right/Down move one word,
  // Home/End jump to the ends, PageUp/PageDown move by paragraph (`starts` holds each paragraph's
  // first word). Returns the same index for any other key, and never goes outside the text.
  function nextWordIndex(index, key, count, starts = [0]) {
    if (!(count > 0)) return 0;
    const at = Math.min(count - 1, Math.max(0, Number.isInteger(index) ? index : 0));
    switch (key) {
      case "ArrowRight": case "ArrowDown": return Math.min(count - 1, at + 1);
      case "ArrowLeft": case "ArrowUp": return Math.max(0, at - 1);
      case "Home": return 0;
      case "End": return count - 1;
      case "PageDown": return starts.find((s) => s > at) ?? at;
      case "PageUp": {
        const here = [...starts].reverse().find((s) => s <= at) ?? 0;
        return here < at ? here : ([...starts].reverse().find((s) => s < at) ?? 0);
      }
      default: return at;
    }
  }

  const normWord = (word) => String(word).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

  // For "type the answer": the position of the first word where the typed phrase starts in the text,
  // or -1. Case and punctuation at the edges of each word are ignored.
  function findTyped(words, typed) {
    const target = String(typed || "").split(/\s+/).map(normWord).filter(Boolean);
    if (!target.length) return -1;
    const flat = words.map(normWord);
    for (let i = 0; i + target.length <= flat.length; i++) {
      if (target.every((t, k) => flat[i + k] === t)) return i;
    }
    return -1;
  }

  // What is said (and shown) after a fact was answered in the scanning level.
  function scanMessage({ hit, picked, answer }) {
    if (hit) return `Right. You found it: ${answer}.`;
    if (picked) return `Not that one: ${picked}. The answer was: ${answer}.`;
    return `Time is up. The answer was: ${answer}.`;
  }

  // The sprint changes the word this many times a second on average.
  const flashesPerSecond = (wpm) => Math.round((wpm / 60) * 10) / 10;
  const exceedsFlashLimit = (wpm) => flashesPerSecond(wpm) > FLASH_LIMIT_PER_SECOND;

  // How long the sprint waits before its first word.
  function leadMs(style, prefs) {
    const base = style === "flash" ? 800 : 400;
    return style === "flash" && prefs?.slowStart ? SLOW_START_MS : base;
  }

  const api = { PREFS_KEY, SIZE_STEPS, FLASH_LIMIT_PER_SECOND, SLOW_START_MS, clampSize, sanitizePrefs, stepSize,
    nextWordIndex, findTyped, scanMessage, flashesPerSecond, exceedsFlashLimit, leadMs };
  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  let prefs = sanitizePrefs(null);
  function loadPrefs() {
    try { prefs = sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY))); } catch { prefs = sanitizePrefs(null); }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* blocked storage: the choice just is not kept */ }
  }

  const root = document.getElementById("reading-view");
  if (!root) return;
  loadPrefs();

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isActive = () => root.closest(".screen")?.classList.contains("active");

  function applySize() {
    root.dataset.rdSize = String(prefs.size);
    root.style.setProperty("--rd-scale", String(SIZE_STEPS[prefs.size - 1].scale));
  }

  // One live region that outlives every redraw (it sits beside the root, not inside it).
  const live = document.createElement("div");
  live.className = "sr-only";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  root.parentNode.insertBefore(live, root);
  function say(text) {
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 30); // a changed node is announced; the same text twice is not
  }

  function sizeBar() {
    const bar = document.createElement("div");
    bar.className = "rda-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Text size");
    bar.innerHTML = `<span class="rda-bar-label" aria-hidden="true">Text size</span>${SIZE_STEPS.map((s) =>
      `<button type="button" class="rda-size" data-rda-size="${s.n}" style="--rda-step:${s.scale}" aria-label="${s.label} text, size ${s.n} of ${SIZE_STEPS.length}" aria-pressed="${s.n === prefs.size}"><span aria-hidden="true">A</span></button>`).join("")}`;
    return bar;
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rda-size]");
    if (!button) return;
    event.stopPropagation();
    prefs.size = clampSize(button.dataset.rdaSize);
    savePrefs();
    applySize();
    root.querySelectorAll("[data-rda-size]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.rdaSize) === prefs.size)));
    say(`${SIZE_STEPS[prefs.size - 1].label} text`);
  });

  // ---------- focus ----------
  function moveFocus() {
    if (!isActive()) return;
    if (root.contains(document.activeElement) && document.activeElement !== root) return; // the view placed focus itself
    const target = root.querySelector(".rd-scan-q") || root.querySelector(".rd-title, .feature-eyebrow, .feature-intro, .rd-passage h3, form legend");
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.classList.add("rda-focus");
    target.focus({ preventScroll: true });
  }

  // ---------- level tiles ----------
  function describeLevels() {
    root.querySelectorAll(".rd-level").forEach((tile) => {
      const num = tile.querySelector(".rd-level-num")?.textContent.trim();
      const small = tile.querySelector(".rd-level-text small")?.textContent.trim();
      const name = tile.querySelector(".rd-level-text strong")?.textContent.trim();
      const blurb = tile.querySelector(".rd-level-text > span")?.textContent.trim();
      const status = tile.classList.contains("locked") ? "Locked" : tile.classList.contains("done") ? "Passed" : tile.classList.contains("current") ? "Next up" : "";
      const level = num === "✓" ? tile.dataset.level : num;
      tile.setAttribute("aria-label", [`Level ${level}`, name, small, blurb, status].filter(Boolean).join(". "));
      tile.querySelector(".rd-lock")?.setAttribute("aria-hidden", "true");
    });
  }

  // ---------- noisy bits ----------
  function quieten() {
    root.querySelectorAll("#rd-countdown").forEach((el) => el.parentElement?.setAttribute("aria-live", "off"));
    root.querySelectorAll(".rd-progress").forEach((el) => el.setAttribute("aria-hidden", "true"));
    root.querySelectorAll(".rd-flash").forEach((el) => { el.setAttribute("aria-hidden", "true"); el.setAttribute("aria-live", "off"); });
    root.querySelectorAll(".rd-passage .rd-w").forEach((el) => el.setAttribute("aria-live", "off"));
  }

  // ---------- sprint note and slower start ----------
  function levelByTitle() {
    const name = root.querySelector(".rd-title")?.textContent.trim();
    return window.SpellReading?.LEVELS?.find((l) => l.name === name);
  }

  function sprintNote() {
    const level = levelByTitle();
    if (!level || level.drill !== "rsvp" || !root.querySelector('[data-action="begin"]')) return;
    const note = document.createElement("div");
    note.className = "feature-card rda-note";
    note.innerHTML = `<h3>Before you start</h3>
      <p>This level shows one word at a time, usually more than ${FLASH_LIMIT_PER_SECOND} a second. Fast changes like this can bother people who are sensitive to flashing. The words are plain text on a dark background, with no bright flashes, and you can press Pause at any time.</p>
      <label class="rda-check"><input type="checkbox" id="rda-slow"${prefs.slowStart ? " checked" : ""}> <span>Slower start: wait three seconds before the first word</span></label>`;
    root.querySelector('[data-action="begin"]').before(note);
    note.querySelector("#rda-slow").addEventListener("change", (e) => { prefs.slowStart = e.target.checked; savePrefs(); });
  }

  function lessonNote() {
    const line = root.querySelector("#rl-line");
    if (!line) return;
    const buttons = root.querySelector(".rl-buttons");
    const note = document.createElement("p");
    note.className = "settings-note rda-lesson-note";
    note.textContent = `The demo moves the marker about four times a second. If you prefer, read the text below it instead of playing it. With reduced motion switched on in your device settings, the marker does not hop.`;
    buttons?.after(note);
    line.closest(".rl-section")?.querySelector(".sr-only")?.setAttribute("role", "note");
  }

  // ---------- tap-to-find by keyboard ----------
  let scanWatch = null;

  function enhanceScan() {
    scanWatch?.disconnect();
    scanWatch = null;
    const article = root.querySelector(".rd-scan-text");
    if (!article) return;
    const words = [...article.querySelectorAll(".rd-w")];
    if (!words.length) return;
    const starts = [];
    article.querySelectorAll("p").forEach((p) => { const first = p.querySelector(".rd-w"); if (first) starts.push(Number(first.dataset.i)); });

    const card = root.querySelector(".rd-scan-q");
    const hint = document.createElement("p");
    hint.className = "sr-only";
    hint.id = "rda-scan-hint";
    hint.textContent = "Tab into the text, then use the arrow keys to move between words and Enter or Space to choose one. Page down jumps a paragraph. Or type the answer in the box.";
    card?.after(hint);
    card?.setAttribute("aria-describedby", "rda-scan-hint");

    words.forEach((w, i) => {
      w.setAttribute("role", "button");
      w.setAttribute("tabindex", i === 0 ? "0" : "-1");
    });
    let current = 0;
    const focusWord = (i) => {
      words[current].setAttribute("tabindex", "-1");
      current = i;
      words[i].setAttribute("tabindex", "0");
      words[i].focus({ preventScroll: false });
    };
    article.addEventListener("focusin", (e) => {
      const i = words.indexOf(e.target.closest(".rd-w"));
      if (i >= 0 && i !== current) { words[current].setAttribute("tabindex", "-1"); current = i; words[i].setAttribute("tabindex", "0"); }
    });
    article.addEventListener("keydown", (e) => {
      const word = e.target.closest(".rd-w");
      if (!word) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); word.click(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const next = nextWordIndex(current, e.key, words.length, starts);
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(e.key)) {
        e.preventDefault();
        if (next !== current) focusWord(next);
      }
    });

    // A typed answer clicks the matching word, so the trainer scores it exactly like a tap.
    const form = document.createElement("form");
    form.className = "rda-type";
    form.innerHTML = `<label for="rda-type-input">Or type the answer</label><div><input id="rda-type-input" class="text-input" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn btn-ghost" type="submit">Check</button></div>`;
    card?.append(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const index = findTyped(words.map((w) => w.textContent), form.querySelector("input").value);
      if (index < 0) { say("That is not in the text. Try other words."); return; }
      words[index].click();
    });

    // Say what happened. The trainer marks words with classes; read them once it has finished marking.
    const status = document.createElement("small");
    status.className = "rda-scan-result";
    card?.append(status);
    scanWatch = new MutationObserver(() => {
      const hit = article.querySelectorAll(".rd-w.hit");
      const answer = article.querySelectorAll(".rd-w.answer");
      const wrong = article.querySelector(".rd-w.wrong");
      const marked = hit.length ? hit : answer;
      if (!marked.length) return;
      scanWatch.disconnect();
      const text = scanMessage({
        hit: hit.length > 0,
        picked: wrong ? wrong.textContent : "",
        answer: [...marked].map((w) => w.textContent).join(" "),
      });
      status.textContent = text;
      say(text);
      words.forEach((w) => w.setAttribute("aria-disabled", "true"));
      form.querySelectorAll("input, button").forEach((el) => { el.disabled = true; });
    });
    scanWatch.observe(article, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // ---------- run after each view ----------
  function enhance() {
    if (root.firstElementChild?.classList.contains("rda-bar")) return; // our own insertion, or already done
    applySize();
    root.prepend(sizeBar());
    describeLevels();
    quieten();
    sprintNote();
    lessonNote();
    enhanceScan();
    moveFocus();
  }

  new MutationObserver(enhance).observe(root, { childList: true });
  applySize();

  window.SpellReading?.register?.({ id: "a11y", bind: () => enhance() });
  window.SpellReadingA11y = { ...api, prefs: () => ({ ...prefs }), leadMs: (style) => leadMs(style, prefs) };
})();
