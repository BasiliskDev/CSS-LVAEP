import { describe, expect, it } from "vitest";

import {
  hasSlotEnded,
  minutesSinceSlotEnd,
  todayInClubTZ,
  wallClockIn,
} from "./club-time";
import { parseDateInput, todayUTC } from "./fiscal-year";

const d = (iso: string) => parseDateInput(iso)!;

/**
 * Every case passes `now` explicitly. A test that reads the wall clock would pass in the
 * morning and fail at night, which is exactly the class of bug this module exists to fix.
 */
describe("wall-clock readings", () => {
  it("reads a summer instant as Eastern Daylight Time", () => {
    // 21:30 UTC is 17:30 in New Jersey while EDT (UTC-4) is in force.
    expect(wallClockIn(new Date("2026-09-02T21:30:00Z"))).toEqual({
      year: 2026,
      month: 9,
      day: 2,
      minutes: 17 * 60 + 30,
    });
  });

  it("reads a winter instant as Eastern Standard Time", () => {
    // The same 17:30 wall time is 22:30 UTC once EST (UTC-5) returns. These two cases
    // together are the whole daylight-saving proof — no tz library involved.
    expect(wallClockIn(new Date("2026-12-02T22:30:00Z"))).toEqual({
      year: 2026,
      month: 12,
      day: 2,
      minutes: 17 * 60 + 30,
    });
  });

  it("reads midnight as zero minutes, never 1440", () => {
    // Some ICU builds render midnight as hour "24" under `hour12: false`; that would
    // become 1440 and shift every midnight comparison by a full day.
    expect(wallClockIn(new Date("2026-09-02T04:00:00Z")).minutes).toBe(0);
  });

  it("honours an explicit timezone over the club default", () => {
    expect(wallClockIn(new Date("2026-09-02T21:30:00Z"), "UTC").minutes).toBe(21 * 60 + 30);
  });
});

describe("the club's today", () => {
  it("has not rolled over yet late in the club evening", () => {
    // 02:00 UTC on Oct 1 is still 22:00 on Sep 30 in New Jersey.
    expect(todayInClubTZ(new Date("2026-10-01T02:00:00Z"))).toEqual(d("2026-09-30"));
  });

  it("has rolled over by the club afternoon", () => {
    expect(todayInClubTZ(new Date("2026-10-01T14:00:00Z"))).toEqual(d("2026-10-01"));
  });

  it("rolls the year back across New Year's Eve", () => {
    expect(todayInClubTZ(new Date("2027-01-01T04:00:00Z"))).toEqual(d("2026-12-31"));
  });

  it("backs todayUTC(), so a new lesson defaults to the club's day", () => {
    expect(todayUTC()).toEqual(todayInClubTZ());
  });
});

describe("has the slot finished", () => {
  it("is false a minute before the end and true a minute after, in summer", () => {
    // An 18:30 club slot ends at 22:30 UTC in September.
    expect(hasSlotEnded(d("2026-09-02"), "18:30", new Date("2026-09-02T22:29:00Z"))).toBe(false);
    expect(hasSlotEnded(d("2026-09-02"), "18:30", new Date("2026-09-02T22:31:00Z"))).toBe(true);
  });

  it("is false a minute before the end and true a minute after, in winter", () => {
    // The same slot ends an hour later in UTC once EST returns.
    expect(hasSlotEnded(d("2026-12-02"), "18:30", new Date("2026-12-02T23:29:00Z"))).toBe(false);
    expect(hasSlotEnded(d("2026-12-02"), "18:30", new Date("2026-12-02T23:31:00Z"))).toBe(true);
  });

  it("does not fire four hours early (the naive-UTC regression)", () => {
    // Treating "18:30" as a UTC hour would call this finished. In club time it is 14:31 —
    // the tutor has not started yet. This is the bug the whole module exists to prevent.
    expect(hasSlotEnded(d("2026-09-02"), "18:30", new Date("2026-09-02T18:31:00Z"))).toBe(false);
  });

  it("waits out the grace period", () => {
    const thirtyMinutesAfter = new Date("2026-09-02T23:00:00Z");
    const ninetyMinutesAfter = new Date("2026-09-03T00:00:00Z");
    expect(hasSlotEnded(d("2026-09-02"), "18:30", thirtyMinutesAfter, 60)).toBe(false);
    expect(hasSlotEnded(d("2026-09-02"), "18:30", ninetyMinutesAfter, 60)).toBe(true);
  });

  it("never considers a slotless occurrence finished", () => {
    // There is nothing to measure against, so it must not be chased.
    expect(hasSlotEnded(d("2026-09-02"), null, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(hasSlotEnded(d("2026-09-02"), "half five", new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("counts a past day as finished and a future day as not", () => {
    const now = new Date("2026-09-10T16:00:00Z");
    expect(hasSlotEnded(d("2026-09-02"), "18:30", now)).toBe(true);
    expect(hasSlotEnded(d("2026-09-20"), "18:30", now)).toBe(false);
  });
});

describe("minutes since the slot ended", () => {
  it("is negative before and positive after", () => {
    expect(minutesSinceSlotEnd(d("2026-09-02"), "18:30", new Date("2026-09-02T22:00:00Z"))).toBe(-30);
    expect(minutesSinceSlotEnd(d("2026-09-02"), "18:30", new Date("2026-09-02T23:00:00Z"))).toBe(30);
  });

  it("is null when there is no end time", () => {
    expect(minutesSinceSlotEnd(d("2026-09-02"), null)).toBeNull();
  });

  it("stays within an hour of exact across the autumn transition", () => {
    // A wall-clock day is 25 hours when the clocks go back, so the whole-day term can be
    // off by 60 minutes for occurrences several days old. Documented and bounded, not exact.
    const elapsed = minutesSinceSlotEnd(
      d("2026-10-29"),
      "18:30",
      new Date("2026-11-05T23:30:00Z"),
    )!;
    const exact = 7 * 1440 + 60;
    expect(Math.abs(elapsed - exact)).toBeLessThanOrEqual(60);
  });
});
