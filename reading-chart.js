// Progress chart for the reading trainer: effective speed (words per minute × share right) over your
// last reads, drawn as a hand-written SVG. Shows your starting speed, the mastery goal, best, latest and
// the change since you started. The data prep below is pure and exported in Node for tests; the DOM
// code sits after it and registers with the trainer's front page.
(() => {
  "use strict";

  const MAX_POINTS = 30;
  const VIEW = { w: 340, h: 230, left: 40, right: 56, top: 16, bottom: 30 };

  const effective = (r) => Math.round((r.wpm || 0) * (r.share || 0));

  // The reads worth charting, oldest first: a real pace (wpm > 0) that was not skimming (wpm <= maxWpm).
  // `read` is the position among all such reads, so the axis can say "Read 12" even when only the last
  // 30 are drawn.
  function chartSeries(results, { maxWpm = 1000, limit = MAX_POINTS } = {}) {
    const all = (Array.isArray(results) ? results : [])
      .filter((r) => r && r.wpm > 0 && r.wpm <= maxWpm)
      .map((r, i) => ({ read: i + 1, at: r.at, level: r.level, wpm: r.wpm, share: r.share, eff: effective(r), passed: Boolean(r.passed) }));
    return all.slice(-limit);
  }

  // Round axis numbers: a step of 1, 2 or 5 times a power of ten, with the range padded to fit.
  function niceTicks(min, max, count = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 100, ticks: [0, 50, 100] };
    if (max <= min) { const pad = Math.max(10, Math.abs(max) * 0.1); min -= pad; max += pad; }
    const raw = (max - min) / Math.max(1, count);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw - 1e-9);
    const lo = Math.floor(min / step + 1e-9) * step;
    const hi = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return { min: lo, max: hi, ticks };
  }

  // Best, latest and change since the start. The start is your starting speed when known, otherwise the
  // first charted read (only with two or more reads). `change` is null when there is nothing to compare.
  function summarize(series, baseline) {
    if (!series.length) return { count: 0, best: 0, latest: null, start: baseline > 0 ? baseline : null, change: null, changePct: null };
    const best = Math.max(...series.map((p) => p.eff));
    const latest = series[series.length - 1].eff;
    const start = baseline > 0 ? baseline : series.length > 1 ? series[0].eff : null;
    const change = start ? latest - start : null;
    return { count: series.length, best, latest, start, change, changePct: start ? Math.round((change / start) * 100) : null };
  }

  // Pixel positions. The y range covers every point, the starting speed and the goal. It starts at zero
  // unless every value sits well above it, so the line is never cropped.
  function layout(series, { baseline = null, goal = null } = {}, view = VIEW) {
    const values = series.map((p) => p.eff).concat(baseline || [], goal || []);
    const top = Math.max(...values, 0);
    const bottom = values.length ? Math.min(...values) : 0;
    const axis = niceTicks(bottom > top * 0.6 ? Math.floor(bottom * 0.8) : 0, top);
    const plotW = view.w - view.left - view.right;
    const plotH = view.h - view.top - view.bottom;
    const x = (i) => view.left + (series.length <= 1 ? plotW / 2 : (plotW * i) / (series.length - 1));
    const y = (v) => view.top + plotH - ((v - axis.min) / (axis.max - axis.min)) * plotH;
    const round = (n) => Math.round(n * 10) / 10;
    return {
      axis,
      points: series.map((p, i) => ({ ...p, x: round(x(i)), y: round(y(p.eff)) })),
      yTicks: axis.ticks.map((v) => ({ v, y: round(y(v)) })),
      baselineY: baseline ? round(y(baseline)) : null,
      goalY: goal ? round(y(goal)) : null,
      plot: { left: view.left, right: view.w - view.right, top: view.top, bottom: view.h - view.bottom },
    };
  }

  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

  const api = { MAX_POINTS, VIEW, chartSeries, niceTicks, summarize, layout, signed };

  if (typeof window === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    return;
  }

  // ---------- DOM ----------
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const pointLabel = (p) => `Read ${p.read}, level ${p.level}: ${p.wpm} wpm, ${Math.round(p.share * 100)}% right, effective ${p.eff} wpm. ${p.passed ? "Passed" : "Not passed"}.`;

  // Passed is a filled circle, not passed is a hollow diamond: the shape says it, not only the colour.
  const marker = (p) => p.passed
    ? `<circle class="rc-dot rc-pass" cx="${p.x}" cy="${p.y}" r="5"/>`
    : `<rect class="rc-dot rc-miss" x="${p.x - 4.5}" y="${p.y - 4.5}" width="9" height="9" transform="rotate(45 ${p.x} ${p.y})"/>`;

  const goalFor = (state) => (state.baseline ? Math.round(state.baseline * window.SpellReading.MASTERY_GOAL) : null);
  const seriesFor = (state) => chartSeries(state.results, { maxWpm: window.SpellReading.MAX_WPM });

  function chartHtml(state) {
    const series = seriesFor(state);
    if (!series.length) {
      return `<section class="feature-card rc-card" aria-labelledby="rc-h">
        <h3 id="rc-h">Your progress</h3>
        <p class="rc-empty">Your speed will show up here after your first read. It takes about two minutes.</p>
        <button class="btn btn-ghost" type="button" data-level="1">Do your first read</button>
      </section>`;
    }
    const goal = goalFor(state);
    const sum = summarize(series, state.baseline);
    const g = layout(series, { baseline: state.baseline, goal });
    const { plot } = g;
    const first = series[0];
    const last = series[series.length - 1];
    const desc = `Effective speed over your last ${series.length} read${series.length === 1 ? "" : "s"}, from ${first.eff} to ${last.eff} words per minute. Best ${sum.best}.`
      + (state.baseline ? ` Starting speed ${state.baseline}, goal ${goal}.` : "");

    const grid = g.yTicks.map((t) => `<line class="rc-grid" x1="${plot.left}" x2="${plot.right}" y1="${t.y}" y2="${t.y}"/><text class="rc-tick" x="${plot.left - 6}" y="${t.y + 3.5}" text-anchor="end">${t.v}</text>`).join("");
    const line = g.points.length > 1 ? `<polyline class="rc-line" points="${g.points.map((p) => `${p.x},${p.y}`).join(" ")}"/>` : "";
    const refs = (g.baselineY !== null ? `<line class="rc-ref rc-start" x1="${plot.left}" x2="${plot.right}" y1="${g.baselineY}" y2="${g.baselineY}"/><text class="rc-reflabel" x="${plot.right + 5}" y="${g.baselineY + 3.5}">Start ${state.baseline}</text>` : "")
      + (g.goalY !== null ? `<line class="rc-ref rc-goal" x1="${plot.left}" x2="${plot.right}" y1="${g.goalY}" y2="${g.goalY}"/><text class="rc-reflabel" x="${plot.right + 5}" y="${g.goalY + 3.5}">Goal ${goal}</text>` : "");
    const xs = `<text class="rc-tick" x="${g.points[0].x}" y="${VIEW.h - 10}" text-anchor="${g.points.length > 1 ? "start" : "middle"}">Read ${first.read}</text>`
      + (g.points.length > 1 ? `<text class="rc-tick" x="${g.points[g.points.length - 1].x}" y="${VIEW.h - 10}" text-anchor="end">Read ${last.read}</text>` : "");
    const dots = g.points.map((p, i) => `<g class="rc-pt" tabindex="0" role="button" data-i="${i}" aria-label="${escapeHtml(pointLabel(p))}"><circle class="rc-hit" cx="${p.x}" cy="${p.y}" r="15"/>${marker(p)}</g>`).join("");

    const rows = series.map((p) => `<tr><td>${p.read}</td><td>${p.level}</td><td>${p.wpm}</td><td>${Math.round(p.share * 100)}%</td><td>${p.eff}</td><td>${p.passed ? "Passed" : "Not passed"}</td></tr>`).join("");
    const changeLabel = state.baseline ? "since start" : series.length > 1 ? "since first read" : "since start";

    return `<section class="feature-card rc-card" aria-labelledby="rc-h">
      <h3 id="rc-h">Your progress</h3>
      <div class="rc-figs">
        <div><strong>${sum.best}</strong><span>best</span></div>
        <div><strong>${sum.latest}</strong><span>latest</span></div>
        <div><strong${sum.change > 0 ? ' class="rc-up"' : ""}>${sum.change === null ? "n/a" : signed(sum.change)}</strong><span>${changeLabel}</span></div>
      </div>
      <svg class="rc-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" role="img" aria-labelledby="rc-t rc-d">
        <title id="rc-t">Effective speed over time</title>
        <desc id="rc-d">${escapeHtml(desc)}</desc>
        ${grid}${refs}${line}${xs}${dots}
        <g class="rc-focus" hidden aria-hidden="true"><circle cx="0" cy="0" r="9"/></g>
      </svg>
      <p class="rc-readout" aria-live="polite">${escapeHtml(pointLabel(g.points[g.points.length - 1]))}</p>
      <ul class="rc-legend" aria-label="Key">
        <li><svg viewBox="0 0 14 14" aria-hidden="true"><circle class="rc-dot rc-pass" cx="7" cy="7" r="5"/></svg>Passed</li>
        <li><svg viewBox="0 0 14 14" aria-hidden="true"><rect class="rc-dot rc-miss" x="2.5" y="2.5" width="9" height="9" transform="rotate(45 7 7)"/></svg>Not passed</li>
        ${state.baseline ? `<li><svg viewBox="0 0 24 14" aria-hidden="true"><line class="rc-ref rc-start" x1="1" x2="23" y1="7" y2="7"/></svg>Starting speed</li>
        <li><svg viewBox="0 0 24 14" aria-hidden="true"><line class="rc-ref rc-goal" x1="1" x2="23" y1="7" y2="7"/></svg>Goal</li>` : ""}
      </ul>
      <p class="settings-note">Effective speed is words per minute × share right. Tap a point for details.</p>
      <details class="rc-table"><summary>See the numbers</summary>
        <div class="rc-table-wrap"><table>
          <thead><tr><th scope="col">Read</th><th scope="col">Level</th><th scope="col">wpm</th><th scope="col">Right</th><th scope="col">Effective</th><th scope="col">Result</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      </details>
    </section>`;
  }

  function bind(root, host) {
    const card = root.querySelector(".rc-card");
    const svg = card?.querySelector(".rc-svg");
    if (!svg) return;
    const state = host.state();
    const g = layout(seriesFor(state), { baseline: state.baseline, goal: goalFor(state) });
    const readout = card.querySelector(".rc-readout");
    const ring = svg.querySelector(".rc-focus");
    const pts = [...svg.querySelectorAll(".rc-pt")];
    const show = (i) => {
      const p = g.points[i];
      if (!p) return;
      readout.textContent = pointLabel(p);
      ring.removeAttribute("hidden");
      ring.setAttribute("transform", `translate(${p.x} ${p.y})`);
    };
    const indexOf = (e) => { const pt = e.target.closest?.(".rc-pt"); return pt ? Number(pt.dataset.i) : -1; };
    svg.addEventListener("click", (e) => { const i = indexOf(e); if (i >= 0) show(i); });
    svg.addEventListener("pointerover", (e) => { const i = indexOf(e); if (i >= 0 && e.pointerType === "mouse") show(i); });
    svg.addEventListener("focusin", (e) => { const i = indexOf(e); if (i >= 0) show(i); });
    svg.addEventListener("keydown", (e) => {
      const i = indexOf(e);
      if (i < 0) return;
      const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: pts.length - 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); pts[Math.max(0, Math.min(pts.length - 1, to))].focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i); }
    });
  }

  window.SpellReading?.register?.({ id: "chart", home: (host) => chartHtml(host.state()), bind });
})();
