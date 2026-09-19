import { describe, expect, it } from "vitest";

import {
  lessonSchema,
  onboardingSchema,
  reportSchema,
  studentSchema,
} from "./validation";

/**
 * Regression guard for a bug that silently broke every form:
 * `formData.get()` returns `null` for a field that isn't in the DOM (a collapsed
 * section, a control hidden behind a toggle). Zod's `.optional()` accepts only
 * `undefined`, so those nulls failed validation and the action returned field
 * errors instead of saving. Optional fields must accept null and store it as null.
 */
describe("optional fields accept the null that FormData yields", () => {
  it("onboarding parses with every optional field absent", () => {
    const result = onboardingSchema.safeParse({
      displayName: "Jane Tutor",
      phone: null,
      siteId: "site_1",
      newSiteName: null,
      newSiteAddress: null,
      defaultDays: null,
      defaultTimes: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
      expect(result.data.newSiteName).toBeNull();
    }
  });

  it("student parses with optional fields absent", () => {
    const result = studentSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      siteId: null,
      days: null,
      times: null,
      fiscalYearStart: "2026",
      notes: null,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fiscalYearStart).toBe(2026);
  });

  it("lesson parses with optional fields absent", () => {
    const result = lessonSchema.safeParse({
      date: "2026-09-18",
      status: "HELD",
      startTime: "18:00",
      endTime: "19:30",
      topics: null,
      homeworkAssigned: false,
      homeworkCompleted: false,
      notes: null,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hours).toBe(1.5);
  });

  it("report parses with both period dates absent", () => {
    const result = reportSchema.safeParse({
      title: "Fall term",
      periodStart: null,
      periodEnd: null,
      body: "Good progress.",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.periodStart).toBeNull();
  });

  it("empty strings are stored as null, not as empty text", () => {
    const result = studentSchema.safeParse({
      firstName: "Maria",
      lastName: "Santos",
      days: "",
      times: "   ",
      fiscalYearStart: 2026,
      notes: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toBeNull();
      expect(result.data.times).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });
});

describe("lesson rules mirror the paper form", () => {
  const base = {
    date: "2026-09-18",
    status: "HELD" as const,
    homeworkAssigned: false,
    homeworkCompleted: false,
  };

  it("derives the hours from the time slot", () => {
    const result = lessonSchema.safeParse({
      ...base,
      startTime: "18:00",
      endTime: "19:30",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hours).toBe(1.5);
      expect(result.data.startTime).toBe("18:00");
      expect(result.data.endTime).toBe("19:30");
    }
  });

  it("ignores any hours the client tries to post", () => {
    const result = lessonSchema.safeParse({
      ...base,
      startTime: "09:00",
      endTime: "10:00",
      hours: "99",
    });
    expect(result.success).toBe(true);
    // hours is derived server-side, so a forged field cannot inflate a total.
    if (result.success) expect(result.data.hours).toBe(1);
  });

  it("drops the slot and zeroes the hours on an absence", () => {
    const result = lessonSchema.safeParse({
      ...base,
      status: "STUDENT_ABSENT",
      startTime: "18:00",
      endTime: "19:30",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hours).toBe(0);
      expect(result.data.startTime).toBeNull();
      expect(result.data.endTime).toBeNull();
    }
  });

  it("requires a slot on a lesson that was actually held", () => {
    expect(lessonSchema.safeParse({ ...base, startTime: null, endTime: null }).success).toBe(
      false,
    );
    expect(
      lessonSchema.safeParse({ ...base, startTime: "18:00", endTime: null }).success,
    ).toBe(false);
  });

  it("rejects a backwards or zero-length slot", () => {
    expect(
      lessonSchema.safeParse({ ...base, startTime: "19:00", endTime: "18:00" }).success,
    ).toBe(false);
    expect(
      lessonSchema.safeParse({ ...base, startTime: "18:00", endTime: "18:00" }).success,
    ).toBe(false);
  });

  it("rejects an implausibly long slot rather than storing it", () => {
    const result = lessonSchema.safeParse({
      ...base,
      startTime: "07:00",
      endTime: "22:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time", () => {
    expect(
      lessonSchema.safeParse({ ...base, startTime: "6pm", endTime: "19:00" }).success,
    ).toBe(false);
  });

  it("rejects a malformed date rather than silently storing today", () => {
    const result = lessonSchema.safeParse({
      ...base,
      date: "18/09/2026",
      startTime: "18:00",
      endTime: "19:00",
    });
    expect(result.success).toBe(false);
  });
});
