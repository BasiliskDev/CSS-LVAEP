import { describe, expect, it } from "vitest";

import { parseDateInput } from "./fiscal-year";
import {
  MAX_OCCURRENCES,
  addDaysUTC,
  countOccurrences,
  isOccurrence,
  normalizeWeekdays,
  nthOccurrence,
  occurrencesBetween,
  weeklyOccurrences,
  type WeeklyRule,
} from "./recurrence";

const d = (iso: string) => parseDateInput(iso)!;
const keys = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

/** 2026-09-01 is a Tuesday; 2027-01-19 is the last Tuesday on or before 2027-01-20. */
const TUESDAYS: WeeklyRule = { weekdays: [2], startsOn: d("2026-09-01"), endsOn: d("2027-01-19") };

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
    const dates = weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-01"), endsOn: d("2026-09-15") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15"]);
  });

  it("skips forward when startsOn is the day before the weekday", () => {
    // Aug 31 is a Monday, so the first Tuesday is the next day, not a week later.
    const dates = weeklyOccurrences({ weekdays: [2], startsOn: d("2026-08-31"), endsOn: d("2026-09-08") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("treats endsOn as inclusive", () => {
    const dates = weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-01"), endsOn: d("2026-09-08") });
    expect(keys(dates)).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("returns nothing for an inverted range", () => {
    expect(weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-15"), endsOn: d("2026-09-01") })).toEqual([]);
  });

  it("returns one date when the range is a single matching day", () => {
    expect(
      keys(weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-01"), endsOn: d("2026-09-01") })),
    ).toEqual(["2026-09-01"]);
  });

  it("returns nothing when the single-day range is the wrong weekday", () => {
    expect(weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-02"), endsOn: d("2026-09-02") })).toEqual([]);
  });

  it("rejects a weekday outside 0-6", () => {
    expect(weeklyOccurrences({ ...TUESDAYS, weekdays: [7] })).toEqual([]);
    expect(weeklyOccurrences({ ...TUESDAYS, weekdays: [-1] })).toEqual([]);
  });

  it("returns nothing when no day is picked at all", () => {
    // An unchecked day picker posts no values, which must mean "no dates" rather than
    // "every date".
    expect(weeklyOccurrences({ ...TUESDAYS, weekdays: [] })).toEqual([]);
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
    const dates = weeklyOccurrences({ weekdays: [2], startsOn: d("2026-09-01"), endsOn: d("2076-09-01") });
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

describe("several days a week", () => {
  /** Tuesdays and Thursdays, the shape most tutoring pairs actually run on. */
  const TUE_THU: WeeklyRule = {
    weekdays: [2, 4],
    startsOn: d("2026-09-01"),
    endsOn: d("2026-09-14"),
  };

  it("interleaves the days in date order, not grouped by weekday", () => {
    // The whole point: a Tue/Thu series reads Tue, Thu, Tue, Thu — the naive
    // implementation (one pass per weekday, concatenated) would give Tue, Tue, Thu, Thu.
    expect(keys(weeklyOccurrences(TUE_THU))).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-08",
      "2026-09-10",
    ]);
  });

  it("starts each day on its own first date after startsOn", () => {
    // Starting on a Wednesday, the Thursday comes first and the Tuesday waits a week.
    const dates = weeklyOccurrences({ ...TUE_THU, startsOn: d("2026-09-02") });
    expect(keys(dates)).toEqual(["2026-09-03", "2026-09-08", "2026-09-10"]);
  });

  it("de-duplicates a day picked twice", () => {
    // Two posted values for the same checkbox must not double every date.
    expect(keys(weeklyOccurrences({ ...TUE_THU, weekdays: [2, 2, 4] }))).toEqual(
      keys(weeklyOccurrences(TUE_THU)),
    );
  });

  it("keeps the valid days when one is junk", () => {
    expect(keys(weeklyOccurrences({ ...TUE_THU, weekdays: [2, 99] }))).toEqual([
      "2026-09-01",
      "2026-09-08",
    ]);
  });

  it("handles every day of the week", () => {
    const dates = weeklyOccurrences({
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startsOn: d("2026-09-01"),
      endsOn: d("2026-09-07"),
    });
    expect(keys(dates)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
    ]);
  });

  it("caps a runaway multi-day range at the earliest dates", () => {
    // Seven days a week for fifty years. The cap has to keep the *first* MAX dates: an
    // implementation that filled its budget one weekday at a time would return fifty
    // years of Sundays instead of the next ten weeks.
    const dates = weeklyOccurrences({
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startsOn: d("2026-09-01"),
      endsOn: d("2076-09-01"),
    });
    expect(dates).toHaveLength(MAX_OCCURRENCES);
    expect(keys(dates)[0]).toBe("2026-09-01");
    expect(keys(dates)[1]).toBe("2026-09-02");
    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
    }
  });

  it("accepts either day as an occurrence and rejects a third", () => {
    expect(isOccurrence(TUE_THU, d("2026-09-08"))).toBe(true);
    expect(isOccurrence(TUE_THU, d("2026-09-10"))).toBe(true);
    expect(isOccurrence(TUE_THU, d("2026-09-09"))).toBe(false);
  });

  it("normalises a posted day list", () => {
    expect(normalizeWeekdays([4, 2, 2, 9, -1, 0])).toEqual([0, 2, 4]);
    expect(normalizeWeekdays([1.5])).toEqual([]);
  });
});

describe("ending after a number of meetings", () => {
  it("counts the first date itself as meeting one", () => {
    expect(nthOccurrence(d("2026-09-01"), [2], 1)).toEqual(d("2026-09-01"));
  });

  it("walks whole weeks for a single day", () => {
    expect(nthOccurrence(d("2026-09-01"), [2], 3)).toEqual(d("2026-09-15"));
  });

  it("alternates across two days", () => {
    expect(nthOccurrence(d("2026-09-01"), [2, 4], 1)).toEqual(d("2026-09-01"));
    expect(nthOccurrence(d("2026-09-01"), [2, 4], 2)).toEqual(d("2026-09-03"));
    expect(nthOccurrence(d("2026-09-01"), [2, 4], 3)).toEqual(d("2026-09-08"));
    expect(nthOccurrence(d("2026-09-01"), [2, 4], 4)).toEqual(d("2026-09-10"));
  });

  it("starts the cycle from the first real date, not from startsOn's weekday", () => {
    // Starting Wednesday the 2nd, meeting one is Thursday and meeting two is the
    // following Tuesday — the cycle order is by date, not by weekday number.
    expect(nthOccurrence(d("2026-09-02"), [2, 4], 1)).toEqual(d("2026-09-03"));
    expect(nthOccurrence(d("2026-09-02"), [2, 4], 2)).toEqual(d("2026-09-08"));
  });

  it("agrees with the listed occurrences at every position", () => {
    // The two end modes have to describe the same series, or "after 12 meetings" would
    // store a date that produces some other number of meetings. This is that contract.
    const weekdays = [1, 3, 5];
    const startsOn = d("2026-09-02");
    const listed = weeklyOccurrences({ weekdays, startsOn, endsOn: d("2027-02-01") });

    expect(listed.length).toBeGreaterThan(20);
    for (let i = 0; i < listed.length; i += 1) {
      expect(nthOccurrence(startsOn, weekdays, i + 1)).toEqual(listed[i]);
    }
  });

  it("makes the derived end date produce exactly that many meetings", () => {
    const weekdays = [2, 4];
    const startsOn = d("2026-09-01");
    const endsOn = nthOccurrence(startsOn, weekdays, 15)!;
    expect(countOccurrences({ weekdays, startsOn, endsOn })).toBe(15);
  });

  it("refuses a count that isn't a sane number of meetings", () => {
    expect(nthOccurrence(d("2026-09-01"), [2], 0)).toBeNull();
    expect(nthOccurrence(d("2026-09-01"), [2], -3)).toBeNull();
    expect(nthOccurrence(d("2026-09-01"), [2], 1.5)).toBeNull();
    expect(nthOccurrence(d("2026-09-01"), [2], MAX_OCCURRENCES + 1)).toBeNull();
  });

  it("refuses to pick a date when no day is chosen", () => {
    expect(nthOccurrence(d("2026-09-01"), [], 4)).toBeNull();
  });

  it("stays at UTC midnight across a daylight-saving change", () => {
    // Meeting 20 of a Tue/Thu series beginning in September lands past the Nov 1
    // fall-back; the stored date must still be exact UTC midnight.
    const date = nthOccurrence(d("2026-09-01"), [2, 4], 20)!;
    expect(date.getTime()).toBeGreaterThan(d("2026-11-01").getTime());
    expect(date.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });
});
