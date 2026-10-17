import { describe, expect, it } from "vitest";

import { parseDateInput } from "./fiscal-year";
import {
  MAX_OCCURRENCES,
  addDaysUTC,
  countOccurrences,
  isOccurrence,
  occurrencesBetween,
  weeklyOccurrences,
  type WeeklyRule,
} from "./recurrence";

const d = (iso: string) => parseDateInput(iso)!;
const keys = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

/** 2026-09-01 is a Tuesday; 2027-01-19 is the last Tuesday on or before 2027-01-20. */
const TUESDAYS: WeeklyRule = { weekday: 2, startsOn: d("2026-09-01"), endsOn: d("2027-01-19") };

describe("whole-day arithmetic", () => {
  it("crosses a month end", () => {
    expect(addDaysUTC(d("2026-09-30"), 1)).toEqual(d("2026-10-01"));
  });

  it("crosses a year end", () => {
    expect(addDaysUTC(d("2026-12-31"), 1)).toEqual(d("2027-01-01"));
  });

  it("lands on Feb 29 in a leap year", () => {
    expect(addDaysUTC(d("2028-02-28"), 1)).toEqual(d("2028-02-29"));
  });

  it("steps backwards too", () => {
    expect(addDaysUTC(d("2026-09-01"), -1)).toEqual(d("2026-08-31"));
  });
});

describe("weekly occurrences", () => {
  it("includes startsOn when it already falls on the weekday", () => {
    const dates = weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-01"), endsOn: d("2026-09-15") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("skips forward when startsOn is the day before the weekday", () => {
    // Aug 31 is a Monday, so the first Tuesday is the next day, not a week later.
    const dates = weeklyOccurrences({ weekday: 2, startsOn: d("2026-08-31"), endsOn: d("2026-09-08") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("treats endsOn as inclusive", () => {
    const dates = weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-01"), endsOn: d("2026-09-08") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("returns nothing for an inverted range", () => {
    expect(weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-15"), endsOn: d("2026-09-01") })).toEqual([]);
  });

  it("returns one date when the range is a single matching day", () => {
    expect(
      keys(weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-01"), endsOn: d("2026-09-01") })),
    ).toEqual(["2026-09-01"]);
  });

  it("returns nothing when the single-day range is the wrong weekday", () => {
    expect(weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-02"), endsOn: d("2026-09-02") })).toEqual([]);
  });

  it("rejects a weekday outside 0-6", () => {
    expect(weeklyOccurrences({ ...TUESDAYS, weekday: 7 })).toEqual([]);
    expect(weeklyOccurrences({ ...TUESDAYS, weekday: -1 })).toEqual([]);
  });

  it("builds a whole term of Tuesdays, daylight saving included", () => {
    // The real shape of a club term, and it crosses the Nov 1 2026 fall-back. Every date
    // must stay a Tuesday at exact UTC midnight, seven days apart — which is what makes
    // UTC-midnight arithmetic the right choice over any local-time stepping.
    const dates = weeklyOccurrences(TUESDAYS);

    expect(dates).toHaveLength(21);
    expect(keys(dates)[0]).toBe("2026-09-01");
    expect(keys(dates).at(-1)).toBe("2027-01-19");
    expect(dates.some((date) => date.getTime() > d("2026-11-01").getTime())).toBe(true);

    for (const date of dates) {
      expect(date.getUTCDay()).toBe(2);
      expect(date.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i].getTime() - dates[i - 1].getTime()).toBe(604_800_000);
    }
  });

  it("caps a runaway range rather than building a million dates", () => {
    // A mistyped end year must not hang the request.
    const dates = weeklyOccurrences({ weekday: 2, startsOn: d("2026-09-01"), endsOn: d("2076-09-01") });
    expect(dates).toHaveLength(MAX_OCCURRENCES);
  });

  it("counts what it lists", () => {
    expect(countOccurrences(TUESDAYS)).toBe(21);
  });
});

describe("windowing", () => {
  it("includes a date equal to the window start and excludes one equal to the end", () => {
    const dates = occurrencesBetween(TUESDAYS, d("2026-09-08"), d("2026-09-22"));
    expect(keys(dates)).toEqual(["2026-09-08", "2026-09-15"]);
  });

  it("returns nothing for a window before the series starts", () => {
    expect(occurrencesBetween(TUESDAYS, d("2026-01-01"), d("2026-02-01"))).toEqual([]);
  });
});

describe("membership", () => {
  it("accepts a date in the series", () => {
    expect(isOccurrence(TUESDAYS, d("2026-11-24"))).toBe(true);
  });

  it("rejects the wrong weekday", () => {
    expect(isOccurrence(TUESDAYS, d("2026-11-25"))).toBe(false);
  });

  it("rejects the right weekday outside the range", () => {
    // This is the guard standing between a URL path segment and an arbitrary write.
    expect(isOccurrence(TUESDAYS, d("2026-08-25"))).toBe(false);
    expect(isOccurrence(TUESDAYS, d("2027-01-26"))).toBe(false);
  });
});
