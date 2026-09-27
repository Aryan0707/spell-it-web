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

test("mastery threshold matches app constant", () => {
  const mastered = { reps: SRS.MASTERY_REPS, interval: 10, ease: 2.5, dueAt: T0 };
  const notYet = { reps: SRS.MASTERY_REPS - 1, interval: 10, ease: 2.5, dueAt: T0 };
  assert.ok(SRS.isMastered(mastered));
  assert.ok(!SRS.isMastered(notYet));
});

test("interval caps at MAX_INTERVAL_DAYS", () => {
  let rec = { reps: 8, interval: 60, ease: 3.0, dueAt: T0 };
  rec = SRS.schedule({ rec, wasClean: true, now: T0 + 60 * DAY, word: "cat", canBumpMastery: alwaysBump });
  assert.ok(rec.interval <= SRS.MAX_INTERVAL_DAYS);
});
