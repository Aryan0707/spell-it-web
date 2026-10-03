// Pronounce coach: sound guide (syllables, stress, respelling, IPA), slow syllables,
// sound-out with letter highlight, say-it-back via SpeechRecognition, and optional AI
// pronunciation feedback.
// Mounts into the study overlay for the current word.
(() => {
  "use strict";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasMic = !!SR;

  // Each chunk has a `label` (what the learner sees) and `audio` (what the voice says).
  // With a sound guide the audio is the respelling part ("lee"), because reading the written
  // chunk aloud gives the wrong sound ("ly" -> "lie"). Words without a guide (custom lists,
  // AI words) keep the old behaviour: saved syllables if they match, else rough 3-letter groups.
  function buildChunks(entry, guide) {
    const word = entry.word.toLowerCase();
    if (guide) {
      const spelledAsGuide = guide.syllables.join("") === word;
      return guide.syllables.map((syl, i) => ({
        label: spelledAsGuide ? syl : guide.say[i].toLowerCase(), // British spellings: show the sound
        audio: guide.say[i].toLowerCase(),
        stressed: i === guide.stress,
      }));
    }
    const raw = (entry.syllables || "").toLowerCase();
    const parts = raw && raw.replace(/-/g, "") === word ? raw.split("-") : (entry.word.match(/.{1,3}/g) || [entry.word]);
    return parts.map((p) => ({ label: p, audio: p, stressed: false }));
  }

  // "def-uh-NIT-lee" with the stressed part picked out.
  function renderRespelling(guide) {
    const row = h("div", { class: "pc-say", "aria-label": `Sounds like ${guide.say.join(" ").toLowerCase()}` });
    guide.say.forEach((part, i) => {
      if (i) row.append(h("span", { class: "pc-sep", "aria-hidden": "true" }, "·"));
      row.append(h("span", { class: i === guide.stress ? "pc-part pc-stress" : "pc-part" }, part.toLowerCase()));
    });
    return row;
  }

  function h(tag, attrs = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "on") for (const [evt, fn] of Object.entries(v)) node.addEventListener(evt, fn);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  function letterTiming(word) {
    // Approximate per-letter delay for the sound-out reveal.
    // Vowels linger, consonants pass. Total ≈ speech duration.
    const delays = [];
    for (const ch of word) delays.push(/[aeiouy]/i.test(ch) ? 260 : 170);
    return delays;
  }

  async function playChunk(text, speak) {
    try { await speak(text); } catch (e) {}
  }

  function normalise(s) {
    return (s || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  // -----------------------------------------------------------------
  // TODO (YOU): implement evaluateAttempt(target, transcript)
  // This is the heart of "say-it-back" feedback. It decides how strict
  // to be, what counts as close, and what message the learner sees.
  //
  // Called with:
  //   target     = the word we asked them to say (lowercase, letters only)
  //   transcript = what SpeechRecognition heard (raw string, may be noisy)
  //
  // Return an object:
  //   { score: 0..1, ok: boolean, message: string, missedLetters: string[] }
  //
  // Design questions to consider — no single right answer:
  //   * Exact match only, or allow near-misses (Levenshtein <= 1)?
  //   * Homophones ("there" vs "their") — accept, reject, or hint?
  //   * How to phrase feedback so an ESL adult feels encouraged, not judged?
  //   * What letters/sounds were missed — useful for the coach to speak next?
  //
  // For now this is a very naive placeholder so the feature runs.
  // Replace it with your own logic (5–10 lines is plenty).
  // -----------------------------------------------------------------
  function evaluateAttempt(target, transcript) {
    const heard = normalise(transcript);
    const ok = heard === target;
    return {
      score: ok ? 1 : 0,
      ok,
      message: ok ? "Perfect." : `Heard: “${transcript || "…"}”. Try again slowly.`,
      missedLetters: ok ? [] : target.split("").filter((c, i) => heard[i] !== c),
    };
  }

  function mount(container, entry, deps) {
    if (!container || !entry) return () => {};
    container.replaceChildren();

    const speak = deps?.speak || (t => (window.SpellTTS?.isEnabled() ? SpellTTS.speak(t) : Promise.resolve()));
    const guide = window.SpellSounds?.forEntry(entry);
    const chunks = buildChunks(entry, guide);
    const target = normalise(entry.word);
    // Real syllable sounds are worth preparing; the rough letter chunks used without a guide are not.
    window.SpellNeural?.prefetch([entry.word, ...(guide ? chunks.map((c) => c.audio) : [])]);

    // -- Header --
    const eyebrow = h("div", { class: "pc-eyebrow" }, "Pronounce coach");
    const wordRow = h("div", { class: "pc-word" });
    const letterEls = [];
    for (const ch of entry.word) {
      const span = h("span", { class: "pc-letter" }, ch);
      letterEls.push(span);
      wordRow.append(span);
    }

    // -- Syllable chips (tap each to hear that chunk) --
    const chipRow = h("div", { class: "pc-chips" });
    for (const chunk of chunks) {
      chipRow.append(h("button", {
        class: chunk.stressed ? "pc-chip pc-chip-stress" : "pc-chip", type: "button",
        title: chunk.stressed ? "Stressed syllable: say this part loudest" : null,
        on: { click: () => playChunk(chunk.audio, speak) },
      }, chunk.label));
    }

    // -- Sound guide: respelling, IPA and the one thing the spelling hides --
    let guideBlock = null;
    if (guide) {
      guideBlock = h("div", { class: "pc-guide" },
        h("div", { class: "pc-guide-row" },
          h("span", { class: "pc-guide-label" }, "Sounds like"), renderRespelling(guide)),
        h("div", { class: "pc-guide-row" },
          h("span", { class: "pc-guide-label" }, "IPA"), h("span", { class: "pc-ipa" }, guide.ipa),
          h("span", {
            class: "pc-accent",
            title: guide.source === "ai" ? "Written by AI, so it may contain mistakes" : guide.source === "pack" ? "Hand-written guide; names and borrowed words vary, so it is approximate" : "General American pronunciation",
          }, guide.source === "ai" ? "AI" : guide.source === "pack" ? "Guide" : "US")),
        guide.note ? h("div", { class: "pc-guide-note" }, guide.note) : null,
      );
    }

    // -- Sound-out: highlight each letter as the word is said --
    const soundOutBtn = h("button", {
      class: "pc-btn pc-btn-primary", type: "button",
      on: { click: async () => {
        letterEls.forEach(l => l.classList.remove("on", "done"));
        const delays = letterTiming(entry.word);
        speak(entry.word); // whole-word audio in parallel
        for (let i = 0; i < letterEls.length; i++) {
          letterEls[i].classList.add("on");
          await new Promise(r => setTimeout(r, delays[i]));
          letterEls[i].classList.remove("on");
          letterEls[i].classList.add("done");
        }
      } },
    }, "Sound it out");

    const slowBtn = h("button", {
      class: "pc-btn", type: "button",
      on: { click: async () => {
        for (const chunk of chunks) {
          await playChunk(chunk.audio, speak);
          await new Promise(r => setTimeout(r, 220));
        }
      } },
    }, "Say slowly");

    // -- Say-it-back (mic) --
    const feedback = h("div", { class: "pc-feedback", role: "status" });
    let micBtn = null;
    let recognition = null;
    let listening = false;

    if (hasMic) {
      micBtn = h("button", { class: "pc-btn pc-btn-mic", type: "button" }, "🎤 Say it");
      micBtn.addEventListener("click", () => {
        if (listening) { try { recognition.stop(); } catch (e) {} return; }
        try {
          recognition = new SR();
          recognition.lang = "en-US";
          recognition.interimResults = false;
          recognition.maxAlternatives = 3;
          recognition.onstart = () => {
            listening = true;
            micBtn.classList.add("listening");
            micBtn.textContent = "🎙️ Listening…";
            feedback.textContent = "";
          };
          const finish = () => {
            listening = false;
            micBtn.classList.remove("listening");
            micBtn.textContent = "🎤 Say it";
          };
          recognition.onerror = (e) => {
            finish();
            feedback.textContent = e.error === "not-allowed"
              ? "Microphone blocked. Enable it in your browser."
              : "Couldn't hear that. Try again.";
          };
          recognition.onend = finish;
          recognition.onresult = async (e) => {
            const alternatives = Array.from(e.results[0]).map(r => r.transcript);
            // pick the alternative closest to target if any hits exactly, else first
            const chosen = alternatives.find(t => normalise(t) === target) || alternatives[0];
            const result = evaluateAttempt(target, chosen);
            feedback.classList.toggle("ok", result.ok);
            feedback.classList.toggle("miss", !result.ok);
            feedback.textContent = result.message;

            // Optional AI coaching feedback for near-misses.
            if (!result.ok && window.SpellAI && SpellAI.isEnabled()) {
              try {
                const tip = await SpellAI.explainMistake?.({
                  word: entry.word,
                  attempt: `spoke: ${chosen}`,
                  hint: entry.hint,
                });
                if (tip) feedback.append(h("div", { class: "pc-ai-tip" }, tip));
              } catch (e) { /* fine — silent optional feature */ }
            }
          };
          recognition.start();
        } catch (e) {
          feedback.textContent = "Speech recognition unavailable in this browser.";
        }
      });
    }

    const actions = h("div", { class: "pc-actions" }, slowBtn, soundOutBtn, micBtn);
    if (!hasMic) {
      actions.append(h("span", { class: "pc-note" }, "Say-it-back needs Chrome or Safari."));
    }

    container.append(...[eyebrow, wordRow, chipRow, guideBlock, actions, feedback].filter(Boolean));

    return function unmount() {
      try { recognition?.abort?.(); } catch (e) {}
      container.replaceChildren();
    };
  }

  window.SpellPronounce = { mount, evaluateAttempt, hasMic };
})();
