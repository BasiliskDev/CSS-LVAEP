import { z } from "zod";

import { lessonStatusSchema } from "./constants";
import { parseDateInput } from "./fiscal-year";
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

export const registerSchema = z
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
