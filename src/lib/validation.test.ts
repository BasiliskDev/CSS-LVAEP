import { describe, expect, it } from "vitest";

import { fieldErrorsOf } from "./action-state";
import {
  acceptInviteSchema,
  adminStudentSchema,
  inviteSchema,
  lessonSchema,
  onboardingSchema,
  removeStudentSchema,
  reportSchema,
  scheduledSessionSchema,
  studentSchema,
} from "./validation";

/**
 * Field errors the way an action would report them, so these assertions exercise the
 * same reducer the forms render through rather than poking at raw Zod issues.
 */
function fieldErrors(parsed: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  return parsed.error ? fieldErrorsOf(parsed.error) : {};
}

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

describe("invites", () => {
  it("normalises a padded, mixed-case address", () => {
    const parsed = inviteSchema.safeParse({
      email: "  Nicky.Smith@School.ORG ",
      displayName: "Nicky Smith",
      role: "TUTOR",
      siteId: null,
    });
    expect(parsed.success).toBe(true);
    // Stored lowercase, so a duplicate can't slip in on case alone.
    expect(parsed.success && parsed.data.email).toBe("nicky.smith@school.org");
  });

  it("rejects something that isn't an address", () => {
    const parsed = inviteSchema.safeParse({
      email: "nicky at school",
      displayName: "Nicky",
      role: "TUTOR",
      siteId: null,
    });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ email: "Enter a valid email address" });
  });

  it("rejects a role that isn't one of ours", () => {
    const parsed = inviteSchema.safeParse({
      email: "a@b.com",
      displayName: "A",
      role: "SUPERUSER",
      siteId: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("points a password mismatch at the confirm field", () => {
    const parsed = acceptInviteSchema.safeParse({
      username: "nicky",
      displayName: "Nicky Smith",
      password: "correct-horse",
      confirmPassword: "correct-hoarse",
    });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ confirmPassword: "Passwords do not match" });
  });
});

describe("office-managed students", () => {
  it("requires a tutor", () => {
    const parsed = adminStudentSchema.safeParse({
      firstName: "Nicky",
      lastName: "Smith",
      tutorId: "",
      fiscalYearStart: 2026,
      siteId: null,
      days: null,
      times: null,
      notes: null,
    });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ tutorId: "Choose a tutor" });
  });

  it("requires the student's name to be typed before removal", () => {
    expect(removeStudentSchema.safeParse({ confirmName: "", removedReason: null }).success).toBe(
      false,
    );
    // The reason is optional — the typed name is what makes it deliberate.
    expect(
      removeStudentSchema.safeParse({ confirmName: "Nicky Smith", removedReason: null }).success,
    ).toBe(true);
  });
});

