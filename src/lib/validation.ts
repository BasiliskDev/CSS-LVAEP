import { z } from "zod";

import { lessonStatusSchema, userRoleSchema } from "./constants";
import { parseDateInput } from "./fiscal-year";
import { MAX_OCCURRENCES, countOccurrences, nthOccurrence, normalizeWeekdays } from "./recurrence";
import { hoursBetween, parseTimeInput } from "./time-slot";

/** Shared shapes for every server action. Parsed server-side; the client is never trusted. */

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * `formData.get()` yields `null` for a field that isn't in the DOM (a collapsed
 * section, a checkbox that isn't rendered). Zod's `.optional()` only accepts
 * `undefined`, so every optional field here is `.nullish()` — otherwise an absent
 * field fails validation instead of being treated as blank.
 */
const optionalText = (max: number) =>
  trimmed(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** `<input type="date">` value -> UTC midnight Date. */
export const dateInput = z.string().transform((value, ctx) => {
  const parsed = parseDateInput(value);
  if (!parsed) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date" });
    return z.NEVER;
  }
  return parsed;
});

export const optionalDateInput = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = parseDateInput(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return parsed;
  });

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be 32 characters or fewer")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password must be 200 characters or fewer");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

export const onboardingSchema = z.object({
  displayName: trimmed(80).min(1, "Enter your name"),
  phone: optionalText(40),
  siteId: z.string().trim().nullish(),
  newSiteName: optionalText(120),
  newSiteAddress: optionalText(200),
  defaultDays: optionalText(120),
  defaultTimes: optionalText(120),
});

export const studentSchema = z.object({
  firstName: trimmed(80).min(1, "Enter a first name"),
  lastName: trimmed(80).min(1, "Enter a last name"),
  siteId: z.string().trim().nullish(),
  days: optionalText(120),
  times: optionalText(120),
  fiscalYearStart: z.coerce
    .number()
    .int()
    .min(2000, "Enter a valid fiscal year")
    .max(2100, "Enter a valid fiscal year"),
  notes: optionalText(2000),
});

const timeInput = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/**
 * A tutoring event is recorded as a time slot; `hours` is derived from it here and
 * never read from the request, so a hand-crafted POST can't inflate someone's total.
 * Absences carry no slot and are always worth zero hours.
 */
export const lessonSchema = z
  .object({
    date: dateInput,
    status: lessonStatusSchema,
    startTime: timeInput,
    endTime: timeInput,
    topics: optionalText(500),
    homeworkAssigned: z.coerce.boolean().default(false),
    homeworkCompleted: z.coerce.boolean().default(false),
    notes: optionalText(2000),
  })
  .transform((data, ctx) => {
    if (data.status !== "HELD") {
      return { ...data, startTime: null, endTime: null, hours: 0 };
    }

    if (!data.startTime || !data.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a start and end time",
        path: [data.startTime ? "endTime" : "startTime"],
      });
      return z.NEVER;
    }

    if (parseTimeInput(data.startTime) === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid time", path: ["startTime"] });
      return z.NEVER;
    }
    if (parseTimeInput(data.endTime) === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid time", path: ["endTime"] });
      return z.NEVER;
    }

    const hours = hoursBetween(data.startTime, data.endTime);
    if (hours === null) {
      ctx.addIssue({
        code: "custom",
        message: "The end time must be after the start time",
        path: ["endTime"],
      });
      return z.NEVER;
    }
    if (hours > 12) {
      ctx.addIssue({
        code: "custom",
        message: "That slot is longer than 12 hours — check the times",
        path: ["endTime"],
      });
      return z.NEVER;
    }

    return { ...data, hours };
  });

export const achievementToggleSchema = z.object({
  code: z.string().trim().min(1).max(16),
  attained: z.coerce.boolean(),
  attainedAt: optionalDateInput,
  note: optionalText(500),
});

export const customAchievementSchema = z.object({
  label: trimmed(200).min(1, "Describe the goal"),
});

export const reportSchema = z.object({
  title: trimmed(200).min(1, "Give the report a title"),
  periodStart: optionalDateInput,
  periodEnd: optionalDateInput,
  body: trimmed(20000).min(1, "Write something first"),
});

export const stopStudentSchema = z.object({
  stoppedReason: trimmed(500).min(1, "A reason is required"),
  stoppedAt: optionalDateInput,
});

// --- Invites ---------------------------------------------------------------------

/**
 * Zod validates before it transforms, so the trim has to happen in an earlier link of
 * the chain than the email check — otherwise " A@B.com " is rejected instead of
 * normalised. Addresses are stored lowercase so a duplicate can't slip in on case.
 */
const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"))
  .pipe(z.string().max(200, "That email address is too long"));

export const inviteSchema = z.object({
  email: emailInput,
  displayName: trimmed(80).min(1, "Enter their name"),
  role: userRoleSchema,
  siteId: z.string().trim().nullish(),
});

