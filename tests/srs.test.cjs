"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const SRS = require(path.join(__dirname, "..", "srs.js"));

const DAY = SRS.DAY_MS;
const T0 = 1_700_000_000_000; // fixed anchor

const alwaysBump = () => true;
const neverBump = () => false;

test("first clean recall schedules review 1 day out", () => {
  const rec = SRS.schedule({ rec: undefined, wasClean: true, now: T0, word: "cat", canBumpMastery: alwaysBump });
  assert.equal(rec.reps, 1);
  assert.equal(rec.interval, 1);
  assert.equal(rec.dueAt, T0 + DAY);
});

test("second clean recall on a later day jumps to 3 days out", () => {
  let rec = SRS.schedule({ rec: undefined, wasClean: true, now: T0, word: "cat", canBumpMastery: alwaysBump });
  rec = SRS.schedule({ rec, wasClean: true, now: T0 + DAY, word: "cat", canBumpMastery: alwaysBump });
  assert.equal(rec.reps, 2);
  assert.equal(rec.interval, 3);
});

test("wrong answer resets reps and drops ease", () => {
  let rec = SRS.schedule({ rec: undefined, wasClean: true, now: T0, word: "cat", canBumpMastery: alwaysBump });
  rec = SRS.schedule({ rec, wasClean: true, now: T0 + DAY, word: "cat", canBumpMastery: alwaysBump });
  const beforeEase = rec.ease;
  rec = SRS.schedule({ rec, wasClean: false, now: T0 + 2 * DAY, word: "cat", canBumpMastery: alwaysBump });
  assert.equal(rec.reps, 0);
  assert.equal(rec.interval, 0);
  assert.equal(rec.dueAt, T0 + 2 * DAY);
  assert.ok(rec.ease < beforeEase);
  assert.ok(rec.ease >= SRS.MIN_EASE);
});

test("same-day clean repeat does NOT push next review further out (regression)", () => {
  let rec = SRS.schedule({ rec: undefined, wasClean: true, now: T0, word: "cat", canBumpMastery: alwaysBump });
  const dueAfterFirst = rec.dueAt;
  const easeAfterFirst = rec.ease;
  const intervalAfterFirst = rec.interval;
  const repsAfterFirst = rec.reps;

  // Same session, same day: canBumpMastery returns false.
  const later = SRS.schedule({ rec, wasClean: true, now: T0 + 60_000, word: "cat", canBumpMastery: neverBump });
  assert.equal(later.dueAt, dueAfterFirst, "dueAt must not move on a same-day repeat");
  assert.equal(later.interval, intervalAfterFirst, "interval must not grow on a same-day repeat");
  assert.equal(later.ease, easeAfterFirst, "ease must not grow on a same-day repeat");
  assert.equal(later.reps, repsAfterFirst, "reps must not grow on a same-day repeat");
});

test("weight prioritises overdue words", () => {
  const now = T0 + 10 * DAY;
  const fresh = undefined;
  const dueToday = { reps: 2, interval: 3, ease: 2.5, dueAt: now };
  const overdue5d = { reps: 2, interval: 3, ease: 2.5, dueAt: now - 5 * DAY };
  const notDue = { reps: 2, interval: 3, ease: 2.5, dueAt: now + DAY };

  assert.equal(SRS.weight(fresh, now), 1);
  assert.equal(SRS.weight(notDue, now), 0.2);
  assert.ok(SRS.weight(overdue5d, now) > SRS.weight(dueToday, now));
});

test("learned needs three clean-recall days; mastered also needs a 21-day interval", () => {
  const rec = (reps, interval) => ({ reps, interval, ease: 2.5, dueAt: T0 });
  assert.ok(!SRS.isLearned(rec(SRS.LEARNED_REPS - 1, 30)));
  assert.ok(SRS.isLearned(rec(SRS.LEARNED_REPS, 8)));
  assert.ok(!SRS.isMastered(rec(SRS.LEARNED_REPS, 8)), "learned but only an 8-day interval");
  assert.ok(!SRS.isMastered(rec(SRS.LEARNED_REPS - 1, 30)), "long interval without enough reps");
  assert.ok(SRS.isMastered(rec(4, SRS.MASTERED_INTERVAL_DAYS)));
  assert.ok(!SRS.isLearned(undefined) && !SRS.isMastered(undefined));
});