describe("scheduled sessions", () => {
  const base = {
    tutorId: "t1",
    title: null,
    weekdays: ["2"],
    startTime: "17:30",
    endTime: "18:30",
    startsOn: "2026-09-01",
    endsOn: "2027-01-19",
    endMode: "ON_DATE",
    occurrenceCount: null,
    siteId: null,
    notes: null,
    studentIds: ["s1", "s2"],
  };

  it("accepts a whole term and derives the slot length", () => {
    const parsed = scheduledSessionSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.hours).toBe(1);
  });

  it("accepts the nulls formData.get() actually delivers for optional fields", () => {
    // The .nullish() regression guard: title and notes are absent from the DOM when blank.
    const parsed = scheduledSessionSchema.safeParse({ ...base, title: null, notes: null });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.title).toBeNull();
  });

  it("rejects a backwards slot", () => {
    const parsed = scheduledSessionSchema.safeParse({ ...base, startTime: "18:30", endTime: "17:30" });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ endTime: "The end time must be after the start time" });
  });

  it("rejects a zero-length slot", () => {
    const parsed = scheduledSessionSchema.safeParse({ ...base, startTime: "17:30", endTime: "17:30" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a last date before the first", () => {
    const parsed = scheduledSessionSchema.safeParse({
      ...base,
      startsOn: "2027-01-19",
      endsOn: "2026-09-01",
    });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ endsOn: "The last date is before the first one" });
  });

  it("rejects a mistyped year rather than scheduling for decades", () => {
    const parsed = scheduledSessionSchema.safeParse({ ...base, endsOn: "2029-01-19" });
    expect(parsed.success).toBe(false);
    expect(Object.keys(fieldErrors(parsed))).toEqual(["endsOn"]);
  });

  it("needs at least one student", () => {
    const parsed = scheduledSessionSchema.safeParse({ ...base, studentIds: [] });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ studentIds: "Pick at least one student" });
  });

  it("rejects a weekday outside the week", () => {
    expect(scheduledSessionSchema.safeParse({ ...base, weekdays: ["7"] }).success).toBe(false);
  });

  it("needs at least one day of the week", () => {
    // An untouched day picker posts nothing at all, which must be a field error rather
    // than a series that never meets.
    const parsed = scheduledSessionSchema.safeParse({ ...base, weekdays: [] });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({ weekdays: "Pick at least one day of the week" });
  });

  it("accepts the absent day list FormData yields when nothing is checked", () => {
    expect(scheduledSessionSchema.safeParse({ ...base, weekdays: null }).success).toBe(false);
  });

  it("takes several days and normalises them", () => {
    // getAll gives strings, in DOM order, and a duplicate is possible. What reaches the
    // database must be ascending and distinct.
    const parsed = scheduledSessionSchema.safeParse({ ...base, weekdays: ["4", "2", "2"] });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.weekdays).toEqual([2, 4]);
  });

  it("rejects a range that misses every day picked", () => {
    // Mondays, between a Tuesday and the Thursday of the same week: no Monday exists in
    // there, so the series would never meet.
    const parsed = scheduledSessionSchema.safeParse({
      ...base,
      weekdays: ["1"],
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    expect(parsed.success).toBe(false);
    expect(fieldErrors(parsed)).toEqual({
      endsOn: "That range contains none of the days you picked",
    });
  });

  describe("ending after a number of meetings", () => {
    const byCount = {
      ...base,
      endMode: "AFTER_COUNT",
      endsOn: null,
      occurrenceCount: "10",
    };

    it("turns the count into a concrete last date", () => {
      // 10 Tuesdays from Sep 1 is Nov 3. The count is the office's input; the date is
      // what gets stored, because every query downstream reads endsOn.
      const parsed = scheduledSessionSchema.safeParse(byCount);
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.endsOn).toEqual(new Date("2026-11-03T00:00:00.000Z"));
      expect(parsed.success && parsed.data.occurrenceCount).toBe(10);
    });

    it("spreads the count across every day picked", () => {
      // 10 meetings on Tue *and* Thu is five weeks, not ten.
      const parsed = scheduledSessionSchema.safeParse({ ...byCount, weekdays: ["2", "4"] });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.endsOn).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    });

    it("does not need a last date", () => {
      // The date input isn't rendered in this mode, so FormData has no endsOn at all.
      const withoutEndsOn: Record<string, unknown> = { ...byCount };
      delete withoutEndsOn.endsOn;
      expect(scheduledSessionSchema.safeParse(withoutEndsOn).success).toBe(true);
    });

    it("keeps occurrenceCount null when the office ended on a date", () => {
      const parsed = scheduledSessionSchema.safeParse({ ...base, occurrenceCount: "99" });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.occurrenceCount).toBeNull();
    });

    it("needs a count in this mode", () => {
      const parsed = scheduledSessionSchema.safeParse({ ...byCount, occurrenceCount: null });
      expect(parsed.success).toBe(false);
      expect(fieldErrors(parsed)).toEqual({
        occurrenceCount: "Enter how many meetings there are",
      });
    });

    it("rejects zero and negative counts", () => {
      expect(scheduledSessionSchema.safeParse({ ...byCount, occurrenceCount: "0" }).success).toBe(false);
      expect(scheduledSessionSchema.safeParse({ ...byCount, occurrenceCount: "-4" }).success).toBe(false);
    });

    it("blames the count, not the date, when the span is too long", () => {
      // 300 weekly meetings is nearly six years. The span cap has to catch it, and the
      // error has to land on the field the office actually filled in.
      const parsed = scheduledSessionSchema.safeParse({ ...byCount, occurrenceCount: "300" });
      expect(parsed.success).toBe(false);
      expect(Object.keys(fieldErrors(parsed))).toEqual(["occurrenceCount"]);
    });
  });
});