/** Same shape the open registration form used; accounts just come through a new door. */
export const acceptInviteSchema = z
  .object({
    username: usernameSchema,
    displayName: trimmed(80).min(1, "Enter your name"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// --- Office-managed students -----------------------------------------------------

/** Students are created by the office now, so the tutor is part of the form. */
export const adminStudentSchema = studentSchema.extend({
  tutorId: z.string().trim().min(1, "Choose a tutor"),
});

export const reassignStudentSchema = z.object({
  tutorId: z.string().trim().min(1, "Choose a tutor"),
});

/**
 * Removal can't be undone by the tutor, so the student's name has to be typed out. That
 * is the second half of the warning — the first is having to open the panel at all.
 */
export const removeStudentSchema = z.object({
  confirmName: trimmed(200).min(1, "Type the student's full name to confirm"),
  removedReason: optionalText(500),
});

// --- Scheduled sessions ----------------------------------------------------------

/** Long enough for a school year and a bit; short enough that a typo'd year is caught. */
const MAX_SERIES_MONTHS = 18;

/** How the office ended the series. "Never" is deliberately absent — see the schema. */
export const sessionEndModeSchema = z.enum(["ON_DATE", "AFTER_COUNT"]);
export type SessionEndMode = z.infer<typeof sessionEndModeSchema>;

/**
 * A recurring session. Mirrors lessonSchema: the cross-field rules live in a transform
 * so a bad slot, an inverted range or an impossible day combination reads back as a
 * field error rather than throwing.
 *
 * The transform always produces a concrete `endsOn`, whichever way the office ended the
 * series, so callers never have to care which mode was used. Both end modes then pass
 * through the same span cap, which is what keeps "after 400 meetings" from quietly
 * scheduling a decade.
 */
export const scheduledSessionSchema = z
  .object({
    tutorId: z.string().trim().min(1, "Choose a tutor"),
    title: optionalText(120),
    // One checkbox per day, so an unchecked set posts nothing at all.
    weekdays: z
      .array(z.coerce.number().int().min(0).max(6))
      .nullish()
      .transform((value) => value ?? []),
    startTime: z.string().trim(),
    endTime: z.string().trim(),
    startsOn: dateInput,
    // Absent when the office ended the series by count, so it cannot be required here.
    endsOn: dateInput.nullish(),
    endMode: sessionEndModeSchema.nullish().transform((value) => value ?? "ON_DATE"),
    occurrenceCount: z.coerce.number().int().nullish(),
    siteId: z.string().trim().nullish(),
    notes: optionalText(2000),
    studentIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one student"),
  })
  .transform((data, ctx) => {
    const weekdays = normalizeWeekdays(data.weekdays);
    if (weekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Pick at least one day of the week",
        path: ["weekdays"],
      });
      return z.NEVER;
    }

    if (parseTimeInput(data.startTime) === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid time", path: ["startTime"] });
      return z.NEVER;
    }
    if (parseTimeInput(data.endTime) === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid time", path: ["endTime"] });
      return z.NEVER;
    }

    const hours = hoursBetween(data.startTime, data.endTime);
    if (hours === null) {
      ctx.addIssue({
        code: "custom",
        message: "The end time must be after the start time",
        path: ["endTime"],
      });
      return z.NEVER;
    }
    if (hours > 12) {
      ctx.addIssue({
        code: "custom",
        message: "That slot is longer than 12 hours — check the times",
        path: ["endTime"],
      });
      return z.NEVER;
    }

    // Resolve whichever end the office chose down to a single last date. Everything
    // after this point is mode-agnostic.
    let endsOn: Date;
    let occurrenceCount: number | null = null;

    if (data.endMode === "AFTER_COUNT") {
      const count = data.occurrenceCount;
      if (count === null || count === undefined || Number.isNaN(count)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter how many meetings there are",
          path: ["occurrenceCount"],
        });
        return z.NEVER;
      }
      if (count < 1) {
        ctx.addIssue({
          code: "custom",
          message: "A session needs at least one meeting",
          path: ["occurrenceCount"],
        });
        return z.NEVER;
      }
      if (count > MAX_OCCURRENCES) {
        ctx.addIssue({
          code: "custom",
          message: `That is more than ${MAX_OCCURRENCES} meetings — check the number`,
          path: ["occurrenceCount"],
        });
        return z.NEVER;
      }

      const last = nthOccurrence(data.startsOn, weekdays, count);
      if (!last) {
        ctx.addIssue({
          code: "custom",
          message: "Those days and that count don't produce any dates",
          path: ["occurrenceCount"],
        });
        return z.NEVER;
      }
      endsOn = last;
      occurrenceCount = count;
    } else {
      if (!data.endsOn) {
        ctx.addIssue({ code: "custom", message: "Enter a last date", path: ["endsOn"] });
        return z.NEVER;
      }
      if (data.endsOn < data.startsOn) {
        ctx.addIssue({
          code: "custom",
          message: "The last date is before the first one",
          path: ["endsOn"],
        });
        return z.NEVER;
      }
      endsOn = data.endsOn;
    }

    // Which field to blame depends on which one the office actually filled in.
    const endPath = data.endMode === "AFTER_COUNT" ? ["occurrenceCount"] : ["endsOn"];

    // A mistyped year, or a four-digit meeting count, would otherwise schedule sessions
    // for decades. Applied to the resolved date, so it covers both modes at once.
    const months =
      (endsOn.getUTCFullYear() - data.startsOn.getUTCFullYear()) * 12 +
      (endsOn.getUTCMonth() - data.startsOn.getUTCMonth());
    if (months > MAX_SERIES_MONTHS) {
      ctx.addIssue({
        code: "custom",
        message: `A session can run for at most ${MAX_SERIES_MONTHS} months — check the ${
          data.endMode === "AFTER_COUNT" ? "number of meetings" : "year"
        }`,
        path: endPath,
      });
      return z.NEVER;
    }

    // A date range can miss every chosen day entirely ("Mondays, Tue 1st to Thu 3rd").
    // Counting is cheap and the alternative is a series that silently never meets.
    if (countOccurrences({ weekdays, startsOn: data.startsOn, endsOn }) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "That range contains none of the days you picked",
        path: endPath,
      });
      return z.NEVER;
    }

    return { ...data, weekdays, endsOn, endMode: data.endMode, occurrenceCount, hours };
  });

export const sessionSkipSchema = z.object({
  date: dateInput,
  reason: optionalText(200),
  logHoliday: z.coerce.boolean().default(false),
});
