-- Scheduled sessions gain Google-Calendar-style recurrence: several weekdays per series,
-- and an end expressed either as a date or as a number of meetings.
--
-- Written by hand rather than generated. `prisma migrate dev` would drop "weekday" and
-- add "weekdays" as two unrelated statements, silently losing the day of every existing
-- series. The UPDATE between them is the whole point of this file.

-- 1. Add the list column with a default so the NOT NULL holds for existing rows.
ALTER TABLE "ScheduledSession"
  ADD COLUMN "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- 2. Carry every existing series over: one weekday becomes a one-element list.
UPDATE "ScheduledSession" SET "weekdays" = ARRAY["weekday"];

-- 3. Drop the default, so a future insert must state its days explicitly rather than
--    quietly creating a series that never meets.
ALTER TABLE "ScheduledSession" ALTER COLUMN "weekdays" DROP DEFAULT;

-- 4. Only now is the old column redundant.
ALTER TABLE "ScheduledSession" DROP COLUMN "weekday";

-- 5. How the office expressed the end. Every existing series was entered as a date, and
--    the default matches, so no backfill is needed here.
ALTER TABLE "ScheduledSession"
  ADD COLUMN "endMode" TEXT NOT NULL DEFAULT 'ON_DATE',
  ADD COLUMN "occurrenceCount" INTEGER;