test("a word takes four clean recalls on spaced days to become mastered", () => {
  let rec;
  const seen = [];
  for (let day = 0, i = 0; i < 4; i++) {
    rec = SRS.schedule({ rec, wasClean: true, now: T0 + day * DAY, word: "because", canBumpMastery: alwaysBump });
    seen.push({ learned: SRS.isLearned(rec), mastered: SRS.isMastered(rec), interval: rec.interval });
    day += rec.interval;
  }
  assert.deepEqual(seen.map((s) => s.interval), [1, 3, 8, 21]);
  assert.deepEqual(seen.map((s) => s.learned), [false, false, true, true]);
  assert.deepEqual(seen.map((s) => s.mastered), [false, false, false, true]);
});

test("isNearMiss: one insertion, deletion, substitution or swap, on words of 5+ letters", () => {
  assert.ok(SRS.isNearMiss("receive", ["recieve"]), "adjacent swap");
  assert.ok(SRS.isNearMiss("necessary", ["necesary"]), "missing letter");
  assert.ok(SRS.isNearMiss("because", ["becausee"]), "extra letter");
  assert.ok(SRS.isNearMiss("friend", ["  FREIND "]), "case and padding ignored");
  assert.ok(SRS.isNearMiss("friend", ["friand"]), "substitution");
  assert.ok(!SRS.isNearMiss("friend", ["frend", "fiend!!"]), "any far-off attempt makes it a plain miss");
  assert.ok(!SRS.isNearMiss("friend", ["frnd"]), "two letters missing");
  assert.ok(!SRS.isNearMiss("friend", []), "no attempts, e.g. a skip");
  assert.ok(!SRS.isNearMiss("friend", ["(timeout)"]));
  assert.ok(!SRS.isNearMiss("cat", ["cut"]), "too short for one edit to count as close");
  assert.ok(!SRS.isNearMiss("friend", ["friend"]), "an identical string is not a miss");
});

test("near miss halves reps, drops ease gently and is due tomorrow", () => {
  const rec = { reps: 5, interval: 40, ease: 2.5, dueAt: T0, updatedAt: T0 };
  const next = SRS.schedule({ rec, wasClean: false, nearMiss: true, now: T0, word: "receive" });
  assert.equal(next.reps, 2);
  assert.equal(next.interval, 1);
  assert.equal(next.dueAt, T0 + DAY);
  assert.ok(Math.abs(next.ease - 2.4) < 1e-9);
  assert.ok(!SRS.isLearned(next), "a lapse drops the word out of Learned until it is re-earned");
});

test("a plain miss still resets fully, even if nearMiss is not set", () => {
  const rec = { reps: 5, interval: 40, ease: 2.5, dueAt: T0, updatedAt: T0 };
  const next = SRS.schedule({ rec, wasClean: false, now: T0, word: "receive" });
  assert.equal(next.reps, 0);
  assert.equal(next.interval, 0);
  assert.equal(next.dueAt, T0);
  assert.ok(Math.abs(next.ease - 2.3) < 1e-9);
});

test("near miss never pushes ease below the floor", () => {
  const rec = { reps: 1, interval: 1, ease: SRS.MIN_EASE, dueAt: T0 };
  assert.equal(SRS.schedule({ rec, wasClean: false, nearMiss: true, now: T0, word: "receive" }).ease, SRS.MIN_EASE);
});

test("interval caps at MAX_INTERVAL_DAYS", () => {
  let rec = { reps: 8, interval: 60, ease: 3.0, dueAt: T0 };
  rec = SRS.schedule({ rec, wasClean: true, now: T0 + 60 * DAY, word: "cat", canBumpMastery: alwaysBump });
  assert.ok(rec.interval <= SRS.MAX_INTERVAL_DAYS);
});
