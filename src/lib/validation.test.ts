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
    weekday: 2,
    startTime: "17:30",
    endTime: "18:30",
    startsOn: "2026-09-01",
    endsOn: "2027-01-19",
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
    expect(scheduledSessionSchema.safeParse({ ...base, weekday: 7 }).success).toBe(false);
  });
});
