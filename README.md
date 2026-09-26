# Spell It

A browser-based spelling practice app with letter tiles, typed answers, multiple choice, US/UK spellings, spaced review and personal learning tools. The frontend uses plain HTML, CSS and JavaScript. Optional automatic sync uses a small Cloudflare Worker and D1 database.

## Run locally

Use Node.js 22.13+ to run the complete app, including sync:

```sh
node server/dev.mjs
```

Open http://127.0.0.1:8765. Practice uses built-in words and the device voice by default. Optional AI words and ElevenLabs speech can be configured in Settings.

The local server binds to your computer only. Sync data is kept in `.local/sync.sqlite`; this folder must never be deployed as public assets. The local server is a development preview, not 24/7 hosting. A plain static server still supports all learning features and file backups, but cannot provide automatic sync.

## Practice and review

- **Your learning path:** start at Level 1 and progress through Beginner, Easy, Medium, Hard and Expert. Every built-in word belongs to a lesson of up to five words. First see and hear each word, read a memory tip, copy it, then recall it with the spelling hidden. Learning hints and mistakes never affect scores, mastery or course unlocks. The “I don't know yet” button reopens the teaching card. After learning the words, a separate spoken, typed final check unlocks the next lesson when every word is recalled on the first try without help. A failed check can be retried directly without repeating the learning stage. Missed-word practice offers a return to that check. The course is untimed, regardless of free-practice settings. Completed lessons survive reloads, backups and sync; unfinished learning/checks restart on reload. Course completion is separate from long-term word mastery. Placement checks and free practice do not skip course levels.

- Start immediately with saved preferences, or expand **Customise practice**.
- **Review due words** selects saved words in order of due date, up to the selected session length. It keeps the exact spelling previously practised and ignores discovery filters.
- The session summary lets you practise missed words again.
- Corrections remain visible until you choose **Next word** or **See results**.
- Only finished sessions count toward the session total. Existing totals are retained.
- AI words now retain their hints for later review. Older saved AI words without hints still support review with the word pronunciation.

Progress and preferences are stored in this browser. API keys, if configured, are stored in browser local storage and sent directly to the selected provider.

## New learning tools

- **My word lists:** create, edit and delete named collections of up to 100 words. Paste comma-, space- or newline-separated words, or use `word | definition | syllables` on each line. Duplicate words are removed and invalid rows are reported before saving. Practice draws a shuffled selection up to your chosen session length and keeps your exact spelling.
- **Spot the mistake:** 40 handwritten sentence prompts. Select the misspelled word and type the correction. Choosing an already correct word records a mistake. This mode uses typed answers regardless of the normal input preference.
- **Progressive hints:** definition, syllables (or clearly labelled letter groups when syllables aren't available), then the first letter. Using any hint marks the answer as assisted. Assisted answers do not advance mastery or clean-answer streaks and remain available for review.
- **Daily five:** up to two due words plus fresh practice to make five, selected once per local date. Each completed word is saved immediately so the challenge can resume after leaving or reloading. The weekly calendar records completed challenges. When there are fewer than two due words, fresh words fill the remaining spaces.
- **Spelling notebook:** missed attempts and assisted words are collected with rule tips. Search, add a personal memory tip, and practise a word again. Notes save as you type.
- **Devices & backup:** export a JSON backup, inspect an import summary and merge it with existing data. Explicit imports can recover data from before a reset. API keys, voice settings and sync codes are excluded.

## Learning coach

A built-in coach personalises every practice session and tracks your progress:

- **Level assessment:** new users start with a short 5-word check across difficulty levels. The coach picks a representative word from each band and determines the right starting level — no random expert words mixed with beginner ones.
- **Smart session planning:** "Start my practice" chooses words in priority order: due reviews first (most overdue), then weak words you've struggled with, then fresh words at your assessed level. You always get the right difficulty.
- **Adaptive levelling:** your level adjusts automatically based on first-attempt unassisted answers. Consistently high accuracy moves you up; sustained difficulty moves you down.
- **Mistake feedback:** every wrong answer shows a word-specific mnemonic tip — curated for 30+ common tricky words, with an honest fallback for others. The visual diff highlights exactly which characters you got right, wrong, or missed.
- **Same-day mastery protection:** you must recall a word correctly on different calendar days before it advances toward mastery. Repeating the same word several times in one sitting preserves your existing progress fairly — no inflating mastery counts.
- **Progress tracking:** home screen shows your level, first-try accuracy percentage, words recalled on later days, words mastered, and weak spelling patterns. Empty states suggest a concrete action rather than a bland "nothing here."

## AI word lab

The home-screen **AI word lab** generates up to five fresh words at the current learning-path level (Beginner first, Expert after completing the course). Each batch uses the same teaching, copying, recall and final-check flow. It supplies AI definitions and memory tips; practised words and their tips are retained in spaced review, the notebook, backup and sync. AI lessons supplement the course and do not skip its unlock requirements. Use **Learn 5 more AI words** to request another batch; retrying a check reuses the same words without a new generation request. The last 500 known/recently generated words are excluded where available, so repeated batches favour fresh vocabulary. There is no fixed batch limit in the app, but finite vocabulary, browser storage, provider credits and rate limits still apply.

In Settings, add an OpenRouter API key, enable AI-generated words, choose a supported model and Save. New configurations default to `openai/gpt-4.1-mini`; existing model choices are preserved. Keys go directly from the browser to OpenRouter and are excluded from backups and sync. Generation is cancellable and requests have a timeout. Errors leave the built-in course available. AI output is checked for word format, duplicates, missing definitions and answer-revealing hints; it is **not dictionary-verified**. Unfinished AI batches are not restored after reload; finished attempts remain available for review. Tests use mocked API responses and never spend provider credits.

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

## Regression checks

Use a fresh, isolated Playwright CLI session: these browser tests clear local storage on the test origin. Never run them against a browser profile containing progress you want to keep.

```sh
playwright-cli -s=spellit-test open http://127.0.0.1:8765
playwright-cli -s=spellit-test run-code --filename=tests/practice-flow.js
playwright-cli -s=spellit-test run-code --filename=tests/learning-path.js
playwright-cli -s=spellit-test run-code --filename=tests/ai-lessons.js
playwright-cli -s=spellit-test run-code --filename=tests/layout-and-modes.js
playwright-cli -s=spellit-test run-code --filename=tests/new-features.js
playwright-cli -s=spellit-mobile-test open --device="iPhone 15" http://127.0.0.1:8765
playwright-cli -s=spellit-mobile-test run-code --filename=tests/mobile-typing-layout.js
playwright-cli -s=spellit-mobile-test close
playwright-cli -s=spellit-test run-code --filename=tests/two-device-sync.js
playwright-cli -s=spellit-test close
node --test tests/build-assets.test.cjs tests/ai-generation.cjs tests/learning-data.cjs tests/coach-features.cjs tests/sync-server.mjs
node tests/speech-cancellation.cjs
```

The tests cover practice regressions, custom lists, proofreading, hints, notebook persistence, daily resume and completion, backup validation, encryption, concurrent writes and two-device offline merging. Coach tests cover session planning priority (due → weak → fresh), same-day mastery protection, level assessment across difficulties, adaptive levelling, spelling-diff highlighting, curated mnemonics, and coach data persistence. Sync server tests use real SQLite and the same request handler as the Worker. Browser sync tests use two isolated profiles against the local server. AI generation and speech requests are mocked; live provider credentials are not required.

When changing app-shell files, update the query versions in `index.html` and `sw.js` and increment the service-worker cache name.
