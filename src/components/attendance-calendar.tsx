"use client";

import { useState } from "react";

import { LESSON_STATUS_META } from "@/lib/constants";
import { formatTimeRange } from "@/lib/time-slot";
import {
  formatDateDisplay,
  formatMonthParam,
  isDateInFiscalYear,
  parseDateInput,
} from "@/lib/fiscal-year";
import { LessonForm, type LessonDraft } from "@/components/lesson-form";
import { AbsenceLegend, CalendarMonth } from "@/components/calendar-month";
import { Badge, cx } from "@/components/ui";

/**
 * One student's month. Each day shows the events logged on it; clicking a day's `+`
 * opens the form prefilled with that date, and clicking an event opens it for editing,
 * so adding a session is one click from the day it happened.
 */
export function AttendanceCalendar({
  studentId,
  lessons,
  year,
  month,
  fiscalYearStart,
  readOnly,
  basePath,
  defaultStartTime,
  defaultEndTime,
}: {
  studentId: string;
  lessons: LessonDraft[];
  year: number;
  month: number;
  fiscalYearStart: number;
  readOnly: boolean;
  basePath: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}) {
  const [composingDate, setComposingDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<LessonDraft | null>(null);

  // Several events can share a day, so group rather than index.
  const byDate = new Map<string, LessonDraft[]>();
  for (const lesson of lessons) {
    byDate.set(lesson.date, [...(byDate.get(lesson.date) ?? []), lesson]);
  }

  const monthHours = lessons
    .filter(
      (l) =>
        LESSON_STATUS_META[l.status].countsAsHours &&
        l.date.startsWith(formatMonthParam(year, month)),
    )
    .reduce((sum, l) => sum + l.hours, 0);

  const chipsByDate = new Map(
    [...byDate].map(([date, items]) => [
      date,
      <ul key={date} className="space-y-1">
        {items.map((lesson) => {
          const meta = LESSON_STATUS_META[lesson.status];
          const held = lesson.status === "HELD";
          return (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => {
                  setComposingDate(null);
                  setEditing(lesson);
                }}
                title={[
                  formatTimeRange(lesson.startTime, lesson.endTime),
                  lesson.topics ?? meta.label,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                className={cx(
                  "w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80",
                  held
                    ? "bg-brand text-white"
                    : "bg-accent-soft text-accent ring-1 ring-accent/30",
                )}
              >
                {held ? `${lesson.hours} h` : meta.code}
                {held && lesson.topics ? (
                  <span className="hidden font-normal opacity-90 sm:inline">
                    {" "}
                    · {lesson.topics}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>,
    ]),
  );

  const mutedDates = new Set(
    [...byDate.keys()].filter((key) => {
      const date = parseDateInput(key);
      return date !== null && !isDateInFiscalYear(date, fiscalYearStart);
    }),
  );

  return (
    <CalendarMonth
      year={year}
      month={month}
      monthHref={(y, m) => `${basePath}?view=calendar&month=${formatMonthParam(y, m)}`}
      chipsByDate={chipsByDate}
      mutedDates={mutedDates}
      summary={
        <span className="text-sm text-muted">
          <span className="font-semibold tabular-nums text-ink">
            {Math.round(monthHours * 100) / 100}
          </span>{" "}
          hours this month
        </span>
      }
      dayAction={
        readOnly
          ? undefined
          : (dateKey, date) => (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setComposingDate(dateKey);
                }}
                title={`Add a tutoring event on ${formatDateDisplay(date)}`}
                aria-label={`Add a tutoring event on ${formatDateDisplay(date)}`}
                className="rounded px-1 text-xs leading-none text-faint transition-colors hover:bg-brand hover:text-white"
              >
                +
              </button>
            )
      }
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> hours
            tutored
          </span>
          <AbsenceLegend />
          {readOnly ? null : <span>Click a day’s + to log an event.</span>}
        </>
      }
      footer={
        composingDate || editing ? (
          <div className="border-t border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <p className="text-sm font-medium text-ink">
                {editing ? "Edit tutoring event" : "New tutoring event"}
              </p>
              {composingDate ? <Badge tone="brand">{composingDate}</Badge> : null}
            </div>
            <LessonForm
              key={editing?.id ?? composingDate ?? "new"}
              studentId={studentId}
              lesson={editing ?? undefined}
              defaultDate={composingDate ?? undefined}
              defaultStartTime={defaultStartTime}
              defaultEndTime={defaultEndTime}
              fiscalYearStart={fiscalYearStart}
              onDone={() => {
                setComposingDate(null);
                setEditing(null);
              }}
            />
          </div>
        ) : null
      }
    />
  );
}
