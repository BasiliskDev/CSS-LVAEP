import { describe, expect, it } from "vitest";

import { parseDateInput } from "./fiscal-year";
import {
  missingOccurrences,
  pendingKey,
  type SeriesForPending,
} from "./pending-sessions";

const d = (iso: string) => parseDateInput(iso)!;

/** Tuesdays 17:30-18:30 club time, through the autumn term. */
const series: SeriesForPending = {
  id: "s1",
  weekday: 2,
  startTime: "17:30",
  endTime: "18:30",
  startsOn: d("2026-09-01"),
  endsOn: d("2026-12-15"),
  studentIds: ["nicky", "tony", "bonito"],
};

/** The Tuesday after 2026-09-08, well past that day's 18:30 slot (22:30 UTC). */
const WEDNESDAY_MORNING = new Date("2026-09-09T13:00:00Z");

function run(overrides: Partial<Parameters<typeof missingOccurrences>[0]> = {}) {
  return missingOccurrences({
    series: [series],
    loggedKeys: new Set<string>(),
    skippedKeys: new Set<string>(),
    windowStart: d("2026-09-01"),
    now: WEDNESDAY_MORNING,
    ...overrides,
  });
}

describe("which finished sessions still owe hours", () => {
  it("lists every student when nothing was logged", () => {
    const pending = run();
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-01", "2026-09-08"]);
    expect(pending[1].missingStudentIds).toEqual(["nicky", "tony", "bonito"]);
  });

  it("lists only the students still missing", () => {
    const pending = run({
      loggedKeys: new Set([
        pendingKey("s1", "2026-09-08", "nicky"),
        pendingKey("s1", "2026-09-08", "tony"),
      ]),
    });
    const sep8 = pending.find((p) => p.dateKey === "2026-09-08")!;
    expect(sep8.missingStudentIds).toEqual(["bonito"]);
  });

  it("drops an occurrence once every student is logged", () => {
    const pending = run({
      loggedKeys: new Set(
        series.studentIds.map((id) => pendingKey("s1", "2026-09-08", id)),
      ),
    });
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-01"]);
  });

  it("never chases a cancelled date, even with nothing logged", () => {
    const pending = run({ skippedKeys: new Set([pendingKey("s1", "2026-09-08")]) });
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-01"]);
  });

  it("ignores an occurrence whose slot has not ended yet", () => {
    // 20:00 UTC on the day itself is 16:00 club time — the 17:30 session hasn't started.
    const pending = run({ now: new Date("2026-09-01T20:00:00Z") });
    expect(pending).toEqual([]);
  });

  it("waits out the grace period before chasing today's session", () => {
    // 23:00 UTC is 19:00 club time: 30 minutes after the slot, inside the hour of grace.
    expect(run({ now: new Date("2026-09-01T23:00:00Z") })).toEqual([]);
    // 00:30 UTC the next day is 20:30 club time — 120 minutes after, so it is fair game.
    const pending = run({ now: new Date("2026-09-02T00:30:00Z") });
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-01"]);
  });

  it("honours the lookback window", () => {
    const pending = run({ windowStart: d("2026-09-05") });
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-08"]);
  });

  it("never reaches back before the series itself started", () => {
    const pending = run({ windowStart: d("2026-01-01") });
    expect(pending.map((p) => p.dateKey)).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("contributes nothing for a series with no students left", () => {
    expect(run({ series: [{ ...series, studentIds: [] }] })).toEqual([]);
  });

  it("reports two series on the same weekday independently", () => {
    const other: SeriesForPending = {
      ...series,
      id: "s2",
      startTime: "19:00",
      endTime: "20:00",
      studentIds: ["ada"],
    };
    const pending = run({ series: [series, other] });
    expect(pending.filter((p) => p.seriesId === "s1")).toHaveLength(2);
    expect(pending.filter((p) => p.seriesId === "s2")).toHaveLength(2);
  });

  it("returns the oldest gap first, so a backlog clears in order", () => {
    const pending = run({
      series: [
        { ...series, id: "late", weekday: 4, studentIds: ["ada"] }, // Thursdays
        series,
      ],
      windowStart: d("2026-09-01"),
    });
    const times = pending.map((p) => p.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(pending[0].dateKey).toBe("2026-09-01");
  });
});
