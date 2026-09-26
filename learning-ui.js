(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const node = (tag, className, text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; };
  let app, editing = null, imported = null, busyApplying = false;
  function button(text, action, className = "btn btn-ghost") {
    const b = node("button", className, text); b.type = "button"; b.addEventListener("click", action); return b;
  }
  function renderLists() {
    const target = el("saved-lists"); target.replaceChildren();
    const lists = SpellLearning.lists();
    if (!lists.length) target.append(node("p", "word-list-empty", "Your first collection starts with a few words. Paste them above."));
    for (const list of lists) {
      const card = node("article", "feature-card");
      card.append(node("h3", "", list.name), node("p", "settings-note", `${list.entries.length} ${list.entries.length === 1 ? "word" : "words"} · ${list.entries.slice(0, 5).map(w => w.word).join(", ")}${list.entries.length > 5 ? "…" : ""}`));
      card.append(button("Practise this list", () => app.start(SpellLearning.seededOrder(list.entries, crypto.randomUUID()), { kind: "custom", title: list.name }), "btn btn-primary"));
      const actions = node("div", "compact-actions");
      actions.append(button("Edit", () => {
        editing = list.id; el("list-form-title").textContent = "Edit word list";
        el("list-name").value = list.name;
        el("list-words").value = list.entries.map(w => [w.word, w.hint || "", w.syllables || ""].join(" | ").replace(/(?: \| )+$/, "")).join("\n");
        el("btn-cancel-list").classList.remove("hidden"); el("list-name").focus();
      }), button("Delete", () => {
        if (!confirm(`Delete “${list.name}”? Your spelling progress and notebook will stay saved.`)) return;
        SpellLearning.deleteList(list.id); if (editing === list.id) clearForm(); renderLists();
      }));
      card.append(actions); target.append(card);
    }
  }
  function clearForm() { editing = null; el("list-form").reset(); el("list-form-title").textContent = "Make a word list"; el("btn-cancel-list").classList.add("hidden"); }
  function notebookEntries() {
    const q = el("notebook-search").value.trim().toLowerCase();
    return Object.values(SpellLearning.get().notebook).filter(r => r.word.includes(q) || r.note.toLowerCase().includes(q)).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function renderNotebook() {
    const target = el("notebook-list"); target.replaceChildren();
    const entries = notebookEntries();
    el("btn-notebook-practice").disabled = !entries.length;
    if (!entries.length) target.append(node("p", "word-list-empty", el("notebook-search").value ? "No matching words. Try another search." : "Mistakes are part of learning. Your next tricky word will appear here, ready for a memory tip."));
    for (const rec of entries) {
      const card = node("article", "feature-card notebook-entry");
      card.append(node("h3", "", rec.word));
      const attempts = node("p", "attempt-history");
      attempts.append(node("span", "settings-note", "Your attempts: "));
      attempts.append(node("span", "", rec.attempts.slice(-4).map(a => a.text).join(" · ")));
      card.append(attempts);
      const tip = rec.entry.memoryTip || (rec.entry.rule && RULE_TIPS[rec.entry.rule]) || `Look carefully at ${rec.word.toUpperCase()}. Say it, cover it, then try writing it from memory.`;
      card.append(node("p", "memory-tip", tip));
      const label = node("label", "field-label", "My memory tip"); label.htmlFor = `note-${rec.word}`;
      const input = node("textarea", "text-input"); input.id = label.htmlFor; input.rows = 2; input.maxLength = 500; input.value = rec.note;
      input.placeholder = "A rhyme, a pattern, or a reminder that works for you…";
      const status = node("span", "settings-note"); status.setAttribute("role", "status");
      input.addEventListener("input", () => { SpellLearning.saveNote(rec.word, input.value); status.textContent = "Saved"; });
      card.append(label, input, status, button("Practise this word", () => app.start([rec.entry], { kind: "review", title: "Notebook" })));
      target.append(card);
    }
  }
  function renderDaily() {
    const date = SpellLearning.dayKey();
    const plan = SpellLearning.dailyPlan(app.progress(), app.variant, date);
    const done = plan.words.filter(w => plan.results[w.word]).length;
    el("daily-count").textContent = `${done} / 5`;
    el("daily-description").textContent = plan.completedAt ? "Today's five are complete. Come back tomorrow for a fresh challenge." : `${plan.reviewCount ? `${plan.reviewCount} review + ${5 - plan.reviewCount} fresh practice` : "Five fresh words"}. A few minutes just for you.`;
    const dailyButton = el("btn-daily");
    dailyButton.setAttribute("aria-label", plan.completedAt ? "Daily five completed" : done ? "Continue today's daily five" : "Start today's daily five");
    dailyButton.disabled = !!plan.completedAt;
    const calendar = el("week-calendar"); calendar.replaceChildren();
    const today = new Date(), monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const history = SpellLearning.get().daily;
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday); day.setDate(monday.getDate() + i);
      const key = SpellLearning.dayKey(day), completed = !!history[key]?.completedAt;
      const cell = node("div", `calendar-day${key === date ? " today" : ""}${completed ? " completed" : ""}`);
      cell.setAttribute("aria-label", `${day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${completed ? "completed" : key > date ? "upcoming" : "not completed"}`);
      cell.append(node("span", "", ["M", "T", "W", "T", "F", "S", "S"][i]), node("strong", "", completed ? "✓" : String(day.getDate())));
      calendar.append(cell);
    }
  }
  function snapshot() { return SpellLearning.snapshot(app.progress()); }
  function applySnapshot(value) {
    const validated = SpellLearning.validateSnapshot(value);
    if (JSON.stringify(validated) === JSON.stringify(snapshot())) return;
    busyApplying = true;
    try {
      SpellLearning.replace(validated.learning);
      app.replaceProgress(validated.progress);
      // Restore coach data from the validated snapshot if present.
      if (validated.coach && window.SpellCoach) {
        window.SpellCoach.replaceCoachData(validated.coach);
      }
      renderDaily();
    }
    finally { busyApplying = false; }
  }
  function init(adapter) {
    app = adapter;
    document.querySelectorAll(".feature-back").forEach(b => b.addEventListener("click", () => app.show("home")));
    el("btn-lists").addEventListener("click", () => { renderLists(); app.show("lists"); });
    el("btn-notebook").addEventListener("click", () => { renderNotebook(); app.show("notebook"); });
    el("btn-notebook-practice").addEventListener("click", () => app.start(notebookEntries().map(r => r.entry), { kind: "review", title: "Notebook" }));
    el("notebook-search").addEventListener("input", renderNotebook);
    el("btn-cancel-list").addEventListener("click", clearForm);
    el("list-form").addEventListener("submit", e => {
      e.preventDefault();
      const parsed = SpellLearning.parseWords(el("list-words").value);
      if (parsed.errors.length) { el("list-status").textContent = parsed.errors.join("\n"); return; }
      try { SpellLearning.saveList(editing, el("list-name").value, parsed.entries); clearForm(); renderLists(); el("list-status").textContent = `Saved ${parsed.entries.length} words.`; }
      catch (error) { el("list-status").textContent = error.message; }
    });
    el("btn-proofread").addEventListener("click", () => app.start(SpellLearning.seededOrder(PROOFREAD_WORDS, crypto.randomUUID()).map(app.variant), { kind: "proofread", title: "Spot the mistake" }));
    el("btn-daily").addEventListener("click", () => {
      const date = SpellLearning.dayKey(), plan = SpellLearning.dailyPlan(app.progress(), app.variant, date);
      if (plan.completedAt) { renderDaily(); return; }
      app.start(plan.words.filter(w => !plan.results[w.word]), { kind: "daily", title: "Daily five", date, fullLength: true });
    });
    el("btn-sync").addEventListener("click", () => { app.show("sync"); SpellSync.check(); });
    el("btn-sync-back").addEventListener("click", () => app.show("settings"));
    el("btn-export").addEventListener("click", () => {
      const value = snapshot(); value.exportedAt = new Date().toISOString();
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `spell-it-${SpellLearning.dayKey()}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      el("backup-status").textContent = "Backup downloaded. Keep this file somewhere safe.";
    });
    el("backup-file").addEventListener("change", async () => {
      imported = null; el("backup-preview").classList.add("hidden");
      const file = el("backup-file").files[0]; if (!file) return;
      try {
        if (file.size > 1_500_000) throw new Error("Choose a backup smaller than 1.5 MB.");
        imported = SpellLearning.validateSnapshot(JSON.parse(await file.text()));
        el("backup-description").textContent = `${Object.keys(imported.progress.srs).length} practised words, ${Object.values(imported.learning.lists).filter(l => !l.deleted).length} lists and ${Object.keys(imported.learning.notebook).length} notebook entries. This merges with the progress already here; newer edits win.`;
        el("backup-preview").classList.remove("hidden"); el("backup-status").textContent = "Backup checked. Ready to merge.";
      } catch (error) { el("backup-status").textContent = error.message || "Couldn't read this backup."; }
    });
    el("btn-import").addEventListener("click", () => {
      if (!imported) return;
      try {
        const current = snapshot();
        // An explicit backup import can recover data from before a reset. Only
        // background device sync should propagate a newer reset automatically.
        const resetAt = Math.max(current.learning.resetAt, imported.learning.resetAt);
        current.learning.resetAt = imported.learning.resetAt = resetAt;
        applySnapshot(SpellLearning.mergeSnapshots(current, imported)); imported = null;
        el("backup-file").value = "";
        el("backup-preview").classList.add("hidden"); el("backup-status").textContent = "Progress merged. You're ready to practise."; SpellSync.schedule();
      } catch (error) { el("backup-status").textContent = error.message; }
    });
    window.addEventListener("spellit-sync-status", event => {
      const { text, linked, available } = event.detail;
      el("sync-status").textContent = text;
      el("sync-availability").textContent = available ? "Ready on this site. Use the same site address on both devices." : "This host needs the Spell It sync service. You can transfer a backup in the meantime.";
      el("btn-enable-sync").disabled = !available || linked;
      el("btn-link-sync").disabled = !available || linked;
      el("sync-connected").classList.toggle("hidden", !linked);
    });
    const syncAction = (id, action) => el(id).addEventListener("click", async () => {
      el(id).disabled = true;
      try { await action(); } catch (error) { el("sync-status").textContent = error.message; }
      finally { el(id).disabled = false; }
    });
    syncAction("btn-enable-sync", async () => { const code = await SpellSync.create(); el("sync-code").value = code; el("sync-status").textContent += " Copy the code to link your other device."; });
    syncAction("btn-link-sync", async () => { await SpellSync.connect(el("sync-code").value); el("sync-code").value = ""; });
    syncAction("btn-copy-sync", async () => {
      try { await navigator.clipboard.writeText(SpellSync.getCode()); el("sync-status").textContent = "Code copied. Paste it on your other device and keep it private."; }
      catch { el("sync-code").value = SpellSync.getCode(); el("sync-code").type = "text"; el("sync-code").select(); el("sync-status").textContent = "Select and copy the code shown above."; }
    });
    syncAction("btn-sync-now", SpellSync.sync);
    el("btn-disconnect-sync").addEventListener("click", () => { SpellSync.disconnect(); el("sync-code").value = ""; el("sync-code").type = "password"; });
    SpellSync.init({ snapshot, apply: applySnapshot, isBusy: () => busyApplying || app.isBusy() || ["lists", "notebook"].some(name => el(`screen-${name}`).classList.contains("active")) });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !app.isBusy()) renderDaily(); });
    renderDaily();
  }
  window.SpellFeatures = { init, renderDaily, renderLists, snapshot, applySnapshot };
})();
