// Daily reading habit: a "Today's reading" card on Home and the day marks behind it.
// A day counts once any read is finished in the trainer (passed or not); the card also says how many of
// today's reads passed. Days are local calendar dates ("YYYY-MM-DD"), the same rule as the app's streak,
// and are kept in their own key so the learning streak is untouched. The trainer announces each finished
// read with a 'spellit:reading-result' event on window ({ level, passed }); this file listens for it, so
// days are marked even if the trainer's screen is never rendered again.
// The rules below the DOM line are pure and exported in Node for tests.
(() => {
  "use strict";

  const STORAGE_KEY = "spellit_reading_daily";
  const READING_KEY = "spellit_reading";
  const MAX_DAYS = 120;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  // The ten-minute routine the card describes, in order.
  const ROUTINE = [
    { minutes: 1, label: "Preview" },
    { minutes: 3, label: "Paced read" },
    { minutes: 3, label: "Phrase read, then a 5-word summary" },
    { minutes: 2, label: "Questions" },
    { minutes: 1, label: "Note your score" },
  ];

  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  // Move a day key by whole calendar days. Done on year/month/day numbers in UTC, never by adding 24
  // hours to a local time, so a daylight saving change cannot skip or repeat a day.
  function addDays(key, n) {
    const [y, m, d] = key.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }

  function emptyState() {
    return { days: [], today: { day: "", reads: 0, passed: 0 } };
  }

  function sanitize(raw) {
    const state = emptyState();
    if (!raw || typeof raw !== "object") return state;
    if (Array.isArray(raw.days)) {
      state.days = [...new Set(raw.days.filter((d) => typeof d === "string" && DAY_RE.test(d)))].sort().slice(-MAX_DAYS);
    }
    const t = raw.today;
    if (t && typeof t === "object" && typeof t.day === "string" && DAY_RE.test(t.day)) {
      const reads = Math.max(0, Math.floor(Number(t.reads)) || 0);
      const passed = Math.min(reads, Math.max(0, Math.floor(Number(t.passed)) || 0));
      state.today = { day: t.day, reads, passed };
    }
    return state;
  }

  // Record one finished read on the given day. Pure: returns a new state.
  function markRead(state, passed, today = dayKey()) {
    const next = sanitize(JSON.parse(JSON.stringify(state)));
    if (!next.days.includes(today)) next.days = [...next.days, today].sort().slice(-MAX_DAYS);
    if (next.today.day !== today) next.today = { day: today, reads: 0, passed: 0 };
    next.today.reads += 1;
    if (passed) next.today.passed += 1;
    return next;
  }

  const readToday = (state, today = dayKey()) => state.days.includes(today);

  // How many reads (and passes) were finished today. Zero when the stored counts are from another day.
  function todayCounts(state, today = dayKey()) {
    if (state.today.day !== today) return { reads: 0, passed: 0 };
    return { reads: state.today.reads, passed: state.today.passed };
  }

  // Consecutive days read, ending today. Today not being read yet does not break yesterday's streak.
  function readingStreak(state, today = dayKey()) {
    const set = new Set(state.days);
    let day = set.has(today) ? today : addDays(today, -1);
    let count = 0;
    while (set.has(day)) { count += 1; day = addDays(day, -1); }
    return count;
  }

  // The last seven days, oldest first, ending today.
  function weekView(state, today = dayKey()) {
    const set = new Set(state.days);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { day, read: set.has(day), today: day === today };
    });
  }

  const api = { ROUTINE, MAX_DAYS, dayKey, addDays, emptyState, sanitize, markRead, readToday, todayCounts, readingStreak, weekView };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return emptyState(); }
  }
  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* blocked: the day is just not kept */ }
  }

  function onResult(event) {
    save(markRead(load(), Boolean(event.detail?.passed)));
    render();
  }

  // The level to read today: the furthest one unlocked in the trainer, or level 1 before any read.
  function currentLevel() {
    try {
      const unlocked = Number(JSON.parse(localStorage.getItem(READING_KEY))?.unlocked);
      return Number.isInteger(unlocked) && unlocked >= 1 ? unlocked : 1;
    } catch { return 1; }
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function render() {
    const card = document.getElementById("reading-daily");
    if (!card) return;
    const state = load();
    const today = dayKey();
    const done = readToday(state, today);
    const { reads, passed } = todayCounts(state, today);
    const streak = readingStreak(state, today);
    const dots = weekView(state, today).map((d) => {
      const [y, m, dd] = d.day.split("-").map(Number);
      const name = WEEKDAYS[new Date(y, m - 1, dd).getDay()];
      return `<li class="rd-daily-dot${d.read ? " read" : ""}${d.today ? " today" : ""}"><span aria-hidden="true"></span><small>${name}</small><span class="rd-daily-sr">${d.read ? "read" : "not read"}${d.today ? ", today" : ""}</span></li>`;
    }).join("");
    const status = done
      ? `Done for today: ${plural(reads, "read")}, ${passed} passed.`
      : streak ? "Not read yet today. Read now to keep your streak." : "Ten minutes, once a day.";
    card.innerHTML = `
      <div class="daily-heading"><h2 id="reading-daily-heading">Today's reading</h2>
        <span class="rd-daily-streak"><strong>${streak}</strong> day${streak === 1 ? "" : "s"} in a row</span></div>
      <p class="rd-daily-status${done ? " done" : ""}" role="status">${status}</p>
      <ul class="rd-daily-week" aria-label="Last seven days">${dots}</ul>
      <ol class="rd-daily-steps">${ROUTINE.map((s) => `<li><strong>${s.minutes} min</strong> ${s.label}</li>`).join("")}</ol>
      <button class="btn btn-primary" type="button" data-reading-daily-start>${done ? "Read again" : "Start today's reading"}</button>`;
  }

  // Open the trainer on your current level's lesson. The trainer opens its front page, whose level
  // button for that level leads to the lesson, so the trainer itself needs no change.
  function start() {
    if (!window.SpellReading?.open) return;
    window.SpellReading.open();
    document.getElementById("reading-view")?.querySelector(`[data-level="${currentLevel()}"]:not([disabled])`)?.click();
  }

  // On the trainer's own front page, a one-line reminder of today's status.
  function trainerLine() {
    const state = load();
    const today = dayKey();
    const streak = readingStreak(state, today);
    const text = readToday(state, today)
      ? `Read today. ${plural(streak, "day")} in a row.`
      : streak ? `Not read yet today. Keep your ${plural(streak, "day")} going.` : "Read once today to start a streak.";
    return `<p class="settings-note rd-daily-line">${text}</p>`;
  }
  window.SpellReading?.register?.({ id: "daily", home: trainerLine });

  function init() {
    const card = document.getElementById("reading-daily");
    if (!card) return;
    card.addEventListener("click", (event) => { if (event.target.closest("[data-reading-daily-start]")) start(); });
    window.addEventListener("spellit:reading-result", onResult);
    // A new day may start while the app sits in the background.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.SpellReadingDaily = api;
})();
