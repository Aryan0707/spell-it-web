# Spell It

A browser-based spelling practice app with letter tiles, typed answers, multiple choice, US/UK spellings, spaced review and personal learning tools. The frontend uses plain HTML, CSS and JavaScript. Optional automatic sync uses a small Cloudflare Worker and D1 database.

## Run locally

Use Node.js 22.13+ to run the complete app, including sync:

```sh
node server/dev.mjs
```

Open http://127.0.0.1:8765. Practice uses built-in words and the device voice by default. Optional AI words and ElevenLabs speech can be configured in Settings.

The local server binds to your computer only. Sync data is kept in `.local/sync.sqlite`; this folder must never be deployed as public assets. The local server is a development preview, not 24/7 hosting. A plain static server still supports all learning features and file backups, but cannot provide automatic sync.

## Layout

Five tabs, one job each, so nothing competes for attention:

- **Home:** today's status (learned, streak, due), one **Continue your practice** button and the word of the day.
- **Learn:** the learning path (lesson by lesson) and the AI word lab for fresh words.
- **Practice:** Daily five, Review due words, Spot the mistake, and **Free practice** (Listen or Read, session length and answer style up front; difficulty, category, timer and US/UK spelling under **More options**), plus the weekly calendar.
- **Ask AI:** the word and name chat.
- **You:** Your progress, My word lists, Spelling notebook and Settings.

Pages opened from **You** keep that tab lit and go back to it. Every control keeps its element id, so the logic is unchanged; only where things sit moved.

## Practice and review

- **Your learning path:** start at Level 1 and progress through Beginner, Easy, Medium, Hard and Expert. Every built-in word (451 across 93 lessons) belongs to a lesson of up to five words. First see and hear each word, read a memory tip, copy it, then recall it with the spelling hidden. Learning hints and mistakes never affect scores, mastery or course unlocks. The “I don't know yet” button reopens the teaching card. After learning the words, a separate spoken, typed final check unlocks the next lesson when every word is recalled on the first try without help. A failed check can be retried directly without repeating the learning stage. Missed-word practice offers a return to that check. The course is untimed, regardless of free-practice settings. Completed lessons survive reloads, backups and sync; unfinished learning/checks restart on reload. Course completion is separate from long-term word mastery. The course grows in **waves** (`WORD_WAVES` in `words.js`): each level teaches its original words first, then the words added later. A lesson is identified by the five words it contains, so the first wave is frozen; learners who had already passed a later lesson are not sent back to lessons added since (those words still reach them through daily practice and free practice), and new learners simply meet everything in order. Placement checks and free practice do not skip course levels.

- Start immediately with saved preferences, or expand **Customise practice**. In Read & Spell, use **Listen to the word** on the study card and the inline **Listen** control while typing; both replay through the configured voice (ElevenLabs when enabled).
- **Review due words** selects saved words in order of due date, up to the selected session length. It keeps the exact spelling previously practised and ignores discovery filters.
- The session summary lets you practise missed words again.
- Corrections remain visible until you choose **Next word** or **See results**.
- Only finished sessions count toward the session total. Existing totals are retained.
- AI words now retain their hints for later review. Older saved AI words without hints still support review with the word pronunciation.

Progress and preferences are stored in this browser. API keys, if configured, are stored in browser local storage and sent directly to the selected provider.

## New learning tools

