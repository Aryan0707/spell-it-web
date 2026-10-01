(() => {
  "use strict";

  const updateVisibleViewportHeight = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    if (Number.isFinite(height) && height > 0) {
      document.documentElement.style.setProperty("--spellit-visible-height", `${height}px`);
    }
  };
  updateVisibleViewportHeight();
  window.addEventListener("resize", updateVisibleViewportHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", updateVisibleViewportHeight, { passive: true });

  const STORAGE_KEY = "spellit_v1";

  const el = (id) => document.getElementById(id);

  const screens = {
    home: el("screen-home"),
    game: el("screen-game"),
    settings: el("screen-settings"),
    history: el("screen-history"),
    summary: el("screen-summary"),
    lists: el("screen-lists"),
    notebook: el("screen-notebook"),
    sync: el("screen-sync"),
  };

  const ui = {
    statBest: el("stat-best"),
    statCorrect: el("stat-correct"),
    statDue: el("stat-due"),
    btnStart: el("btn-start"),
    btnReset: el("btn-reset"),
    btnQuit: el("btn-quit"),
    curStreak: el("cur-streak"),
    progressFill: el("progress-fill"),
    speakBtn: el("btn-speak"),
    hintText: el("hint-text"),
    answerRow: el("answer-row"),
    rack: el("rack"),
    btnClear: el("btn-clear"),
    btnSkip: el("btn-skip"),
    feedbackBanner: el("feedback-banner"),
    tutorPanel: el("tutor-panel"),
    tutorText: el("tutor-text"),
    loadingOverlay: el("loading-overlay"),
    loadingText: el("loading-text"),
    btnSettings: el("btn-settings"),
    btnSettingsBack: el("btn-settings-back"),
    inputToggleAI: el("input-toggle-ai"),
    inputApiKey: el("input-api-key"),
    inputModel: el("input-model"),
    settingsStatus: el("settings-status"),
    btnTestAI: el("btn-test-ai"),
    btnSaveAI: el("btn-save-ai"),
    inputVoice: el("input-voice"),
    btnTestVoice: el("btn-test-voice"),
    modeListenBtn: el("mode-listen"),
    modeReadBtn: el("mode-read"),
    difficultyChips: el("difficulty-chips"),
    categoryChips: el("category-chips"),
    lengthChips: el("length-chips"),
    inputModeChips: el("input-mode-chips"),
    ruleTip: el("rule-tip"),
    ruleTipText: el("rule-tip-text"),
    studyRuleTip: el("study-rule-tip"),
    studyRuleTipText: el("study-rule-tip-text"),
    typedInputRow: el("typed-input-row"),
    typedInput: el("typed-input"),
    btnTypedCheck: el("btn-typed-check"),
    choiceRow: el("choice-row"),
    timedChips: el("timed-chips"),
    spellingStyleChips: el("spelling-style-chips"),
    timerPill: el("timer-pill"),
    timerSeconds: el("timer-seconds"),
    studyOverlay: el("study-overlay"),
    studyWord: el("study-word"),
    studyHint: el("study-hint"),
    studyMeaning: el("study-meaning"),
    studyPos: el("study-pos"),
    studyDef: el("study-def"),
    studyRelated: el("study-related"),
    studyExamplesWrap: el("study-examples-wrap"),
    studyExamples: el("study-examples"),
    btnStudyListen: el("btn-study-listen"),
    btnTypedListen: el("btn-typed-listen"),
    btnStudyReady: el("btn-study-ready"),
    inputToggleElevenlabs: el("input-toggle-elevenlabs"),
    inputElevenlabsKey: el("input-elevenlabs-key"),
    inputElevenlabsVoice: el("input-elevenlabs-voice"),
    btnLoadElevenlabsVoices: el("btn-load-elevenlabs-voices"),
    elevenlabsStatus: el("elevenlabs-status"),
    btnTestElevenlabs: el("btn-test-elevenlabs"),
    inputToggleNeural: el("input-toggle-neural"),
    inputNeuralVoice: el("input-neural-voice"),
    neuralFields: el("neural-fields"),
    neuralProgress: el("neural-progress"),
    neuralProgressFill: el("neural-progress-fill"),
    neuralStatus: el("neural-status"),
    btnTestNeural: el("btn-test-neural"),
    btnNeuralAll: el("btn-neural-all"),
    inputToggleSound: el("input-toggle-sound"),
    inputToggleHaptic: el("input-toggle-haptic"),
    inputToggleTheme: el("input-toggle-theme"),
    btnHistory: el("btn-history"),
    btnHistoryBack: el("btn-history-back"),
    histBest: el("hist-best"),
    histMastered: el("hist-mastered"),
    histSessions: el("hist-sessions"),
    historyDueList: el("history-due-list"),
    historyMasteredList: el("history-mastered-list"),
    historyPatternsList: el("history-patterns-list"),
    summaryTitle: el("summary-title"),
    summarySubtitle: el("summary-subtitle"),
    summaryCorrect: el("summary-correct"),
    summaryStreak: el("summary-streak"),
    summaryMastered: el("summary-mastered"),
    summaryMasteredSection: el("summary-mastered-section"),
    summaryMasteredList: el("summary-mastered-list"),
    summaryReviewSection: el("summary-review-section"),
    summaryReviewList: el("summary-review-list"),
    btnPracticeAgain: el("btn-practice-again"),
    btnSummaryDone: el("btn-summary-done"),
    btnReviewDue: el("btn-review-due"),
    btnHistoryReview: el("btn-history-review"),
    btnRetryMissed: el("btn-retry-missed"),
    sessionPosition: el("session-position"),
    roundResult: el("round-result"),
    roundResultText: el("round-result-text"),
    btnNextWord: el("btn-next-word"),
  };

  // ---------- persistence ----------
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.srs) parsed.srs = {};
        if (!parsed.patternMistakes) parsed.patternMistakes = {};
        return parsed;
      }
    } catch (e) {}
    return { bestStreak: 0, curStreak: 0, learned: [], missed: {}, srs: {}, sessionsCompleted: 0, patternMistakes: {} };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("spellit-change"));
  }

  let data = loadData();
  if (typeof data.sessionsCompleted !== "number") data.sessionsCompleted = 0;

  function updateHomeStats() {
    ui.statBest.textContent = data.bestStreak;
    ui.statCorrect.textContent = countMastered();
    ui.statDue.textContent = countDueToday();
    const due = getDueEntries().length;
    ui.btnReviewDue.classList.toggle("hidden", !due);
    ui.btnReviewDue.textContent = `Review ${due} due ${due === 1 ? "word" : "words"} →`;
    renderLearningPath();
  }

  function renderLearningPath() {
    const path = SpellLearning.pathStatus();
    el("ai-lab-level").textContent = `Level ${path.next?.level || 5}`;
    el("btn-ai-lesson").textContent = window.SpellAI?.isEnabled() ? "Learn 5 new words" : "Set up AI words →";
    el("path-count").textContent = `${path.completed} / ${path.lessons.length} lessons`;
    const list = el("path-levels");
    list.replaceChildren();
    const descriptions = ["First everyday words", "Common words and tricky letters", "Longer words and spelling patterns", "Challenging everyday vocabulary", "Advanced and unusual spellings"];
    for (let level = 1; level <= 5; level++) {
      const lessons = path.lessons.filter(l => l.level === level);
      const done = path.lessons.slice(0, path.completed).filter(l => l.level === level).length;
      const current = path.next?.level === level;
      const row = document.createElement("li");
      row.className = `path-level${current ? " current" : ""}${done === lessons.length ? " complete" : ""}`;
      if (current) row.setAttribute("aria-current", "step");
      const heading = document.createElement("strong");
      heading.textContent = `${level}. ${["Beginner", "Easy", "Medium", "Hard", "Expert"][level - 1]}`;
      const detail = document.createElement("span");
      detail.textContent = `${descriptions[level - 1]} · ${done}/${lessons.length} lessons · ${done === lessons.length ? "Complete" : current ? "Current" : "Locked"}`;
      row.append(heading, detail);
      list.append(row);
    }
    el("path-description").textContent = path.next
      ? `Level ${path.next.level} · Lesson ${path.next.number} · ${path.next.entries.length} words`
      : "All five levels complete! Keep reviewing your words on later days to build lasting recall.";
    el("btn-path-start").textContent = path.next
      ? `${path.completed ? "Continue" : "Start"} Level ${path.next.level} →`
      : "Review final lesson →";
  }

  function startPathLesson(phase = "learn") {
    if (session.active) return;
    const path = SpellLearning.pathStatus();
    const lesson = path.next || path.lessons[path.lessons.length - 1];
    startSession(shuffleArray(lesson.entries.map(applyVariant)), {
      kind: "path", pathLesson: lesson.id, pathPhase: phase, fullLength: true,
      title: `Level ${lesson.level} · Lesson ${lesson.number}`,
    });
  }

  function isLearningLesson() { return ["path", "ai-lesson"].includes(session.kind); }
  let aiGeneration = null;
  let recentAIWords = [];

  function cancelAILesson() {
    aiGeneration?.abort();
    aiGeneration = null;
    el("btn-ai-lesson").disabled = false;
    el("btn-ai-cancel").classList.add("hidden");
  }

  async function startAILesson() {
    if (session.active || aiGeneration) return;
    if (!SpellAI.isEnabled()) {
      openSettings();
      ui.settingsStatus.textContent = "Add your OpenRouter API key, turn on AI-generated words, then Save. Return home to start an AI lesson.";
      ui.inputApiKey.focus();
      return;
    }
    const level = SpellLearning.pathStatus().next?.level || 5;
    const difficulty = ["beginner", "easy", "medium", "hard", "expert"][level - 1];
    const controller = new AbortController();
    aiGeneration = controller;
    el("btn-ai-lesson").disabled = true;
    el("btn-ai-cancel").classList.remove("hidden");
    el("ai-lab-status").textContent = `Preparing new ${difficulty} words…`;
    try {
      const words = await SpellAI.generateWordBatch(5, {
        difficulty, spellingStyle, weakPatterns: topWeakPatterns(3), signal: controller.signal,
        recentWords: [...new Set([...data.learned, ...Object.keys(data.srs), ...recentAIWords])].slice(-500),
      });
      if (aiGeneration !== controller || controller.signal.aborted || session.active) return;
      recentAIWords = [...recentAIWords, ...words.map(w => w.word)].slice(-500);
      el("ai-lab-status").textContent = `${words.length} new words ready. Generate another batch whenever you're ready.`;
      startSession(words, { kind: "ai-lesson", fullLength: true, title: `AI · Level ${level}`, pathPhase: "learn" });
    } catch (err) {
      if (aiGeneration !== controller) return;
      el("ai-lab-status").textContent = err.name === "AbortError"
        ? "The request timed out. Try again when you're ready."
        : (err instanceof TypeError ? "Couldn't connect to AI. Check your internet connection and try again." : err.message);
    } finally {
      if (aiGeneration === controller) cancelAILesson();
    }
  }

  // ---------- coach progress display ----------
  function renderCoachProgress() {
    const stats = window.SpellCoach.getStats(data, data.srs);
    const el = document.getElementById("coach-stats-section");
    if (!el) return;
    const level = window.SpellCoach.getLevel();
    const levelName = window.SpellCoach.getLevelName();

    let html = `<div class="coach-stats">`;

    // Level indicator
    html += `<div class="coach-stat-row">
      <span class="coach-stat-label">Free-practice level</span>
      <span class="coach-level-badge">${level ? `${levelName} (L${level})` : "Not assessed"}</span>
    </div>`;

    if (stats.isAssessed) {
      if (stats.firstTryAccuracy !== null) {
        html += `<div class="coach-stat-row">
          <span class="coach-stat-label">First-try accuracy</span>
          <span class="coach-stat-value">${stats.firstTryAccuracy}%</span>
        </div>`;
      }
      if (stats.recalledLater > 0) {
        html += `<div class="coach-stat-row">
          <span class="coach-stat-label">Words recalled on later days</span>
          <span class="coach-stat-value">${stats.recalledLater}</span>
        </div>`;
      }
      if (stats.mastered > 0) {
        html += `<div class="coach-stat-row">
          <span class="coach-stat-label">Words mastered</span>
          <span class="coach-stat-value">${stats.mastered}</span>
        </div>`;
      }
      if (stats.masteredToday > 0) {
        html += `<div class="coach-stat-row">
          <span class="coach-stat-label">Mastered today</span>
          <span class="coach-stat-value">${stats.masteredToday}</span>
        </div>`;
      }
    }

    if (stats.totalPracticed === 0) {
      html += `<div class="coach-empty-state">
        <p>No words practised yet. Start a practice session to begin your learning journey.</p>
      </div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
  }

  // ---------- coach assessment ----------
  function startAssessment() {
    if (!window.SpellCoach) return;
    const words = window.SpellCoach.assessmentWords(WORD_LIST, applyVariant);
    if (!words.length) return;
    const assessmentSession = {
      id: crypto.randomUUID(),
      index: 0,
      active: true,
      aiWords: null,
      aiIndex: 0,
      correctCount: 0,
      independentCount: 0,
      assistedCount: 0,
      totalCount: 0,
      bestStreakThisSession: 0,
      masteredThisSession: [],
      missedWordsThisSession: new Set(),
      reviewWords: words,
      length: words.length,
      seenWords: new Set(),
      kind: "assessment",
      title: "Level assessment",
      date: null,
      answerMode: "type",       // force typed input — tiles supply letters, choice gives answers
      forceListen: true,        // assessment must use listen mode, never read (which reveals answer)
      assessmentResults: {},
    };
    data.curStreak = 0;
    saveData();
    ui.curStreak.textContent = 0;
    hideTutor();
    hideRoundTimer();
    updateInputModeVisibility();
    if (window.SpellSFX) SpellSFX.unlock();
    showScreen("game");
    session = assessmentSession;
    startRound();
  }

  // ---------- spaced repetition (lightweight SRS) ----------
  // Pure scheduling logic lives in srs.js so it can be unit-tested.
  const SRS = window.SpellSRS;
  const MASTERY_REPS = SRS.MASTERY_REPS;

  function countDueToday() {
    const now = Date.now();
    return Object.values(data.srs).filter((rec) => SRS.isDue(rec, now)).length;
  }

  function countMastered() {
    return Object.values(data.srs).filter(SRS.isMastered).length;
  }

  function srsWeight(word) {
    return SRS.weight(data.srs[word], Date.now());
  }

  function updateSrsOnResult(word, wasClean) {
    const prev = data.srs[word];
    const canBump = window.SpellCoach ? window.SpellCoach.canIncrementMastery : null;
    const next = SRS.schedule({
      rec: prev,
      wasClean,
      now: Date.now(),
      word,
      canBumpMastery: canBump || undefined,
    });
    // Preserve fields the scheduler doesn't own.
    const { _source, ...cleanEntry } = round.entry;
    next.entry = cleanEntry;
    const previousAssisted = prev && prev.assistedReviews ? prev.assistedReviews : 0;
    if (round.assisted) next.assistedReviews = previousAssisted + 1;
    else if (previousAssisted) next.assistedReviews = previousAssisted;
    data.srs[word] = next;
    saveData();
  }

  // ---------- weak spelling patterns ----------
  function trackPatternMistake(entry) {
    if (!entry || !entry.rule) return;
    if (!data.patternMistakes) data.patternMistakes = {};
    data.patternMistakes[entry.rule] = (data.patternMistakes[entry.rule] || 0) + 1;
    saveData();
  }

  function topWeakPatterns(limit) {
    return Object.entries(data.patternMistakes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([rule, count]) => ({ rule, label: RULE_LABELS[rule] || rule, count }));
  }

  // ---------- speech ----------
  const VOICE_KEY = "spellit_voice";
  let speechRequestId = 0;
  function setSpeechButtonsSpeaking(isSpeaking) {
    for (const button of [ui.speakBtn, ui.btnStudyListen, ui.btnTypedListen]) {
      button?.classList.toggle("speaking", isSpeaking);
    }
  }
  // Names of "novelty" system voices (macOS) that read as robotic/unsettling for a learning app.
  const NOVELTY_VOICES = new Set([
    "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Good News",
    "Jester", "Organ", "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox",
    "Albert", "Fred", "Ralph", "Kathy", "Junior", "Hysterical", "Deranged",
  ]);
  const PREFERRED_VOICE_NAMES = [
    "Samantha", "Ava", "Alex", "Nicky", "Allison", "Susan", "Zoe",
    "Karen", "Daniel", "Moira", "Tessa",
    "Google US English", "Google UK English Female",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Jenny Online (Natural) - English (United States)",
  ];

  function getEnglishVoices() {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  }

  function pickBestVoice() {
    const voices = getEnglishVoices();
    if (!voices.length) return null;

    const savedName = localStorage.getItem(VOICE_KEY);
    if (savedName) {
      const saved = voices.find((v) => v.name === savedName);
      if (saved) return saved;
    }
    // Highest score wins; the sort is stable, so equal scores keep the browser's own order.
    return voices.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0];
  }

  // Free quality boost: the device's neural/premium voices sound far less robotic than its
  // default ones, but are rarely first in the list. Rank them ahead of the named favourites.
  function voiceScore(v) {
    if (NOVELTY_VOICES.has(v.name)) return -1;
    let score = 0;
    const tier = [/premium/i, /enhanced/i, /natural|neural/i].findIndex((re) => re.test(v.name));
    if (tier >= 0) score = 100 - tier * 10;                    // premium > enhanced > natural/neural
    else if (/online/i.test(v.name) || v.localService === false) score = 60; // cloud voices (Edge, Google)
    else {
      const favourite = PREFERRED_VOICE_NAMES.indexOf(v.name);
      if (favourite >= 0) score = 50 - favourite;
    }
    const wanted = spellingStyle === "uk" ? "en-gb" : "en-us";
    return v.lang && v.lang.toLowerCase().replace("_", "-") === wanted ? score + 5 : score;
  }

  let deviceUtterance = null; // also keeps a reference: Chrome can garbage-collect a playing utterance and never fire onend
  let deviceSpeechToken = 0;

  function speakDevice(text, isRetry = false) {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const token = ++deviceSpeechToken;
    const start = () => {
      if (token !== deviceSpeechToken) return; // a newer request replaced this one
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice();
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = spellingStyle === "uk" ? "en-GB" : "en-US";
      }
      utter.rate = 0.95;
      utter.pitch = 1.0;
      let started = false;
      utter.onstart = () => { started = true; };
      utter.onend = () => { if (deviceUtterance === utter) setSpeechButtonsSpeaking(false); };
      utter.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return; // we cancelled it ourselves
        console.warn("Device speech failed:", e.error);
        if (deviceUtterance === utter) setSpeechButtonsSpeaking(false);
      };
      deviceUtterance = utter;
      setSpeechButtonsSpeaking(true);
      synth.speak(utter);
      // A wedged engine (a Chrome/Safari quirk) queues the utterance but never starts it.
      // Reset it and try once more; if that fails too, stop showing the speaking state.
      setTimeout(() => {
        if (started || deviceUtterance !== utter) return;
        if (isRetry) { setSpeechButtonsSpeaking(false); return; }
        synth.cancel();
        speakDevice(text, true);
      }, 2500);
    };
    // Chrome drops an utterance spoken in the same tick as cancel(), so wait a moment after one.
    // Not cancelling an idle engine keeps the speech inside the tap that triggered it, which iOS requires.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(start, 60);
    } else {
      start();
    }
  }

  // iOS Safari and Chrome only allow speech and audio that begin with a tap, but words are spoken on a
  // timer after the tap (and, for ElevenLabs, after a download). Prime both engines on the first gesture.
  function unlockSpeech() {
    for (const type of ["pointerdown", "keydown"]) document.removeEventListener(type, unlockSpeech, true);
    try {
      if ("speechSynthesis" in window) {
        const silent = new SpeechSynthesisUtterance(" ");
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
    } catch (e) { /* speech unavailable; nothing to prime */ }
    window.SpellTTS?.unlock?.();
  }
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, unlockSpeech, true);

  // Voice priority: ElevenLabs (the learner's own paid key), then the free natural voice, then the
  // device voice. Any engine that fails, or is not ready yet, hands that one word to the next.
  function speak(text) {
    const requestId = ++speechRequestId;
    const engine = window.SpellTTS && SpellTTS.isEnabled()
      ? { name: "ElevenLabs", run: () => SpellTTS.speak(text) }
      : window.SpellNeural && SpellNeural.isEnabled()
        ? { name: "Natural voice", run: () => SpellNeural.speak(text, { timeoutMs: 4000 }) }
        : null;
    if (!engine) {
      speakDevice(text);
      return;
    }
    setSpeechButtonsSpeaking(true);
    engine.run()
      .then(() => { if (requestId === speechRequestId) setSpeechButtonsSpeaking(false); })
      .catch((err) => {
        if (requestId !== speechRequestId) return;
        console.warn(`${engine.name} speech unavailable, falling back to device voice:`, err);
        setSpeechButtonsSpeaking(false);
        speakDevice(text);
      });
  }

  // Have the natural voice prepare words before the learner reaches them.
  function prefetchVoices(entries) {
    if (window.SpellNeural && SpellNeural.isEnabled()) SpellNeural.prefetch(entries.map((e) => e.word));
  }

  function populateVoiceSelect() {
    const voices = getEnglishVoices();
    const nonNovelty = voices.filter((v) => !NOVELTY_VOICES.has(v.name));
    const listed = (nonNovelty.length ? nonNovelty : voices).slice().sort((a, b) => a.name.localeCompare(b.name));
    const current = pickBestVoice();

    ui.inputVoice.innerHTML = "";
    for (const v of listed) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (current && v.name === current.name) opt.selected = true;
      ui.inputVoice.appendChild(opt);
    }
  }

  // ---------- practice mode: listen & spell vs. read & spell ----------
  const MODE_KEY = "spellit_practice_mode";
  let practiceMode = localStorage.getItem(MODE_KEY) === "read" ? "read" : "listen";

  function setPracticeMode(mode) {
    practiceMode = mode;
    localStorage.setItem(MODE_KEY, mode);
    ui.modeListenBtn.classList.toggle("active", mode === "listen");
    ui.modeReadBtn.classList.toggle("active", mode === "read");
  }

  // ---------- session length: sprint / standard / long ----------
  const LENGTH_KEY = "spellit_session_length";
  const savedLength = Number(localStorage.getItem(LENGTH_KEY));
  let SESSION_LENGTH = [5, 10, 20].includes(savedLength) ? savedLength : 10;

  function setSessionLength(n) {
    SESSION_LENGTH = n;
    localStorage.setItem(LENGTH_KEY, String(n));
    for (const chip of ui.lengthChips.querySelectorAll(".chip")) {
      chip.classList.toggle("active", Number(chip.dataset.value) === n);
    }
  }

  // ---------- answer input method: letter tiles vs. typed ----------
  const INPUT_MODE_KEY = "spellit_input_mode";
  const VALID_INPUT_MODES = ["tiles", "type", "choice"];
  let inputMode = VALID_INPUT_MODES.includes(localStorage.getItem(INPUT_MODE_KEY)) ? localStorage.getItem(INPUT_MODE_KEY) : "tiles";

  function setInputMode(mode) {
    inputMode = mode;
    localStorage.setItem(INPUT_MODE_KEY, mode);
    for (const chip of ui.inputModeChips.querySelectorAll(".chip")) {
      chip.classList.toggle("active", chip.dataset.value === mode);
    }
    updateInputModeVisibility();
  }

  // ---------- timed challenge ----------
  const TIMED_KEY = "spellit_timed_mode";
  const TIMED_SECONDS = 15;
  let timedMode = localStorage.getItem(TIMED_KEY) === "on";
  let roundTimerInterval = null;
  let roundTimeLeft = 0;

  function setTimedMode(mode) {
    timedMode = mode === "on";
    localStorage.setItem(TIMED_KEY, mode);
    for (const chip of ui.timedChips.querySelectorAll(".chip")) {
      chip.classList.toggle("active", chip.dataset.value === mode);
    }
  }

  function updateTimerUI() {
    ui.timerSeconds.textContent = roundTimeLeft;
    ui.timerPill.classList.toggle("urgent", roundTimeLeft <= 5);
  }

  function startRoundTimer() {
    clearRoundTimer();
    roundTimeLeft = TIMED_SECONDS;
    ui.timerPill.classList.add("show");
    updateTimerUI();
    roundTimerInterval = setInterval(() => {
      roundTimeLeft -= 1;
      updateTimerUI();
      if (roundTimeLeft <= 0) {
        clearRoundTimer();
        if (round && !round.done) finishRoundAsWrong("(timeout)", 1);
      }
    }, 1000);
  }

  function clearRoundTimer() {
    if (roundTimerInterval) {
      clearInterval(roundTimerInterval);
      roundTimerInterval = null;
    }
  }

  function hideRoundTimer() {
    clearRoundTimer();
    ui.timerPill.classList.remove("show");
  }

  // ---------- spelling style: American vs British ----------
  const SPELLING_STYLE_KEY = "spellit_spelling_style";
  let spellingStyle = localStorage.getItem(SPELLING_STYLE_KEY) === "uk" ? "uk" : "us";
  window.SpellNeural?.setAccent(spellingStyle);

  function setSpellingStyle(style) {
    spellingStyle = style;
    window.SpellNeural?.setAccent(style);
    localStorage.setItem(SPELLING_STYLE_KEY, style);
    for (const chip of ui.spellingStyleChips.querySelectorAll(".chip")) {
      chip.classList.toggle("active", chip.dataset.value === style);
    }
  }

  function applyVariant(entry) {
    if (spellingStyle === "uk" && entry.variants && entry.variants.uk) {
      return { ...entry, word: entry.variants.uk };
    }
    return entry;
  }

  function updateInputModeVisibility() {
    const mode = answerMode();
    const isTiles = mode === "tiles";
    const isTyped = mode === "type";
    const isChoice = mode === "choice";
    ui.answerRow.classList.toggle("hidden", !isTiles);
    ui.rack.classList.toggle("hidden", !isTiles);
    ui.typedInputRow.classList.toggle("show", isTyped);
    ui.choiceRow.classList.toggle("show", isChoice);
    ui.btnClear.classList.toggle("hidden", !isTiles);
    ui.speakBtn.classList.toggle("hidden", isTyped);
    ui.btnTypedListen.classList.toggle("hidden", !isTyped);
  }

  // ---------- difficulty & category filters ----------
  const DIFFICULTY_KEY = "spellit_difficulty";
  const CATEGORY_KEY = "spellit_category";
  let currentDifficulty = localStorage.getItem(DIFFICULTY_KEY) || "all";
  let currentCategory = localStorage.getItem(CATEGORY_KEY) || "all";

  function populateCategoryChips() {
    ui.categoryChips.innerHTML = "";
    for (const cat of WORD_CATEGORIES) {
      const btn = document.createElement("button");
      btn.className = "chip" + (cat.value === currentCategory ? " active" : "");
      btn.dataset.value = cat.value;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => setFilter("category", cat.value));
      ui.categoryChips.appendChild(btn);
    }
  }

  function setFilter(kind, value) {
    if (kind === "difficulty") {
      currentDifficulty = value;
      localStorage.setItem(DIFFICULTY_KEY, value);
      for (const chip of ui.difficultyChips.querySelectorAll(".chip")) {
        chip.classList.toggle("active", chip.dataset.value === value);
      }
    } else {
      currentCategory = value;
      localStorage.setItem(CATEGORY_KEY, value);
      for (const chip of ui.categoryChips.querySelectorAll(".chip")) {
        chip.classList.toggle("active", chip.dataset.value === value);
      }
    }
  }

  function getFilteredWordList() {
    const filtered = WORD_LIST.filter(
      (w) =>
        (currentDifficulty === "all" || w.difficulty === currentDifficulty) &&
        (currentCategory === "all" || w.category === currentCategory)
    );
    return filtered.length ? filtered : WORD_LIST;
  }

  // ---------- word selection ----------
  let recentWords = [];

  function pickWord() {
    const available = getFilteredWordList();
    const unseen = available.filter((entry) => !session.seenWords.has(applyVariant(entry).word));
    const pool = unseen.length ? unseen : available;
    const weighted = [];
    for (const rawEntry of pool) {
      const entry = applyVariant(rawEntry);
      const missCount = data.missed[entry.word] || 0;
      const recentPenalty = recentWords.includes(entry.word) ? 0 : 1;
      const weight = (1 + missCount * 3) * srsWeight(entry.word) * recentPenalty || 0.1;
      weighted.push({ entry, weight });
    }
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of weighted) {
      r -= w.weight;
      if (r <= 0) return w.entry;
    }
    return weighted[weighted.length - 1].entry;
  }

  // ---------- session / round state ----------
  let session = { index: 0, active: false, aiWords: null, aiIndex: 0 };
  let round = null; // { entry, tiles: [{id,letter,placed}], slots: [{tileId, locked} | null] indexed by position in the word }
  let tileIdCounter = 0;
  let roundIdCounter = 0;
  function answerMode() { return session.active ? session.answerMode : inputMode; }
  const roundTimeouts = new Set();

  function clearRoundTimeouts() {
    for (const timer of roundTimeouts) clearTimeout(timer);
    roundTimeouts.clear();
  }

  function afterRoundDelay(callback, delay) {
    const expectedRound = round;
    const expectedSession = session;
    const timer = setTimeout(() => {
      roundTimeouts.delete(timer);
      if (session === expectedSession && session.active && round === expectedRound) callback();
    }, delay);
    roundTimeouts.add(timer);
  }

  function getReviewEntry(word) {
    const saved = data.srs[word]?.entry;
    const entry = saved || WORD_LIST.find((w) => w.word === word || Object.values(w.variants || {}).includes(word));
    return { ...(entry || {}), word, hint: entry?.hint || "Listen to the word, then spell it." };
  }

  function getDueEntries() {
    return Object.entries(data.srs)
      .filter(([, rec]) => rec.dueAt <= Date.now())
      .sort((a, b) => a[1].dueAt - b[1].dueAt)
      .map(([word]) => getReviewEntry(word));
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- multiple choice: plausible wrong-spelling distractors ----------
  function corruptWord(word) {
    const w = word.split("");
    const i = Math.floor(Math.random() * w.length);
    const type = Math.floor(Math.random() * 4);
    const vowels = "aeiou";
    if (type === 0 && w.length > 3) {
      const j = Math.min(i + 1, w.length - 1);
      [w[i], w[j]] = [w[j], w[i]]; // swap adjacent letters
    } else if (type === 1) {
      w.splice(i, 0, w[i]); // double a letter
    } else if (type === 2 && w.length > 4) {
      w.splice(i, 1); // drop a letter
    } else if (vowels.includes(w[i])) {
      let repl;
      do {
        repl = vowels[Math.floor(Math.random() * vowels.length)];
      } while (repl === w[i]);
      w[i] = repl; // swap a vowel
    } else {
      w.splice(i, 0, w[i]); // fallback: double a letter
    }
    return w.join("");
  }

  function generateDistractors(word, count) {
    const seen = new Set([word]);
    const result = [];
    let attempts = 0;
    while (result.length < count && attempts < 40) {
      attempts++;
      const candidate = corruptWord(word);
      if (!seen.has(candidate)) {
        seen.add(candidate);
        result.push(candidate);
      }
    }
    while (result.length < count) {
      result.push(word + "x".repeat(result.length + 1));
    }
    return result;
  }

  function renderChoices(entry) {
    const word = entry.word;
    const options = shuffleArray([word, ...generateDistractors(word, 3)]);
    ui.choiceRow.innerHTML = "";
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = opt;
      btn.dataset.word = opt;
      btn.addEventListener("click", () => checkChoiceAnswer(opt, btn));
      ui.choiceRow.appendChild(btn);
    }
  }

  function checkChoiceAnswer(selected, btnEl) {
    if (!round || round.done) return;
    const word = round.entry.word;
    const allBtns = [...ui.choiceRow.querySelectorAll(".choice-btn")];
    allBtns.forEach((b) => (b.disabled = true));
    if (selected === word) {
      btnEl.classList.add("correct");
      round.done = true;
      onRoundSuccess();
    } else {
      btnEl.classList.add("wrong");
      const correctBtn = allBtns.find((b) => b.dataset.word === word);
      if (correctBtn) correctBtn.classList.add("correct");
      finishRoundAsWrong(selected, 1);
    }
  }

  function buildRound(entry) {
    const letters = entry.word.split("");
    const shuffled = shuffleArray([...letters]);
    if (shuffled.join("") === entry.word && new Set(letters).size > 1) {
      const different = shuffled.findIndex((letter) => letter !== shuffled[0]);
      [shuffled[0], shuffled[different]] = [shuffled[different], shuffled[0]];
    }

    const tiles = shuffled.map((letter) => ({
      id: ++tileIdCounter,
      letter,
      placed: false,
    }));

    return {
      id: ++roundIdCounter,
      entry,
      tiles,
      slots: new Array(letters.length).fill(null),
      attempts: [],
      hadError: false,
      done: false,
      checking: false,
      assisted: false,
      hintLevel: 0,
      proofSelected: false,
    };
  }

  function nextEntry() {
    if (session.reviewWords) return session.reviewWords[session.index];
    if (session.aiWords && session.aiIndex < session.aiWords.length) {
      const entry = applyVariant(session.aiWords[session.aiIndex++]);
      session.seenWords.add(entry.word);
      recentWords.push(entry.word);
      if (recentWords.length > 6) recentWords.shift();
      return entry;
    }
    const entry = pickWord();
    session.seenWords.add(entry.word);
    recentWords.push(entry.word);
    if (recentWords.length > 4) recentWords.shift();
    return entry;
  }

  function applyRuleTip(entry) {
    const tip = entry.rule && RULE_TIPS[entry.rule];
    ui.ruleTip.classList.remove("show");
    ui.ruleTipText.textContent = tip || "";
    ui.studyRuleTip.classList.toggle("show", !!tip);
    ui.studyRuleTipText.textContent = tip || "";
  }

  function startRound() {
    if (!session.active) return;
    speechRequestId += 1;
    window.speechSynthesis && window.speechSynthesis.cancel();
    window.SpellTTS && SpellTTS.stop();
    setSpeechButtonsSpeaking(false);
    clearRoundTimeouts();
    hideTutor();
    hideCoachFeedback();
    setTeachingInert(false);
    ui.btnStudyReady.disabled = false;
    el("study-copy-panel").classList.add("hidden");
    el("study-heading").textContent = "Study the word";
    ui.btnStudyReady.textContent = "I'm ready — spell it →";
    ui.roundResult.classList.add("hidden");
    ui.feedbackBanner.className = "feedback-banner";
    const entry = nextEntry();
    round = buildRound(entry);
    const prefix = isLearningLesson() ? (session.pathPhase === "learn" ? "Learn" : "Final check") : session.kind === "proofread" ? "Sentence" : session.kind === "daily" ? "Daily word" : session.reviewWords ? "Review" : "Word";
    ui.sessionPosition.textContent = `${prefix} ${session.index + 1} of ${session.length}${session.title ? ` · ${session.title}` : ""}`;
    ui.btnSkip.disabled = false;
    ui.btnSkip.classList.toggle("hidden", isLearningLesson() && session.pathPhase === "learn");
    ui.typedInput.disabled = false;
    ui.btnTypedCheck.disabled = false;
    ui.hintText.textContent = "";
    el("btn-hint").disabled = false;
    el("btn-hint").textContent = "Need a hint?";
    el("btn-learn-word").classList.toggle("hidden", !isLearningLesson());
    el("btn-learn-word").disabled = false;
    el("hint-level").textContent = "";
    el("proofread-panel").classList.toggle("hidden", session.kind !== "proofread");
    ui.speakBtn.classList.remove("hidden");
    updateInputModeVisibility();
    ui.progressFill.style.width = `${(session.index / session.length) * 100}%`;
    applyRuleTip(entry);
    renderAll();

    if (answerMode() === "type") {
      ui.typedInput.value = "";
      ui.typedInput.classList.remove("wrong");
    } else if (answerMode() === "choice") {
      renderChoices(entry);
    }

    if (isLearningLesson() && session.pathPhase === "learn") {
      teachCurrentWord();
    } else if (session.kind === "proofread") {
      ui.studyOverlay.classList.remove("show");
      ui.speakBtn.classList.add("hidden");
      ui.typedInputRow.classList.remove("show");
      renderProofread(entry);
      if (timedMode && !isLearningLesson()) startRoundTimer();
    } else if (practiceMode === "read" && !session.forceListen) {
      ui.studyWord.textContent = entry.word.toUpperCase();
      ui.studyHint.textContent = entry.hint || "";
      renderStudyMeaning(entry);
      renderStudyExamples(entry);
      ui.studyOverlay.classList.add("show");
      window.SpellPronounce?.mount(el("pronounce-coach"), entry, { speak });
    } else {
      ui.studyOverlay.classList.remove("show");
      afterRoundDelay(() => speak(entry.word), 350);
      if (answerMode() === "type") afterRoundDelay(() => ui.typedInput.focus(), 400);
      if (timedMode && !isLearningLesson()) startRoundTimer();
    }
  }

  // Built-in words have a part of speech, definition and related words in meanings.js. It takes the
  // place of the one-line hint on the study card; custom-list and AI words keep showing their hint.
  function renderStudyMeaning(entry) {
    const meaning = window.SpellMeanings?.forEntry(entry);
    ui.studyMeaning.classList.toggle("hidden", !meaning);
    ui.studyHint.classList.toggle("hidden", !!meaning);
    if (!meaning) return;
    ui.studyPos.textContent = meaning.pos;
    ui.studyDef.textContent = meaning.definition;
    ui.studyRelated.textContent = meaning.related.length ? `Related: ${meaning.related.join(" · ")}` : "";
    ui.studyRelated.classList.toggle("hidden", !meaning.related.length);
  }

  // Built-in words have three example sentences in WORD_EXAMPLES, keyed by the US spelling.
  // Custom-list and AI words have none, so the section stays hidden for them.
  // AI words carry their own examples on the entry; the hand-written table wins when a word is in both.
  function examplesFor(entry) {
    return window.SpellWordInfo.examplesOf(entry);
  }

  function renderStudyExamples(entry) {
    const sentences = entry ? examplesFor(entry) : [];
    ui.studyExamples.replaceChildren();
    ui.studyExamplesWrap.classList.toggle("hidden", !sentences.length);
    for (const sentence of sentences) {
      const li = document.createElement("li");
      const spoken = SpellWordInfo.sentenceText(sentence, entry.word);
      li.append(...SpellWordInfo.sentenceNodes(sentence, entry.word),
        SpellWordInfo.listenButton("Listen to this example", () => speak(spoken)));
      ui.studyExamples.append(li);
    }
    // Have the natural voice ready before the learner presses a speaker button.
    if (sentences.length && window.SpellNeural && SpellNeural.isEnabled()) {
      SpellNeural.prefetch(sentences.map((s) => SpellWordInfo.sentenceText(s, entry.word)));
    }
  }

  function dismissStudyOverlay() {
    if (!session.active || !round || round.done) return;
    if (isLearningLesson() && ui.studyOverlay.classList.contains("show")) {
      if (el("study-copy").value.trim().toLowerCase() !== round.entry.word) {
        el("study-copy-status").textContent = "Look at the spelling above and copy each letter. You can try as often as you like.";
        el("study-copy").focus();
        return;
      }
    }
    ui.studyOverlay.classList.remove("show");
    setTeachingInert(false);
    // Remove the model spelling from the hidden card before recall.
    if (isLearningLesson()) {
      ui.studyWord.textContent = "";
      renderStudyExamples(null);
      el("study-copy").value = "";
      ui.typedInput.value = "";
      speak(round.entry.word);
    }
    if (answerMode() === "type") afterRoundDelay(() => ui.typedInput.focus(), 150);
    if (timedMode && !isLearningLesson()) startRoundTimer();
  }

  function setTeachingInert(value) {
    screens.game.querySelectorAll(".game-body > :not(#study-overlay)").forEach(node => { node.inert = value; });
  }

  function teachCurrentWord() {
    if (!session.active || !isLearningLesson() || !round || round.done || round.checking) return;
    clearRoundTimeouts();
    round.assisted = true;
    const entry = round.entry;
    ui.studyWord.textContent = entry.word.toUpperCase();
    ui.studyHint.textContent = entry.hint || "Listen to the word, then look closely at its letters.";
    renderStudyMeaning(entry);
    renderStudyExamples(entry);
    ui.studyRuleTipText.textContent = entry.memoryTip || window.SpellCoach.getMnemonic(entry.word, entry);
    ui.studyRuleTip.classList.add("show");
    el("study-heading").textContent = "Let's learn this word";
    el("study-copy-panel").classList.remove("hidden");
    el("study-copy").value = "";
    el("study-copy-status").textContent = session.pathPhase === "learn"
      ? "Take your time. Hints and mistakes here won't affect your final check."
      : "Let's practise it together. You can retry the final check afterwards.";
    ui.btnStudyReady.textContent = "Hide it & try from memory →";
    ui.studyOverlay.classList.add("show");
    setTeachingInert(true);
    window.SpellPronounce?.mount(el("pronounce-coach"), entry, { speak });
    el("study-copy").focus();
    speak(entry.word);
  }

  function renderAll() {
    renderRack();
    renderSlots();
  }

  function revealHint() {
    if (!session.active || !round || round.done || round.hintLevel >= 3) return;
    round.assisted = true;
    round.hintLevel++;
    const entry = round.entry;
    if (round.hintLevel === 1) {
      ui.hintText.textContent = entry.hint || "No definition saved for this word. Listen again, or reveal its letter groups.";
      el("btn-hint").textContent = "Show word parts";
    } else if (round.hintLevel === 2) {
      const known = PROOFREAD_WORDS.find(w => w.word === entry.word);
      const syllables = entry.syllables || known?.syllables;
      const valid = syllables && syllables.replace(/-/g, "") === entry.word;
      // When curated syllables aren't available, label mechanical groups honestly.
      ui.hintText.textContent = valid ? `Syllables: ${syllables.split("-").join(" · ")}` : `Letter groups: ${entry.word.match(/.{1,3}/g).join(" · ")}`;
      ui.ruleTip.classList.toggle("show", !!ui.ruleTipText.textContent);
      el("btn-hint").textContent = "Show first letter";
    } else {
      ui.hintText.textContent = `Starts with ${entry.word[0].toUpperCase()} · ${entry.word.length} letters. ${entry.hint || ""}`;
      el("btn-hint").textContent = "All hints shown";
      el("btn-hint").disabled = true;
    }
    el("hint-level").textContent = `Hint ${round.hintLevel} of 3 · Assisted answer`;
  }

  function renderProofread(entry) {
    const target = el("proofread-sentence"); target.replaceChildren();
    const wrong = PROOFREAD_MISTAKES[entry.word] || entry.word + entry.word.at(-1);
    const parts = entry.sentence.split("{word}");
    const renderText = text => {
      for (const token of text.split(/([a-zA-Z]+(?:['’][a-zA-Z]+)?)/)) {
        if (!/^[a-zA-Z]/.test(token)) { target.append(document.createTextNode(token)); continue; }
        const b = document.createElement("button"); b.className = "sentence-word"; b.textContent = token;
        b.addEventListener("click", () => {
          if (!session.active || round.done || round.proofSelected) return;
          round.hadError = true;
          el("proofread-status").textContent = `“${token}” is spelt correctly. Try another word.`;
          SpellLearning.recordAttempt(entry, `Selected “${token}” in the sentence`);
        });
        target.append(b);
      }
    };
    renderText(parts[0]);
    const errorWord = document.createElement("button"); errorWord.className = "sentence-word"; errorWord.textContent = wrong;
    errorWord.addEventListener("click", () => {
      if (!session.active || round.done || round.proofSelected) return;
      round.proofSelected = true;
      errorWord.classList.add("selected");
      target.querySelectorAll("button").forEach(b => { b.disabled = true; });
      el("proofread-status").textContent = "Found it. Now type the correct spelling below.";
      ui.typedInputRow.classList.add("show"); ui.speakBtn.classList.remove("hidden"); ui.typedInput.focus();
    });
    target.append(errorWord); renderText(parts[1]);
    el("proofread-status").textContent = "Tap the misspelled word, then type the correct spelling.";
  }

  function renderRack() {
    ui.rack.innerHTML = "";
    for (const tile of round.tiles) {
      const div = document.createElement("button");
      div.type = "button";
      div.disabled = tile.placed || round.done || round.checking;
      div.setAttribute("aria-label", `Letter ${tile.letter.toUpperCase()}`);
      div.className = "tile" + (tile.placed ? " placed" : "");
      div.textContent = tile.letter;
      div.dataset.id = tile.id;
      if (!tile.placed) {
        div.addEventListener("click", () => handleTileTap(tile.id));
      }
      ui.rack.appendChild(div);
    }
  }

  function renderSlots(highlight) {
    ui.answerRow.innerHTML = "";
    const wordLen = round.entry.word.length;
    for (let i = 0; i < wordLen; i++) {
      const slotDiv = document.createElement("button");
      slotDiv.type = "button";
      const filled = round.slots[i];
      slotDiv.disabled = !filled || filled.locked || round.done || round.checking;
      slotDiv.setAttribute("aria-label", filled ? `Remove letter ${i + 1}` : `Letter ${i + 1}, empty`);
      slotDiv.className = "slot" + (filled ? "" : " empty");
      if (filled) {
        const tile = round.tiles.find((t) => t.id === filled.tileId);
        slotDiv.textContent = tile.letter;
        if (highlight) {
          slotDiv.classList.add(filled.locked ? "correct" : "wrong");
        }
        if (!filled.locked) {
          slotDiv.addEventListener("click", () => handleSlotTap(i));
        }
      }
      ui.answerRow.appendChild(slotDiv);
    }
  }

  function handleTileTap(tileId) {
    if (!session.active || !round || round.done || round.checking) return;
    const emptyIndex = round.slots.findIndex((s) => s === null);
    if (emptyIndex === -1) return;
    const tile = round.tiles.find((t) => t.id === tileId);
    if (!tile || tile.placed) return;
    tile.placed = true;
    round.slots[emptyIndex] = { tileId, locked: false };
    renderAll();
    if (round.slots.every((s) => s !== null)) {
      afterRoundDelay(checkAnswer, 150);
    }
  }

  function handleSlotTap(index) {
    if (!session.active || !round || round.done || round.checking) return;
    const slot = round.slots[index];
    if (!slot || slot.locked) return;
    const tile = round.tiles.find((t) => t.id === slot.tileId);
    tile.placed = false;
    round.slots[index] = null;
    renderAll();
  }

  function checkAnswer() {
    if (!session.active || !round || round.done || round.checking || round.slots.some((slot) => !slot)) return;
    round.checking = true;
    const word = round.entry.word;
    let allCorrect = true;
    const attemptStr = round.slots
      .map((slot) => round.tiles.find((t) => t.id === slot.tileId).letter)
      .join("");
    round.slots.forEach((slot, i) => {
      const tile = round.tiles.find((t) => t.id === slot.tileId);
      slot.locked = tile.letter === word[i];
      if (!slot.locked) allCorrect = false;
    });
    renderSlots(true);

    if (allCorrect) {
      round.done = true;
      onRoundSuccess();
    } else {
      round.hadError = true;
      round.attempts.push(attemptStr);
      SpellLearning.recordAttempt(round.entry, attemptStr);
      feedbackWrong();
      trackPatternMistake(round.entry);
      if (window.SpellAI && SpellAI.isEnabled()) SpellAI.logMistake(word, attemptStr);
      if (!data.missed[word]) data.missed[word] = 0;
      data.missed[word] = Math.min(6, data.missed[word] + 1);
      saveData();
      afterRoundDelay(() => {
        // send wrong tiles back to rack; correct ones stay locked in their true position
        round.slots.forEach((slot, i) => {
          if (!slot || slot.locked) return;
          const tile = round.tiles.find((t) => t.id === slot.tileId);
          tile.placed = false;
          round.slots[i] = null;
        });
        round.checking = false;
        renderAll();
      }, 650);
    }
  }

  function checkTypedAnswer() {
    if (!session.active || !round || round.done || round.checking) return;
    if (ui.studyOverlay.classList.contains("show")) return;
    if (session.kind === "proofread" && !round.proofSelected) return;
    const word = round.entry.word;
    const attempt = ui.typedInput.value.trim().toLowerCase();
    if (!attempt) return;
    if (isLearningLesson() && session.pathPhase === "learn" && attempt !== word) {
      teachCurrentWord();
      el("study-copy-status").textContent = `You wrote “${attempt.slice(0, 40)}”. Look at the spelling above, copy it, then try again. No penalty.`;
      return;
    }

    if (attempt === word) {
      round.done = true;
      onRoundSuccess();
    } else {
      round.checking = true;
      round.hadError = true;
      round.attempts.push(attempt);
      SpellLearning.recordAttempt(round.entry, attempt.slice(0, 100));
      feedbackWrong();
      trackPatternMistake(round.entry);
      if (window.SpellAI && SpellAI.isEnabled()) SpellAI.logMistake(word, attempt);
      if (!data.missed[word]) data.missed[word] = 0;
      data.missed[word] = Math.min(6, data.missed[word] + 1);
      saveData();
      ui.typedInput.classList.add("wrong");
      afterRoundDelay(() => {
        round.checking = false;
        ui.typedInput.classList.remove("wrong");
        ui.typedInput.value = "";
        ui.typedInput.focus();
      }, 400);
    }
  }

  function feedbackWrong() {
    if (window.SpellSFX) {
      SpellSFX.playWrong();
      SpellSFX.vibrateWrong();
    }
  }

  function feedbackCorrect() {
    if (window.SpellSFX) {
      SpellSFX.playCorrect();
      SpellSFX.vibrateCorrect();
    }
  }

  function onRoundSuccess() {
    clearRoundTimer();
    const word = round.entry.word;
    if (isLearningLesson() && session.pathPhase === "learn") {
      session.index++;
      ui.progressFill.style.width = `${(session.index / session.length) * 100}%`;
      feedbackCorrect();
      showRoundResult(`You recalled ${word.toUpperCase()}. We'll check it again after learning the lesson's words.`);
      return;
    }
    if (!round.hadError && data.missed[word]) {
      data.missed[word] = Math.max(0, data.missed[word] - 1);
    }
    if (!data.learned.includes(word)) data.learned.push(word);

    const independent = !round.hadError && !round.assisted;
    data.curStreak = independent ? data.curStreak + 1 : 0;
    if (data.curStreak > data.bestStreak) data.bestStreak = data.curStreak;
    session.bestStreakThisSession = Math.max(session.bestStreakThisSession, data.curStreak);
    session.correctCount += 1;
    if (independent) session.independentCount++;
    if (round.assisted) session.assistedCount++;
    session.totalCount += 1;
    if (round.hadError || round.assisted) session.missedWordsThisSession.add(word);
    if (round.assisted && !round.hadError) SpellLearning.recordAttempt(round.entry, "Solved with a hint");
    if (session.kind === "daily") SpellLearning.dailyResult(session.date, round.entry, { clean: independent, assisted: round.assisted });
    if (session.kind === "assessment") {
      session.assessmentResults[word] = { clean: independent, assisted: round.assisted };
    }
    saveData();

    const wasMasteredBefore = !!(data.srs[word] && data.srs[word].reps >= MASTERY_REPS);
    updateSrsOnResult(word, independent);
    const isMasteredNow = !!(data.srs[word] && data.srs[word].reps >= MASTERY_REPS);
    if (!wasMasteredBefore && isMasteredNow) session.masteredThisSession.push(word);

    // Record with coach for adaptive levelling
    if (window.SpellCoach && !session.kind.startsWith("review")) {
      window.SpellCoach.recordResult(word, round.entry, independent, round.assisted, round.attempts.length === 0);
    }

    feedbackCorrect();

    ui.curStreak.textContent = data.curStreak;
    showFeedback("good", "Correct!");
    if (window.SpellDelight) {
      const source = document.querySelector(".answer-row") || document.querySelector(".game-body");
      window.SpellDelight.correct({ streak: data.curStreak, fromEl: source });
    }

    if (round.hadError) {
      showCoachFeedback(round);
      requestTutorFeedback(round);
    } else {
      hideTutor();
    }

    session.index += 1;
    ui.progressFill.style.width = `${(session.index / session.length) * 100}%`;

    if (round.assisted) showRoundResult(`Correct with a hint: ${word.toUpperCase()}. Try it independently next time.`);
    else if (round.hadError) showRoundResult(`You got it: ${word.toUpperCase()}. We'll practise this word again.`);
    else showRoundResult(`Correct spelling: ${word.toUpperCase()}`);
  }

  function finishRoundAsWrong(attemptText, missPenalty) {
    if (!session.active || !round || round.done) return;
    clearRoundTimer();
    round.done = true;
    round.hadError = true;
    const word = round.entry.word;
    if (attemptText) round.attempts.push(attemptText);
    SpellLearning.recordAttempt(round.entry, attemptText === "(timeout)" ? "Time ran out" : attemptText || "Skipped");
    if (round.assisted) session.assistedCount++;
    if (session.kind === "daily") SpellLearning.dailyResult(session.date, round.entry, { clean: false, assisted: round.assisted });
    if (session.kind === "assessment") {
      session.assessmentResults[word] = { clean: false, assisted: round.assisted };
    }
    data.missed[word] = Math.min(6, (data.missed[word] || 0) + missPenalty);
    data.curStreak = 0;
    session.totalCount += 1;
    session.missedWordsThisSession.add(word);
    saveData();
    updateSrsOnResult(word, false);
    trackPatternMistake(round.entry);
    // Record with coach
    if (window.SpellCoach) {
      window.SpellCoach.recordResult(word, round.entry, false, round.assisted, round.attempts.length <= 1);
    }
    feedbackWrong();
    ui.curStreak.textContent = 0;
    showFeedback("bad", `Answer: ${word.toUpperCase()}`);
    if (window.SpellDelight) window.SpellDelight.wrong();
    showCoachFeedback(round);
    requestTutorFeedback(round);

    session.index += 1;
    ui.progressFill.style.width = `${(session.index / session.length) * 100}%`;

    showRoundResult(`Correct spelling: ${word.toUpperCase()}`);
  }

  function showRoundResult(text) {
    clearRoundTimeouts();
    ui.feedbackBanner.className = "feedback-banner";
    ui.roundResultText.textContent = text;
    ui.roundResult.classList.remove("hidden");
    ui.btnNextWord.textContent = session.index >= session.length ? "See results" : "Next word →";
    ui.btnSkip.disabled = true;
    ui.typedInput.disabled = true;
    ui.btnTypedCheck.disabled = true;
    el("btn-hint").disabled = true;
    el("btn-learn-word").disabled = true;
    if (isLearningLesson() && session.pathPhase === "learn" && session.index >= session.length) {
      ui.btnNextWord.textContent = "Start final check →";
    }
    el("proofread-sentence").querySelectorAll("button").forEach(b => { b.disabled = true; });
    for (const choice of ui.choiceRow.querySelectorAll(".choice-btn")) {
      choice.disabled = true;
      choice.classList.toggle("correct", choice.dataset.word === round.entry.word);
    }
    ui.btnNextWord.focus();
  }

  function advanceRound() {
    if (!session.active || !round?.done) return;
    if (session.index >= session.length) finishSession();
    else startRound();
  }

  function skipRound() {
    if (!session.active || !round || round.done) return;
    if (isLearningLesson() && session.pathPhase === "learn") { teachCurrentWord(); return; }
    finishRoundAsWrong(null, 2);
  }

  // ---------- AI tutor ----------
  function showCoachFeedback(finishedRound) {
    if (!window.SpellCoach) return;
    const attemptText = finishedRound.attempts.length ? finishedRound.attempts[finishedRound.attempts.length - 1] : "";
    const feedbackHTML = window.SpellCoach.getFeedbackHTML(finishedRound.entry.word, attemptText, finishedRound.entry);
    // Show coach feedback above the tutor panel
    const existing = document.getElementById("coach-feedback-box");
    if (existing) existing.remove();
    const box = document.createElement("div");
    box.id = "coach-feedback-box";
    box.innerHTML = feedbackHTML;
    const tutorPanel = ui.tutorPanel;
    if (tutorPanel && tutorPanel.parentNode) {
      tutorPanel.parentNode.insertBefore(box, tutorPanel);
    }
    // Auto-remove after advancing
  }

  function hideCoachFeedback() {
    const existing = document.getElementById("coach-feedback-box");
    if (existing) existing.remove();
  }
  function showTutorLoading() {
    ui.tutorPanel.classList.add("show");
    ui.tutorText.classList.add("loading");
    ui.tutorText.textContent = "Coach is thinking";
  }

  function setTutorText(text) {
    ui.tutorText.classList.remove("loading");
    ui.tutorText.textContent = text;
    ui.tutorPanel.classList.add("show");
  }

  function hideTutor() {
    ui.tutorPanel.classList.remove("show");
    ui.tutorText.classList.remove("loading");
    ui.tutorText.textContent = "";
  }

  function requestTutorFeedback(finishedRound) {
    if (!window.SpellAI || !SpellAI.isEnabled()) return;
    const roundId = finishedRound.id;
    showTutorLoading();
    SpellAI.explainMistake({
      word: finishedRound.entry.word,
      hint: finishedRound.entry.hint || "",
      attempts: finishedRound.attempts,
    })
      .then((text) => {
        if (session.active && round && round.id === roundId) setTutorText(text);
      })
      .catch(() => {
        if (session.active && round && round.id === roundId) hideTutor();
      });
  }

  function showFeedback(type, text) {
    ui.feedbackBanner.textContent = text;
    ui.feedbackBanner.className = "feedback-banner show-" + type;
    afterRoundDelay(() => {
      ui.feedbackBanner.className = "feedback-banner";
    }, 850);
  }

  function clearRackSelection() {
    if (!session.active || !round || round.done || round.checking) return;
    round.slots.forEach((slot, i) => {
      if (!slot || slot.locked) return;
      const tile = round.tiles.find((t) => t.id === slot.tileId);
      tile.placed = false;
      round.slots[i] = null;
    });
    renderAll();
  }

  // ---------- navigation ----------
  function showScreen(name) {
    if (name !== "home" && aiGeneration) cancelAILesson();
    for (const key in screens) screens[key].classList.toggle("active", key === name);
    // Update bottom nav active state
    document.querySelectorAll(".bottom-nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.screen === name);
    });
    // Render content for certain screens
    if (name === "lists" && window.SpellFeatures && SpellFeatures.renderLists) SpellFeatures.renderLists();
    if (name === "home" && window.SpellFeatures) SpellFeatures.renderDaily();
    if (name === "home") renderLearningPath();
    if (!session.active) window.SpellSync?.schedule();
  }

  function updatePracticeSummary() {
    const inputLabel = { tiles: "Letter tiles", type: "Type it", choice: "Multiple choice" }[inputMode];
    const difficultyLabel = currentDifficulty === "all" ? "All levels" : currentDifficulty;
    el("practice-summary").textContent = `${SESSION_LENGTH} words · ${inputLabel} · ${difficultyLabel}${timedMode ? " · Timed" : ""}`;
    for (const button of screens.home.querySelectorAll(".chip, .mode-btn")) {
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    }
  }

  function startSession(reviewWords = null, options = {}) {
    if (session.active) return;
    if (reviewWords && !reviewWords.length) return;
    clearRoundTimeouts();
    round = null;
    session = {
      id: crypto.randomUUID(),
      index: 0,
      active: true,
      aiWords: null,
      aiIndex: 0,
      correctCount: 0,
      independentCount: 0,
      assistedCount: 0,
      totalCount: 0,
      bestStreakThisSession: 0,
      masteredThisSession: [],
      missedWordsThisSession: new Set(),
      reviewWords,
      length: reviewWords ? (options.fullLength ? reviewWords.length : Math.min(SESSION_LENGTH, reviewWords.length)) : SESSION_LENGTH,
      seenWords: new Set(),
      kind: options.kind || (reviewWords ? "review" : "practice"),
      title: options.title || "",
      date: options.date,
      answerMode: ["proofread", "path", "ai-lesson"].includes(options.kind) ? "type" : inputMode,
      forceListen: ["path", "ai-lesson"].includes(options.kind),
      pathLesson: options.pathLesson,
      pathPhase: options.pathPhase || "learn",
      returnPath: options.returnPath,
    };
    const startedSession = session;
    if (reviewWords) prefetchVoices(reviewWords);
    data.curStreak = 0;
    saveData();
    ui.curStreak.textContent = 0;
    hideTutor();
    hideRoundTimer();
    updateInputModeVisibility();
    if (window.SpellSFX) SpellSFX.unlock();

    if (!reviewWords && window.SpellCoach && window.SpellCoach.isAssessed() && !window.SpellAI?.isEnabled()) {
      // Use coach planning for personalised practice
      const plan = window.SpellCoach.planSession(SESSION_LENGTH, data, WORD_LIST, applyVariant);
      session.reviewWords = plan.entries;
      session.length = plan.entries.length;
      prefetchVoices(plan.entries);
      session.kind = "practice";
      ui.loadingOverlay.classList.remove("show");
      showScreen("game");
      startRound();
    } else if (!reviewWords && window.SpellAI && SpellAI.isEnabled()) {
      ui.loadingText.textContent = "Generating your words…";
      ui.loadingOverlay.classList.add("show");
      SpellAI.generateWordBatch(SESSION_LENGTH, {
        recentWords: data.learned.slice(-20),
        difficulty: currentDifficulty === "all" ? undefined : currentDifficulty,
        category: currentCategory === "all" ? undefined : currentCategory,
        weakPatterns: topWeakPatterns(3),
        spellingStyle,
      })
        .then((words) => {
          if (session !== startedSession || !session.active) return;
          session.aiWords = words;
          session.aiIndex = 0;
          prefetchVoices(words);
          ui.loadingOverlay.classList.remove("show");
          showScreen("game");
          startRound();
        })
        .catch((err) => {
          if (session !== startedSession || !session.active) return;
          console.warn("AI word generation failed, falling back to classic list:", err);
          ui.loadingOverlay.classList.remove("show");
          showScreen("game");
          startRound();
          showFeedback("bad", "AI unavailable — using classic words");
        });
    } else {
      showScreen("game");
      startRound();
    }
  }

  function endSession() {
    speechRequestId += 1;
    session.active = false;
    round = null;
    clearRoundTimeouts();
    window.speechSynthesis && window.speechSynthesis.cancel();
    window.SpellTTS && SpellTTS.stop();
    hideTutor();
    hideRoundTimer();
    ui.studyOverlay.classList.remove("show");
    setTeachingInert(false);
    updateHomeStats();
    showScreen("home");
  }

  function finishSession() {
    if (!session.active) return;
    if (isLearningLesson() && session.pathPhase === "learn") {
      // Learning never writes scores or passes lessons. Start a fresh recall check.
      const lastWord = round.entry.word;
      session.pathPhase = "check";
      session.index = 0;
      shuffleArray(session.reviewWords);
      if (session.reviewWords.length > 1 && session.reviewWords[0].word === lastWord) {
        session.reviewWords.push(session.reviewWords.shift());
      }
      startRound();
      return;
    }
    speechRequestId += 1;
    session.active = false;
    clearRoundTimeouts();
    data.sessionsCompleted += 1;
    ui.btnPracticeAgain.textContent = "Practice Again";
    SpellLearning.completeSession(session.id, {
      independent: session.independentCount, assisted: session.assistedCount, total: session.totalCount,
      ...(session.kind === "path" ? { pathLesson: session.pathLesson } : {}),
    }, data.sessionsCompleted);

    // Handle assessment completion
    if (session.kind === "assessment" && window.SpellCoach) {
      window.SpellCoach.recordAssessment(session.reviewWords, session.assessmentResults);
      saveData();
      window.speechSynthesis && window.speechSynthesis.cancel();
      window.SpellTTS && SpellTTS.stop();
      hideTutor();
      hideRoundTimer();
      hideCoachFeedback();
      ui.studyOverlay.classList.remove("show");
      updateHomeStats();
      // Show assessment summary on the normal summary screen instead of blocking alert.
      const level = window.SpellCoach.getLevel();
      const levelName = window.SpellCoach.getLevelName();
      const correct = session.correctCount;
      const total = session.totalCount;
      ui.summaryTitle.textContent = "Assessment complete!";
      ui.summarySubtitle.textContent = `You're starting at ${levelName} (level ${level}). We'll adjust your level automatically as you practice.`;
      ui.summaryCorrect.textContent = `${correct}/${total}`;
      ui.summaryStreak.textContent = session.bestStreakThisSession;
      ui.summaryMastered.textContent = session.masteredThisSession.length;
      el("summary-assistance").textContent = `${session.independentCount} independently · ${session.assistedCount} with hints`;
      ui.summaryMasteredSection.classList.add("hidden");
      ui.summaryReviewSection.classList.add("hidden");
      ui.btnRetryMissed.classList.add("hidden");
      showScreen("summary");
      return;
    }

    saveData();
    window.speechSynthesis && window.speechSynthesis.cancel();
    window.SpellTTS && SpellTTS.stop();
    hideTutor();
    hideRoundTimer();
    ui.studyOverlay.classList.remove("show");
    updateHomeStats();

    const correct = session.correctCount;
    const total = session.totalCount;
    const pct = total ? correct / total : 0;

    ui.summaryCorrect.textContent = `${correct}/${total}`;
    ui.summaryStreak.textContent = session.bestStreakThisSession;
    ui.summaryMastered.textContent = session.masteredThisSession.length;
    el("summary-assistance").textContent = `${session.independentCount} independently · ${session.assistedCount} with hints · ${session.totalCount - session.independentCount - session.assistedCount} to keep practising`;

    if (session.kind === "ai-lesson") {
      const passed = session.independentCount === session.length;
      ui.summaryTitle.textContent = passed ? "AI lesson complete!" : "Let's practise these words";
      ui.summarySubtitle.textContent = passed
        ? "Your words are saved for spaced review. Generate a fresh batch to keep exploring at your course level."
        : `${session.independentCount}/${session.length} recalled independently. Retry this check with the same words, without another AI request.`;
      ui.btnPracticeAgain.textContent = passed ? "Learn 5 more AI words →" : "Retry final check →";
    } else if (session.kind === "path") {
      const passed = session.independentCount === session.length;
      const path = SpellLearning.pathStatus();
      ui.btnPracticeAgain.textContent = passed ? (path.next ? "Continue learning path →" : "Review final lesson →") : "Retry final check →";
      ui.summaryTitle.textContent = passed ? (path.next ? "Lesson passed!" : "Learning path complete!") : "Keep building this lesson";
      ui.summarySubtitle.textContent = passed
        ? (path.next ? `Next: Level ${path.next.level}, lesson ${path.next.number}. Your progress is saved.` : "You've passed Beginner through Expert. Keep your recall strong with spaced reviews.")
        : `${session.independentCount}/${session.length} recalled independently in the final check. Practise the tricky words if you need to, then retry just the check. Learning mistakes don't count.`;
    } else if (session.kind === "daily") {
      ui.summaryTitle.textContent = "Daily five complete!";
      ui.summarySubtitle.textContent = "A little practice adds up. Your next challenge arrives tomorrow.";
    } else if (total > 0 && pct === 1 && !session.missedWordsThisSession.size) {
      ui.summaryTitle.textContent = "Perfect Session!";
      ui.summarySubtitle.textContent = "Every word right — outstanding.";
    } else if (pct >= 0.7) {
      ui.summaryTitle.textContent = "Nice Work!";
      ui.summarySubtitle.textContent = "Solid session — keep it up.";
    } else {
      ui.summaryTitle.textContent = "Session Complete";
      ui.summarySubtitle.textContent = "Keep practicing — you'll get there.";
    }

    if (session.masteredThisSession.length) {
      ui.summaryMasteredSection.classList.remove("hidden");
      ui.summaryMasteredList.innerHTML = "";
      for (const word of session.masteredThisSession) {
        ui.summaryMasteredList.appendChild(renderWordRow(word, "Mastered", "mastered"));
      }
    } else {
      ui.summaryMasteredSection.classList.add("hidden");
    }

    const missedList = [...session.missedWordsThisSession];
    if (session.returnPath) {
      ui.btnPracticeAgain.textContent = "Return to final check →";
      ui.summarySubtitle.textContent = "Practice finished. Return to your lesson's final check whenever you're ready.";
    }
    ui.btnRetryMissed.classList.toggle("hidden", !missedList.length);
    ui.btnRetryMissed.textContent = `Practise ${missedList.length} missed ${missedList.length === 1 ? "word" : "words"} →`;
    if (missedList.length) {
      ui.summaryReviewSection.classList.remove("hidden");
      ui.summaryReviewList.innerHTML = "";
      for (const word of missedList.slice(0, 10)) {
        ui.summaryReviewList.appendChild(renderWordRow(word, "Review", "due"));
      }
    } else {
      ui.summaryReviewSection.classList.add("hidden");
    }

    showScreen("summary");

    // Big finish: confetti storm scaled to how well they did.
    if (window.SpellDelight && total > 0) {
      const intensity = Math.round(60 + pct * 140);
      setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        window.SpellDelight._burstAt(w * 0.25, h * 0.35, Math.round(intensity * 0.5));
        window.SpellDelight._burstAt(w * 0.75, h * 0.35, Math.round(intensity * 0.5));
        if (pct === 1) window.SpellDelight._burstAt(w * 0.5, h * 0.25, intensity);
      }, 250);
    }
  }

  // ---------- settings screen ----------
  function openSettings() {
    ui.inputToggleSound.checked = SpellSFX.isSoundEnabled();
    ui.inputToggleHaptic.checked = SpellSFX.isHapticEnabled();
    if (ui.inputToggleTheme) ui.inputToggleTheme.checked = true;

    const cfg = SpellAI.loadConfig();
    ui.inputToggleAI.checked = !!cfg.useAI;
    ui.inputApiKey.value = cfg.apiKey || "";
    ui.inputModel.value = cfg.model || SpellAI.DEFAULT_MODEL;
    ui.settingsStatus.textContent = "";
    ui.settingsStatus.className = "settings-status";
    populateVoiceSelect();

    const ttsCfg = SpellTTS.loadConfig();
    ui.inputToggleElevenlabs.checked = !!ttsCfg.useElevenLabs;
    ui.inputElevenlabsKey.value = ttsCfg.apiKey || "";
    ui.inputElevenlabsVoice.innerHTML = `<option value="${ttsCfg.voiceId || SpellTTS.DEFAULT_VOICE_ID}">${ttsCfg.voiceName || SpellTTS.DEFAULT_VOICE_NAME}</option>`;
    if (window.SpellNeural) {
      ui.inputNeuralVoice.value = SpellNeural.loadConfig().voice;
      renderNeuralSettings();
      refreshNeuralSaved();
    }
    ui.elevenlabsStatus.textContent = "";
    ui.elevenlabsStatus.className = "settings-status";
    if (ttsCfg.useElevenLabs && SpellTTS.lastError) {
      ui.elevenlabsStatus.textContent = "Last ElevenLabs request failed, so the device voice was used: " + SpellTTS.lastError;
      ui.elevenlabsStatus.className = "settings-status err";
    }

    showScreen("settings");
  }

  // ---------- natural offline voice (settings) ----------
  let neuralBulk = null; // { done, total } while "Save every word" is running
  let neuralSaved = null; // how many built-in words are stored on this device, once counted

  const neuralWordTexts = () => WORD_LIST.map((w) => (spellingStyle === "uk" && w.variants && w.variants.uk) || w.word);

  function renderNeuralSettings() {
    const N = window.SpellNeural;
    if (!N) return;
    const cfg = N.loadConfig();
    const st = N.getState();
    ui.inputToggleNeural.checked = cfg.enabled;
    ui.neuralFields.classList.toggle("hidden", !cfg.enabled);
    let text;
    let bad = false;
    if (!st.supported) {
      text = "This browser can't run the natural voice, so the device voice will be used.";
      bad = true;
    } else if (neuralBulk) {
      text = `Saving word voices… ${neuralBulk.done} of ${neuralBulk.total}`;
    } else if (st.state === "loading") {
      text = st.progress ? `Downloading the voice… ${Math.round(st.progress * 100)}%` : "Starting the voice engine…";
    } else if (st.state === "ready") {
      text = "Ready. Words are prepared in the background and saved on this device.";
      if (neuralSaved !== null) text += ` ${neuralSaved} of ${WORD_LIST.length} built-in words saved.`;
    } else if (st.state === "error") {
      text = "Couldn't load the voice: " + st.error;
      bad = true;
    } else {
      text = "Loads when you start practising. Tap “Download & test voice” to load it now.";
    }
    ui.neuralStatus.textContent = text;
    ui.neuralStatus.className = "settings-status" + (bad ? " err" : st.state === "ready" ? " ok" : "");
    const downloading = st.state === "loading" && st.progress > 0;
    ui.neuralProgress.classList.toggle("hidden", !downloading && !neuralBulk);
    const fraction = neuralBulk ? neuralBulk.done / (neuralBulk.total || 1) : st.progress;
    ui.neuralProgressFill.style.width = `${Math.round(fraction * 100)}%`;
    ui.btnNeuralAll.textContent = neuralBulk ? "Stop saving" : "Save every word for offline";
    ui.btnTestNeural.disabled = !st.supported;
    ui.btnNeuralAll.disabled = !st.supported;
  }

  function refreshNeuralSaved() {
    if (!window.SpellNeural || !SpellNeural.isReady()) return;
    SpellNeural.countStored(neuralWordTexts()).then((count) => { neuralSaved = count; renderNeuralSettings(); });
  }

  function setupNeuralSettings() {
    const N = window.SpellNeural;
    if (!N) return;
    for (const v of N.VOICES) {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.label;
      ui.inputNeuralVoice.appendChild(opt);
    }
    N.onChange((st) => {
      if (st.state === "ready") refreshNeuralSaved();
      if (screens.settings.classList.contains("active")) renderNeuralSettings();
    });
    ui.inputToggleNeural.addEventListener("change", () => {
      N.saveConfig({ ...N.loadConfig(), enabled: ui.inputToggleNeural.checked });
      if (ui.inputToggleNeural.checked) N.start(); else N.stop();
      renderNeuralSettings();
    });
    ui.inputNeuralVoice.addEventListener("change", () => {
      N.saveConfig({ ...N.loadConfig(), voice: ui.inputNeuralVoice.value });
      neuralSaved = null;
      refreshNeuralSaved();
    });
    ui.btnTestNeural.addEventListener("click", async () => {
      ui.btnTestNeural.disabled = true;
      ui.neuralStatus.textContent = "Preparing the voice…";
      ui.neuralStatus.className = "settings-status";
      try {
        await N.whenReady();
        ui.neuralStatus.textContent = "Speaking…";
        await N.speak("This is how I sound when I say a word like umbrella.", { timeoutMs: 30000 });
        renderNeuralSettings();
      } catch (err) {
        ui.neuralStatus.textContent = "Couldn't play the voice: " + err.message;
        ui.neuralStatus.className = "settings-status err";
      } finally {
        ui.btnTestNeural.disabled = false;
      }
    });
    ui.btnNeuralAll.addEventListener("click", async () => {
      if (neuralBulk) { N.cancelPrefetch(); return; }
      neuralBulk = { done: 0, total: WORD_LIST.length };
      renderNeuralSettings();
      try {
        await N.prefetchAll(neuralWordTexts(), (done, total) => { neuralBulk = { done, total }; renderNeuralSettings(); });
      } catch (err) {
        ui.neuralStatus.textContent = "Couldn't save the words: " + err.message;
        ui.neuralStatus.className = "settings-status err";
      }
      neuralBulk = null;
      neuralSaved = null;
      renderNeuralSettings();
      refreshNeuralSaved();
    });
  }

  function readSettingsForm() {
    return {
      useAI: ui.inputToggleAI.checked,
      apiKey: ui.inputApiKey.value.trim(),
      model: ui.inputModel.value.trim() || SpellAI.DEFAULT_MODEL,
    };
  }

  function readElevenLabsForm() {
    const select = ui.inputElevenlabsVoice;
    const selectedOption = select.options[select.selectedIndex];
    return {
      useElevenLabs: ui.inputToggleElevenlabs.checked,
      apiKey: ui.inputElevenlabsKey.value.trim(),
      voiceId: select.value || SpellTTS.DEFAULT_VOICE_ID,
      voiceName: selectedOption ? selectedOption.textContent : SpellTTS.DEFAULT_VOICE_NAME,
    };
  }

  function saveSettings() {
    SpellAI.saveConfig(readSettingsForm());
    SpellTTS.saveConfig(readElevenLabsForm());
    ui.settingsStatus.textContent = "Saved";
    ui.settingsStatus.className = "settings-status ok";
  }

  // ---------- history / progress screen ----------
  function findWordHint(word) {
    if (data.srs[word]?.entry?.hint) return data.srs[word].entry.hint;
    const entry = WORD_LIST.find((w) => w.word === word || (w.variants && Object.values(w.variants).includes(word)));
    return entry ? entry.hint : "";
  }

  function formatDueBadge(rec) {
    const now = Date.now();
    if (rec.dueAt <= now) {
      const overdueDays = Math.floor((now - rec.dueAt) / 86400000);
      return overdueDays > 0 ? `${overdueDays}d overdue` : "Due now";
    }
    const inDays = Math.ceil((rec.dueAt - now) / 86400000);
    return `In ${inDays}d`;
  }

  function renderWordRow(word, badgeText, badgeClass) {
    const hint = findWordHint(word);
    const row = document.createElement("div");
    row.className = "word-row";

    const main = document.createElement("div");
    main.className = "word-row-main";
    const wordEl = document.createElement("div");
    wordEl.className = "word-row-word";
    wordEl.textContent = word;
    main.appendChild(wordEl);
    if (hint) {
      const hintEl = document.createElement("div");
      hintEl.className = "word-row-hint";
      hintEl.textContent = hint;
      main.appendChild(hintEl);
    }

    const badge = document.createElement("div");
    badge.className = "word-row-badge " + badgeClass;
    badge.textContent = badgeText;

    row.appendChild(main);
    row.appendChild(badge);
    return row;
  }

  function openHistory() {
    ui.histBest.textContent = data.bestStreak;
    ui.histMastered.textContent = countMastered();
    ui.histSessions.textContent = data.sessionsCompleted;

    // Coach progress in history screen
    if (window.SpellCoach) renderCoachProgress();

    const now = Date.now();
    const entries = Object.entries(data.srs);

    const due = entries.filter(([, rec]) => rec.dueAt <= now).sort((a, b) => a[1].dueAt - b[1].dueAt);
    ui.btnHistoryReview.classList.toggle("hidden", !due.length);
    ui.historyDueList.innerHTML = "";
    if (!due.length) {
      ui.historyDueList.innerHTML = '<div class="word-list-empty">Nothing due right now — nice work!</div>';
    } else {
      for (const [word, rec] of due.slice(0, 30)) {
        ui.historyDueList.appendChild(renderWordRow(word, formatDueBadge(rec), "due"));
      }
    }

    const mastered = entries.filter(([, rec]) => rec.reps >= MASTERY_REPS).sort((a, b) => b[1].interval - a[1].interval);
    ui.historyMasteredList.innerHTML = "";
    if (!mastered.length) {
      ui.historyMasteredList.innerHTML = '<div class="word-list-empty">Keep practicing to master your first word.</div>';
    } else {
      for (const [word, rec] of mastered.slice(0, 30)) {
        ui.historyMasteredList.appendChild(renderWordRow(word, `Every ${rec.interval}d`, "mastered"));
      }
    }

    const patterns = topWeakPatterns(6);
    ui.historyPatternsList.innerHTML = "";
    if (!patterns.length) {
      ui.historyPatternsList.innerHTML = '<div class="word-list-empty">No weak spots spotted yet — keep practicing!</div>';
    } else {
      for (const p of patterns) {
        const row = document.createElement("div");
        row.className = "word-row";
        const main = document.createElement("div");
        main.className = "word-row-main";
        const title = document.createElement("div");
        title.className = "word-row-word";
        title.style.textTransform = "none";
        title.textContent = p.label;
        const tip = document.createElement("div");
        tip.className = "word-row-hint";
        tip.style.whiteSpace = "normal";
        tip.textContent = RULE_TIPS[p.rule] || "";
        main.appendChild(title);
        main.appendChild(tip);
        const badge = document.createElement("div");
        badge.className = "word-row-badge due";
        badge.textContent = `${p.count}×`;
        row.appendChild(main);
        row.appendChild(badge);

        // Drill button: practise 5-10 words that share this rule.
        const drillWords = WORD_LIST
          .filter((entry) => entry.rule === p.rule)
          .map(applyVariant);
        if (drillWords.length) {
          const drill = document.createElement("button");
          drill.type = "button";
          drill.className = "word-row-action";
          drill.textContent = "Drill";
          drill.setAttribute("aria-label", `Practise ${p.label} words`);
          drill.addEventListener("click", () => {
            const picked = shuffleArray(drillWords).slice(0, Math.min(SESSION_LENGTH, drillWords.length));
            startSession(picked, { kind: "review", title: `Pattern: ${p.label}`, fullLength: true });
          });
          row.appendChild(drill);
        }
        ui.historyPatternsList.appendChild(row);
      }
    }

    showScreen("history");
  }

  function loadElevenLabsVoices() {
    const key = ui.inputElevenlabsKey.value.trim();
    if (!key) {
      ui.elevenlabsStatus.textContent = "Enter an ElevenLabs API key first.";
      ui.elevenlabsStatus.className = "settings-status err";
      return;
    }
    SpellTTS.saveConfig(readElevenLabsForm());
    ui.btnLoadElevenlabsVoices.disabled = true;
    ui.elevenlabsStatus.textContent = "Loading voices…";
    ui.elevenlabsStatus.className = "settings-status";

    SpellTTS.listVoices()
      .then((voices) => {
        ui.inputElevenlabsVoice.innerHTML = "";
        for (const v of voices) {
          const opt = document.createElement("option");
          opt.value = v.id;
          opt.textContent = v.name;
          ui.inputElevenlabsVoice.appendChild(opt);
        }
        ui.elevenlabsStatus.textContent = `Loaded ${voices.length} voices`;
        ui.elevenlabsStatus.className = "settings-status ok";
      })
      .catch((err) => {
        ui.elevenlabsStatus.textContent = "Failed: " + err.message;
        ui.elevenlabsStatus.className = "settings-status err";
      })
      .finally(() => {
        ui.btnLoadElevenlabsVoices.disabled = false;
      });
  }

  function testElevenLabsVoice() {
    if (!ui.inputElevenlabsKey.value.trim()) {
      ui.elevenlabsStatus.textContent = "Enter an ElevenLabs API key first.";
      ui.elevenlabsStatus.className = "settings-status err";
      return;
    }
    SpellTTS.saveConfig(readElevenLabsForm());
    ui.btnTestElevenlabs.disabled = true;
    ui.elevenlabsStatus.textContent = "Speaking…";
    ui.elevenlabsStatus.className = "settings-status";

    SpellTTS.speak("This is how I sound when I say a word like umbrella.")
      .then(() => {
        ui.elevenlabsStatus.textContent = "Connected";
        ui.elevenlabsStatus.className = "settings-status ok";
      })
      .catch((err) => {
        ui.elevenlabsStatus.textContent = "Failed: " + err.message;
        ui.elevenlabsStatus.className = "settings-status err";
      })
      .finally(() => {
        ui.btnTestElevenlabs.disabled = false;
      });
  }

  function testAIConnection() {
    saveSettings();
    if (!ui.inputApiKey.value.trim()) {
      ui.settingsStatus.textContent = "Enter an API key first.";
      ui.settingsStatus.className = "settings-status err";
      return;
    }
    ui.btnTestAI.disabled = true;
    ui.settingsStatus.textContent = "Testing…";
    ui.settingsStatus.className = "settings-status";
    SpellAI.generateWordBatch(1, {})
      .then(() => {
        ui.settingsStatus.textContent = "Connected — AI is working.";
        ui.settingsStatus.className = "settings-status ok";
      })
      .catch((err) => {
        ui.settingsStatus.textContent = "Failed: " + err.message;
        ui.settingsStatus.className = "settings-status err";
      })
      .finally(() => {
        ui.btnTestAI.disabled = false;
      });
  }

  // ---------- wiring ----------
  ui.btnStart.addEventListener("click", () => startSession());
  el("btn-path-start").addEventListener("click", () => startPathLesson());
  el("btn-ai-lesson").addEventListener("click", startAILesson);
  el("btn-ai-cancel").addEventListener("click", () => {
    cancelAILesson();
    el("ai-lab-status").textContent = "Generation cancelled. You can try again whenever you're ready.";
  });
  el("btn-learn-word").addEventListener("click", teachCurrentWord);
  ui.btnStudyListen.addEventListener("click", () => { if (session.active && round) speak(round.entry.word); });
  ui.btnTypedListen.addEventListener("pointerdown", event => {
    if (document.activeElement === ui.typedInput) event.preventDefault();
  });
  ui.btnTypedListen.addEventListener("click", () => { if (session.active && round) speak(round.entry.word); });
  el("study-copy").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); dismissStudyOverlay(); }
  });
  ui.btnReviewDue.addEventListener("click", () => startSession(getDueEntries()));
  ui.btnHistoryReview.addEventListener("click", () => startSession(getDueEntries()));
  ui.btnRetryMissed.addEventListener("click", () => {
    const returnPath = isLearningLesson()
      ? { entries: session.reviewWords, kind: session.kind, pathLesson: session.pathLesson, title: session.title } : session.returnPath;
    startSession([...session.missedWordsThisSession].map(getReviewEntry), { returnPath });
  });
  ui.btnNextWord.addEventListener("click", advanceRound);
  ui.btnQuit.addEventListener("click", endSession);
  ui.btnClear.addEventListener("click", clearRackSelection);
  ui.btnSkip.addEventListener("click", skipRound);
  ui.speakBtn.addEventListener("click", () => round && speak(round.entry.word));

  ui.modeListenBtn.addEventListener("click", () => setPracticeMode("listen"));
  ui.modeReadBtn.addEventListener("click", () => setPracticeMode("read"));
  ui.btnStudyReady.addEventListener("click", dismissStudyOverlay);
  el("btn-hint").addEventListener("click", revealHint);

  for (const chip of ui.difficultyChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => setFilter("difficulty", chip.dataset.value));
  }
  populateCategoryChips();
  setFilter("difficulty", currentDifficulty);

  for (const chip of ui.lengthChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => setSessionLength(Number(chip.dataset.value)));
  }
  setSessionLength(SESSION_LENGTH);

  for (const chip of ui.inputModeChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => setInputMode(chip.dataset.value));
  }
  setInputMode(inputMode);

  for (const chip of ui.timedChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => setTimedMode(chip.dataset.value));
  }
  setTimedMode(timedMode ? "on" : "off");

  for (const chip of ui.spellingStyleChips.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => setSpellingStyle(chip.dataset.value));
  }
  setSpellingStyle(spellingStyle);

  ui.btnTypedCheck.addEventListener("click", checkTypedAnswer);
  ui.typedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkTypedAnswer();
  });

  ui.btnSettings.addEventListener("click", openSettings);
  ui.btnSettingsBack.addEventListener("click", () => showScreen("home"));
  ui.inputToggleSound.addEventListener("change", () => SpellSFX.setSoundEnabled(ui.inputToggleSound.checked));
  ui.inputToggleHaptic.addEventListener("change", () => SpellSFX.setHapticEnabled(ui.inputToggleHaptic.checked));
  // Dark theme is now the only theme; the toggle has been removed from the UI.
  if (ui.inputToggleTheme) {
    ui.inputToggleTheme.addEventListener("change", () => {
      ui.inputToggleTheme.checked = true;
    });
  }

  ui.btnHistory.addEventListener("click", openHistory);
  ui.btnHistoryBack.addEventListener("click", () => showScreen("home"));
  ui.btnPracticeAgain.addEventListener("click", () => {
    if (session.returnPath) {
      const saved = session.returnPath;
      startSession(shuffleArray([...saved.entries]), {
        kind: saved.kind || "path", pathPhase: "check", pathLesson: saved.pathLesson, title: saved.title, fullLength: true,
      });
    } else if (session.kind === "ai-lesson") {
      if (session.independentCount === session.length) {
        showScreen("home");
        startAILesson();
      } else {
        startSession(shuffleArray([...session.reviewWords]), { kind: "ai-lesson", pathPhase: "check", title: session.title, fullLength: true });
      }
    } else if (session.kind === "path") {
      startPathLesson(session.independentCount === session.length ? "learn" : "check");
    } else startSession();
  });
  ui.btnSummaryDone.addEventListener("click", () => showScreen("home"));

  ui.btnSaveAI.addEventListener("click", saveSettings);
  ui.btnTestAI.addEventListener("click", testAIConnection);
  ui.inputVoice.addEventListener("change", () => {
    localStorage.setItem(VOICE_KEY, ui.inputVoice.value);
  });
  ui.btnTestVoice.addEventListener("click", () => {
    localStorage.setItem(VOICE_KEY, ui.inputVoice.value);
    speakDevice("This is how I sound when I say a word like umbrella.");
  });
  setupNeuralSettings();
  ui.btnLoadElevenlabsVoices.addEventListener("click", loadElevenLabsVoices);
  ui.btnTestElevenlabs.addEventListener("click", testElevenLabsVoice);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      if (screens.settings.classList.contains("active")) populateVoiceSelect();
    };
  }

  ui.btnReset.addEventListener("click", () => {
    if (!confirm("Reset all progress, word lists, daily challenges and notebook notes? This also resets linked devices after sync. Download a backup first if you want to keep them.")) return;
    localStorage.removeItem(STORAGE_KEY);
    SpellLearning.reset();
    recentAIWords = [];
    if (window.SpellCoach) window.SpellCoach.reset();
    data = loadData();
    updateHomeStats();
  });

  // Dark theme is now permanent; the class is set on <html> in the markup.
  document.documentElement.classList.add("dark-theme");

  // Bottom navigation event handlers
  document.querySelectorAll(".bottom-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;
      if (target === "home") showScreen("home");
      else if (target === "lists") showScreen("lists");
      else if (target === "history") openHistory();
      else if (target === "settings") openSettings();
    });
  });

  updateHomeStats();
  setPracticeMode(practiceMode);

  // ---------- inject coach UI into history screen ----------
  if (window.SpellCoach) {
    // Inject coach stats section into the history screen
    const historyScreen = screens.history;
    if (historyScreen) {
      const coachSection = document.createElement("div");
      coachSection.id = "coach-stats-section";
      // Insert after histSessions or at the top of the history screen
      const anchor = ui.histSessions?.closest(".stats-row") || historyScreen.querySelector(".stats-row");
      if (anchor) {
        anchor.insertAdjacentElement("afterend", coachSection);
      } else {
        historyScreen.insertBefore(coachSection, historyScreen.firstChild);
      }
    }

    // Inject or update assessment card on home
    function updateCoachHomeUI() {
      const existingCard = document.getElementById("coach-assessment-card");
      if (existingCard) existingCard.remove();

      if (!window.SpellCoach.isAssessed()) {
        const card = document.createElement("div");
        card.id = "coach-assessment-card";
        card.className = "coach-assessment-card";
        card.innerHTML = `
          <p>Optional: answer 5 quick words to personalise free practice. Your learning path always starts at Level 1.</p>
          <button class="btn btn-primary" id="btn-start-assessment">Take level check →</button>
        `;
        const practiceSummary = document.getElementById("practice-summary");
        if (practiceSummary) {
          practiceSummary.insertAdjacentElement("afterend", card);
        }
        // Wire up assessment button
        const btn = card.querySelector("#btn-start-assessment");
        if (btn) btn.addEventListener("click", startAssessment);
      }

      renderCoachProgress();
    }
    updateCoachHomeUI();

    // Assessment button is wired inside updateCoachHomeUI via the dedicated card button.
    // No more capture-phase interception on the main start button — that would break
    // existing tests and review/due flows that pre-seed localStorage without coach state.
  }
  window.SpellSpeech = { speak };
  SpellFeatures.init({
    progress: () => data,
    variant: applyVariant,
    speak,
    style: () => spellingStyle,
    show: showScreen,
    start: startSession,
    isBusy: () => session.active,
    replaceProgress: value => { data = value; saveData(); updateHomeStats(); },
  });
  updatePracticeSummary();
  screens.home.addEventListener("click", (event) => {
    if (event.target.closest(".chip, .mode-btn")) updatePracticeSummary();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
})();
