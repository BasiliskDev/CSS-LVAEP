import { describe, expect, it } from "vitest";

import {
  addMinutes,
  formatDuration,
  formatTimeDisplay,
  formatTimeRange,
  hoursBetween,
  parseTimeInput,
} from "./time-slot";

describe("parseTimeInput", () => {
  it("reads HH:MM as minutes since midnight", () => {
    expect(parseTimeInput("00:00")).toBe(0);
    expect(parseTimeInput("06:30")).toBe(390);
    expect(parseTimeInput("18:00")).toBe(1080);
    expect(parseTimeInput("23:59")).toBe(1439);
  });

  it("rejects anything that isn't a real time", () => {
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("12:60")).toBeNull();
    expect(parseTimeInput("6:00")).toBeNull();
    expect(parseTimeInput("evening")).toBeNull();
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput(null)).toBeNull();
    expect(parseTimeInput(undefined)).toBeNull();
  });
});

describe("hoursBetween", () => {
  it("computes the hours a slot covers", () => {
    expect(hoursBetween("18:00", "19:30")).toBe(1.5);
    expect(hoursBetween("09:00", "10:00")).toBe(1);
    expect(hoursBetween("14:15", "15:45")).toBe(1.5);
    expect(hoursBetween("09:00", "09:30")).toBe(0.5);
  });

  it("rounds awkward lengths to two decimals", () => {
    expect(hoursBetween("09:00", "09:50")).toBe(0.83);
    expect(hoursBetween("09:00", "09:20")).toBe(0.33);
  });

  it("treats a backwards or zero-length slot as invalid, not overnight", () => {
    expect(hoursBetween("19:00", "18:00")).toBeNull();
    expect(hoursBetween("18:00", "18:00")).toBeNull();
  });

  it("returns null when either end is missing or malformed", () => {
    expect(hoursBetween(null, "19:00")).toBeNull();
    expect(hoursBetween("18:00", null)).toBeNull();
    expect(hoursBetween("18:00", "7pm")).toBeNull();
  });

  it("handles a slot spanning noon and midnight boundaries", () => {
    expect(hoursBetween("11:30", "12:30")).toBe(1);
    expect(hoursBetween("23:00", "23:59")).toBe(0.98);
  });
});

describe("display helpers", () => {
  it("formats 24h times as 12h with a meridiem", () => {
    expect(formatTimeDisplay("00:00")).toBe("12:00 AM");
    expect(formatTimeDisplay("09:05")).toBe("9:05 AM");
    expect(formatTimeDisplay("12:00")).toBe("12:00 PM");
    expect(formatTimeDisplay("18:30")).toBe("6:30 PM");
    expect(formatTimeDisplay("23:59")).toBe("11:59 PM");
  });

  it("formats a range, and nothing when the slot is incomplete", () => {
    expect(formatTimeRange("18:00", "19:30")).toBe("6:00 PM – 7:30 PM");
    expect(formatTimeRange("18:00", null)).toBe("");
    expect(formatTimeRange(null, null)).toBe("");
  });

  it("reads a duration back in plain words", () => {
    expect(formatDuration(1.5)).toBe("1 hr 30 min");
    expect(formatDuration(1)).toBe("1 hr");
    expect(formatDuration(2)).toBe("2 hrs");
    expect(formatDuration(0.5)).toBe("30 min");
    expect(formatDuration(0.83)).toBe("50 min");
  });
});

describe("addMinutes", () => {
  it("shifts a time forward, which the form uses to follow the start", () => {
    expect(addMinutes("18:00", 60)).toBe("19:00");
    expect(addMinutes("18:45", 30)).toBe("19:15");
  });

  it("clamps at the end of the day rather than wrapping", () => {
    expect(addMinutes("23:30", 60)).toBe("23:59");
    expect(addMinutes("00:10", -60)).toBe("00:00");
  });
});