- **My word lists:** create, edit and delete named collections of up to 100 words. Paste comma-, space- or newline-separated words, or use `word | definition | syllables` on each line. Duplicate words are removed and invalid rows are reported before saving. Practice draws a shuffled selection up to your chosen session length and keeps your exact spelling. **Read words** opens a word-by-word view of a list (meaning, related words, examples, how to say it, and a Listen button) so you can study a list without practising it; built-in words have all of this already. With AI words switched on, saving a list automatically writes a meaning, three examples and a pronunciation guide for any word that lacks them, and shows them as soon as they arrive. It only fills gaps and never replaces a definition you typed; built-in words are never sent. If it stops part-way, what arrived is kept and **Add details with AI** (on the list card) finishes the rest. Without AI the list screen says how to turn it on. Every example sentence has a speaker button, here and on the study card, and the natural voice prepares them ahead of time. Editing a list keeps the details already saved for its words.
- **Spot the mistake:** 40 handwritten sentence prompts. Select the misspelled word and type the correction. Choosing an already correct word records a mistake. This mode uses typed answers regardless of the normal input preference.
- **Meanings and examples:** the study card shows each built-in word's part of speech, a plain-English definition, related words and three example sentences, in the learner's US or UK spelling. Meanings live in `meanings.js` and sentences in `WORD_EXAMPLES` at the end of `words.js`. AI words get the same card: the AI word lab also asks for a definition, related words, three examples and a pronunciation guide, which are checked before use. A definition that contains the word, an example without the word exactly once, or a guide whose syllables do not spell the word is dropped on its own and the word keeps working; AI sound guides are tagged "AI" because they are not dictionary-verified. The hand-checked built-in data wins when a word is in both. Custom-list words show their saved hint.
- **Sound guide:** the pronounce coach on each study card shows the word's real syllables with the stressed one marked, a plain-English respelling (DEF·uh·nit·lee), IPA (General American) and a short note on the sound the spelling hides, for every built-in word. Tapping a syllable, or **Say slowly**, speaks the respelling rather than the written chunk, so the voice says “lee” and not “lie”. The data lives in `sounds.js`; custom-list words, and AI words whose guide failed its checks, fall back to saved syllables or rough letter groups.
- **Hear it in a sentence:** while a word is hidden, **Hear it in a sentence** (beside **Need a hint?**) speaks it the way a spelling bee does: the word, what kind of word it is, an example sentence, then the word again. It helps tell apart words that sound alike and uses each of the word's three examples in turn. It is audio only, because printing the sentence would spell the word out, and it is not a hint: using it does not mark an answer as assisted. It appears for every word that has example sentences (all built-in words, and AI words that came with examples) and is not offered in Spot the mistake.
- **Progressive hints:** definition, syllables (or clearly labelled letter groups when syllables aren't available), then the first letter. Using any hint marks the answer as assisted. Assisted answers do not advance mastery or clean-answer streaks and remain available for review.
- **Daily five:** up to two due words plus fresh practice to make five, selected once per local date. Each completed word is saved immediately so the challenge can resume after leaving or reloading. The weekly calendar records completed challenges. When there are fewer than two due words, fresh words fill the remaining spaces.
- **Spelling notebook:** missed attempts and assisted words are collected with rule tips. Search, add a personal memory tip, and practise a word again. Notes save as you type.
- **Devices & backup:** export a JSON backup, inspect an import summary and merge it with existing data. Explicit imports can recover data from before a reset. API keys, voice settings and sync codes are excluded.

## Personal notes on any word

If you like a word, or want a trick of your own for it, press **Add my own note** on its study card and type: the note saves as you type. It goes into the **Spelling notebook**, which now holds every word you have missed *and* every word you have written a note on. The note comes back on the study card, in the notebook (where you can edit it) and in the **Read words** view of a list. Clearing a note on a word you never missed takes it out of the notebook view.

## Learning coach

A built-in coach personalises every practice session and tracks your progress:

- **Level assessment:** new users start with a short 5-word check across difficulty levels. The coach picks a representative word from each band and determines the right starting level — no random expert words mixed with beginner ones.
- **Smart session planning:** "Start my practice" chooses words in priority order: due reviews first (most overdue), then weak words you've struggled with, then fresh words at your assessed level. You always get the right difficulty.
- **Adaptive levelling:** your level adjusts automatically based on first-attempt unassisted answers. Consistently high accuracy moves you up; sustained difficulty moves you down.
- **Mistake feedback:** every wrong answer shows a word-specific mnemonic tip — curated for 30+ common tricky words, with an honest fallback for others. The visual diff highlights exactly which characters you got right, wrong, or missed.
- **Same-day mastery protection:** you must recall a word correctly on different calendar days before it advances toward mastery. Repeating the same word several times in one sitting preserves your existing progress fairly — no inflating mastery counts.
- **Learned, then Mastered:** a word is **Learned** after clean recalls on three different days. It is **Mastered** only when its review interval has also reached 21 days, which takes four spaced recalls: the word was remembered after an 8-day gap and is now scheduled three weeks out. Both thresholds, and the checks for them, live in `srs.js`. The home ring counts Learned words; Progress shows both, with a badge on each word.
- **Second looks:** a word you miss, skip, time out on or needed a hint for comes back a few words later in the same session (`SRS.relearnGap` in `srs.js`: 3 words later, then 6 more, then it is left to its schedule). The study card is skipped, so it has to be recalled, not copied. A second look is practice only: it never changes the word's schedule, the streak, the coach, or the session score, and it adds one round to the session. It applies to free practice, review and custom lists; course checks, the daily five and the level check record one result per word and are unchanged.
- **Near-misses are gentler than blanks:** if every wrong attempt on a word of five or more letters was a single slip (a missing, extra or wrong letter, or two neighbouring letters swapped, like *recieve*) and no hint was used, the word keeps half its recalls, loses less ease and is due again tomorrow. Anything else, including hints, timeouts and skips, resets the word and makes it due immediately.
- **Progress tracking:** home screen shows your level, first-try accuracy percentage, words recalled on later days, words learned and mastered, and weak spelling patterns. Empty states suggest a concrete action rather than a bland "nothing here."

## Ask AI (words and names)

The **Ask AI** tab opens a chat for questions about any word or name: how to spell it, what it means, how to say it, similar words, a way to remember it. Names are in scope (the word lab refuses proper nouns): the tutor is told that names often have several valid spellings and pronunciations and to say so rather than pick one. It follows your US/UK spelling setting, writes pronunciations as respellings with the stressed part in capitals, and says when it is unsure instead of inventing an origin. **Read words** in My lists has an **Ask AI** button per word that types a question ready to send; nothing is sent until you press Send.

It uses the same OpenRouter key, model and cancel/timeout handling as the AI word lab (`SpellAI.chat` in `ai.js`; the screen and tutor rules are in `chat.js`). Every question spends your credits, so only the last 10 messages go with each request (`trimHistory` in `chat.js`). The conversation (last 40 messages) is kept in this browser only and is not part of backups or sync; **Clear chat** removes it. Replies are shown as plain text with **bold** only, never as HTML. It is not available during a practice round, so an answer cannot give away a word you are being tested on. Tests mock the API and never spend credits.

## World words, names and places

Practice is not limited to English words. The **Words from around the world** section on the Learn tab has two hand-written packs. Each is split into themes (German, Japanese, Irish names, Indian places and so on), and each theme becomes its own list in My lists, practised like any other list. **Add all** adds every theme; **Choose a theme** adds one:

- **World words** (30): words English borrowed (*karma*, *jungle*, *tsunami*, *algorithm*) and words with no short English translation (*schadenfreude*, *saudade*, *hygge*, *ikigai*, *kintsugi*, *ubuntu*, *sobremesa*, *mamihlapinatapai*).
- **Names & places** (30): British places and surnames said differently from how they are spelled (*Worcester*, *Cholmondeley*, *Featherstonehaugh*) and Irish and Indian names and places (*Siobhán*, *Aoife*, *Aishwarya*, *Lakshmi*, *Bengaluru*, *Thiruvananthapuram*).

The words are in `packs-world.js` and `packs-names.js` (row format at the top of `packs.js`) and are checked by `tests/packs.test.cjs` against the same validators the app uses (meaning rows, sound guides, backup validation), and against the built-in course so no word is taught twice. Only add facts you are sure of.

**Storage.** Pack data is not part of the app that loads on every start. `packs.js` (about 8 KB) holds the list of packs and themes; a pack's words download the first time you add one, are then remembered in `spellit_packs`, and load before the app starts on later visits (a new device that receives your lists by sync notices and fetches them itself). A pack word saved in a list, a review record, the notebook or the daily challenge is stored as just `{ word, pack }` plus anything you changed, and is looked up when read back (`slim` and `hydrate` in `packs.js`, plugged in through `SpellLearning.setCodec`). This is why a pack can be large: 1,060 pack words, all practised and half of them missed, come to about 0.34 MB of backup, against 1.57 MB (over the 1.5 MB backup limit) when each word was copied in full. Each theme is one list, so keep a theme to 100 words or fewer (a test checks it) and you can save at most 50 lists in total.

**Ask AI → Add words to practice.** Under each answer, **Add words to practice** asks the AI to pick up to six single words or names from the latest exchange and shows them as a checklist. Tick the ones you want; they are saved to a list called *From Ask AI* (duplicates skipped, 100 words per list), with **Practise now** straight after. Names from any culture and words from any language work. Nothing is added without your tick, and it costs one extra request only when you press the button. Each suggestion is checked like word-lab output: a bad definition, example or sound guide is dropped on its own and the word stays; phrases of more than one word are refused.

**How non-English spellings are handled.** Practice words are plain `a–z`, so accents are folded (`Siobhán` is practised as *siobhan*, `Straße` as *strasse*; `fold()` in `ai.js`). The study card shows the original in a tag (*Irish first name · Siobhán*), names are capitalised in their example sentences, and the sound guide is labelled **Guide** (hand-written) or **AI**, never passed off as dictionary-verified. Pronunciation of names and borrowed words varies, so treat the respelling as approximate.

**Voice.** Words that English does not say in its own way (*saudade*, *hygge*, *schadenfreude*) are spoken by a voice for their language when the device has one, otherwise the usual English voice. Words written in non-Latin scripts (Japanese, Hindi, Greek) are always spoken by the English voice, which handles the Latin spelling reasonably; the written respelling is the reliable guide. New fields on a word (`origin`, `lang`, `pack`) are part of backups and sync.

## AI word lab

The **AI word lab** on the Learn tab generates up to five fresh words at the current learning-path level (Beginner first, Expert after completing the course). Each batch uses the same teaching, copying, recall and final-check flow. It supplies AI definitions and memory tips; practised words and their tips are retained in spaced review, the notebook, backup and sync. AI lessons supplement the course and do not skip its unlock requirements. Use **Learn 5 more AI words** to request another batch; retrying a check reuses the same words without a new generation request. The last 500 known/recently generated words are excluded where available, so repeated batches favour fresh vocabulary. There is no fixed batch limit in the app, but finite vocabulary, browser storage, provider credits and rate limits still apply.

In Settings, add an OpenRouter API key, enable AI-generated words, choose a supported model and Save. New configurations default to `openai/gpt-4.1-mini`; existing model choices are preserved. Keys go directly from the browser to OpenRouter and are excluded from backups and sync. Generation is cancellable and requests have a timeout. Errors leave the built-in course available. AI output is checked for word format, duplicates, missing definitions and answer-revealing hints; it is **not dictionary-verified**. Unfinished AI batches are not restored after reload; finished attempts remain available for review. Tests use mocked API responses and never spend provider credits.

## Voices

Words are read in this order: **ElevenLabs** (if you switched it on with your own key), then the free **natural voice**, then the **device voice**. A voice that fails, or isn't ready yet, hands that one word to the next, so practice is never silent.

- **Natural voice (Settings → Natural voice):** the open Kokoro neural voice runs inside the browser in a Web Worker, so typing never freezes. It downloads about 90 MB once (kept by the browser, so it works offline afterwards). Generating a word takes a few seconds, so the words in a session are prepared in the background and saved on the device; a saved word plays instantly. **Save every word for offline** prepares all built-in words (about 32 MB for the 451 words). The engine and runtime load from jsDelivr at a pinned version and the model from Hugging Face; the worker cannot read the app's saved API keys. Choose a voice, or leave it on Automatic to match US/UK spelling.
- **Device voice:** picks the best voice your device has, preferring Premium, Enhanced and Natural voices over the default one.
- **Browser rules:** iOS Safari and Chrome only start sound from a tap, so the app primes speech and audio on your first tap or key press.

## Automatic sync

On a host running the sync service, open **Settings → Devices & backup → Create a sync code**. Copy the code to the other device, open the same site address, and choose **Link this device**. The code is a private recovery credential: anyone with it can read and update this progress. There is no email recovery; download a backup and retain the code securely.

The browser encrypts the progress with AES-GCM using a randomly generated 256-bit key. Only an independently derived authentication token and encrypted payload reach the service. Provider API keys are never included. Requests bypass the service-worker cache. The server stores one encrypted snapshot per code, with an atomic revision check to reject stale writes.

Sync runs after changes, on returning to the app, when reconnecting and periodically while the app is visible. It waits while a practice session or list/notebook editor is active. Different sessions, lists, attempts and calendar entries merge; newer edits win for the same note, list or word schedule. These comparisons use device timestamps, so device clocks should be accurate. Concurrent reviews of the same word retain the latest schedule rather than double-advancing mastery. Disconnect keeps local progress; Reset Progress propagates to linked devices after syncing.

## Host the app

Prepare only the public files:

```sh
node server/build.mjs
```

Upload **`dist/`**, not the project folder, to any static host for learning features and backups. For automatic sync, deploy the Worker and assets together:

1. Sign in to your Cloudflare account using `npx wrangler@4 login`.
2. Create storage with `npx wrangler@4 d1 create spell-it-sync`.
3. Put the returned database ID into `wrangler.jsonc` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Initialise the database: `npx wrangler@4 d1 execute spell-it-sync --remote --file=server/schema.sql`.
5. Run `node server/build.mjs`, then `npx wrangler@4 deploy`.
6. Open the returned HTTPS site and check that **Devices & backup** says sync is ready.

Cloudflare hosts the public assets and `/api/sync` on the same origin. No custom domain is required. Static hosting, Workers and D1 have separate provider usage limits; monitor the account's usage before expanding access. Public deployment requires your account and has not been performed automatically.

References: [Worker assets](https://developers.cloudflare.com/workers/static-assets/binding/), [D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/).

## Adding words

Add new built-in words as a **new wave**, never inside `CORE_WORDS`: lesson IDs are built from the words in each lesson, so adding, removing, renaming or moving a word in the first wave would make learners' finished lessons stop matching. A new wave is a new array in `words.js` added to `WORD_WAVES`, with a multiple of five words per level so no level ends on a stub lesson. Every word needs four things, and `tests/word-bank.test.cjs` lists exactly what is missing or malformed:

- an entry in the wave: `word`, a `hint` that does not contain the word, `difficulty`, `category`, and optionally a `rule` and `variants: { uk: "…" }`;
- a row in `meanings.js` (part of speech, a definition that does not contain the word, up to four related words);
- a row in `sounds.js` (written syllables that spell the word, a respelling with one capitalised stressed part, IPA, and an optional note);
- three sentences in `WORD_EXAMPLES`, each with exactly one `{word}`.

Text shown for a US/UK pair must not contain either spelling except through `{word}`, because one hint, definition, note and sentence is shown to both. The test checks this.

## Regression checks

Use a fresh, isolated Playwright CLI session: these browser tests clear local storage on the test origin. The scripts move between tabs with `#nav-today`, `#nav-learn`, `#nav-practice` and `#nav-me` before touching a control, so keep that in mind when adding one. Never run them against a browser profile containing progress you want to keep.

```sh
playwright-cli -s=spellit-test open http://127.0.0.1:8765
playwright-cli -s=spellit-test run-code --filename=tests/practice-flow.js
playwright-cli -s=spellit-test run-code --filename=tests/learning-path.js
playwright-cli -s=spellit-test run-code --filename=tests/ai-lessons.js
playwright-cli -s=spellit-test run-code --filename=tests/layout-and-modes.js
playwright-cli -s=spellit-test run-code --filename=tests/new-features.js
playwright-cli -s=spellit-audio-test open http://127.0.0.1:8765
playwright-cli -s=spellit-audio-test run-code --filename=tests/read-spell-listening.js
playwright-cli -s=spellit-audio-test close
playwright-cli -s=spellit-mobile-test open --device="iPhone 15" http://127.0.0.1:8765
playwright-cli -s=spellit-mobile-test run-code --filename=tests/mobile-typing-layout.js
playwright-cli -s=spellit-mobile-test close
playwright-cli -s=spellit-test run-code --filename=tests/two-device-sync.js
playwright-cli -s=spellit-test close
node --test tests/build-assets.test.cjs tests/ai-generation.cjs tests/learning-data.cjs tests/coach-features.cjs tests/neural-voice.test.cjs tests/sync-server.mjs tests/word-bank.test.cjs
node tests/speech-cancellation.cjs
```

The tests cover practice regressions, custom lists, proofreading, hints, notebook persistence, daily resume and completion, backup validation, encryption, concurrent writes and two-device offline merging. Coach tests cover session planning priority (due → weak → fresh), same-day mastery protection, level assessment across difficulties, adaptive levelling, spelling-diff highlighting, curated mnemonics, and coach data persistence. Sync server tests use real SQLite and the same request handler as the Worker. Browser sync tests use two isolated profiles against the local server. AI generation and speech requests are mocked; live provider credentials are not required.

When changing app-shell files, update the query versions in `index.html` and `sw.js` and increment the service-worker cache name.
