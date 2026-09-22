"use client";

import { useState } from "react";

import { LESSON_STATUS_META } from "@/lib/constants";
import {
  buildCalendarWeeks,
  formatDateDisplay,
  formatMonthParam,
  isDateInFiscalYear,
  parseDateInput,
} from "@/lib/fiscal-year";
import { formatTimeRange } from "@/lib/time-slot";
import { LessonForm, type LessonDraft } from "@/components/lesson-form";
import { AbsenceLegend, CalendarMonth } from "@/components/calendar-month";
import { Badge, Button, cx } from "@/components/ui";

/**
 * One student's month, laid out as a calendar but filled in like the paper grid:
 * each day shows the hours tutored that day, or the absence code, and nothing else.
 *
 * The calendar gives real weekdays and dates, which the 31 x 12 grid never did; the
 * single number per cell keeps it as scannable as the grid. Event detail lives one
 * click away rather than crowding every cell.
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
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<LessonDraft | null>(null);
  const [adding, setAdding] = useState(false);

  const byDate = new Map<string, LessonDraft[]>();
  for (const lesson of lessons) {
    byDate.set(lesson.date, [...(byDate.get(lesson.date) ?? []), lesson]);
  }

  const monthPrefix = formatMonthParam(year, month);
  const monthHours = lessons
    .filter(
      (l) => LESSON_STATUS_META[l.status].countsAsHours && l.date.startsWith(monthPrefix),
    )
    .reduce((sum, l) => sum + l.hours, 0);

  function openDay(dateKey: string) {
    setSelected(dateKey);
    setEditing(null);
    setAdding(false);
  }

  // A cell for every day of the month, so empty days are clickable too.
  const chipsByDate = new Map<string, React.ReactNode>();
  for (const cell of buildCalendarWeeks(year, month).flat()) {
    if (!cell.inMonth) continue;

    const dayLessons = byDate.get(cell.key) ?? [];
    const held = dayLessons.filter((l) => LESSON_STATUS_META[l.status].countsAsHours);
    const hours = Math.round(held.reduce((s, l) => s + l.hours, 0) * 100) / 100;
    // Held hours win the day; otherwise show the first absence code, as the form does.
    const code = hours > 0 ? null : (LESSON_STATUS_META[dayLessons[0]?.status ?? "HELD"].code || null);

    const value = hours > 0 ? String(hours) : (code ?? "");
    const title = dayLessons.length
      ? [
          formatDateDisplay(cell.date),
          hours > 0 ? `${hours} h` : LESSON_STATUS_META[dayLessons[0].status].label,
          formatTimeRange(dayLessons[0].startTime, dayLessons[0].endTime),
          dayLessons.length > 1 ? `${dayLessons.length} events` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : `No events on ${formatDateDisplay(cell.date)}`;

    const body = (
      <span className="flex flex-col items-center justify-center leading-none">
        <span
          className={cx(
            "text-lg font-semibold tabular-nums",
            hours > 0 && "text-brand",
            code && "text-accent",
          )}
        >
          {value}
        </span>
        {dayLessons.length > 1 ? (
          <span className="mt-1 text-[10px] text-muted">{dayLessons.length} events</span>
        ) : null}
      </span>
    );

    chipsByDate.set(
      cell.key,
      readOnly ? (
        <div
          key={cell.key}
          title={title}
          className="flex h-12 items-center justify-center"
        >
          {body}
        </div>
      ) : (
        <button
          key={cell.key}
          type="button"
          onClick={() => openDay(cell.key)}
          title={`${title} — click to edit`}
          aria-label={title}
          className={cx(
            "flex h-12 w-full items-center justify-center rounded transition-colors",
            selected === cell.key
              ? "ring-2 ring-brand"
              : "hover:bg-surface-2",
            hours > 0 && "bg-brand-soft",
            code && "bg-accent-soft",
          )}
        >
          {body}
        </button>
      ),
    );
  }

  const mutedDates = new Set(
    [...byDate.keys()].filter((key) => {
      const date = parseDateInput(key);
      return date !== null && !isDateInFiscalYear(date, fiscalYearStart);
    }),
  );

  const selectedLessons = selected ? (byDate.get(selected) ?? []) : [];

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
      legend={
        <>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-soft ring-1 ring-brand/30" />
            hours tutored
          </span>
          <AbsenceLegend />
          {readOnly ? null : <span>Click a day to log or edit an event.</span>}
        </>
      }
      footer={
        selected && !readOnly ? (
          <DayPanel
            studentId={studentId}
            dateKey={selected}
            lessons={selectedLessons}
            fiscalYearStart={fiscalYearStart}
            defaultStartTime={defaultStartTime}
            defaultEndTime={defaultEndTime}
            editing={editing}
            adding={adding}
            onEdit={(lesson) => {
              setEditing(lesson);
              setAdding(false);
            }}
            onAdd={() => {
              setAdding(true);
              setEditing(null);
            }}
            onDone={() => {
              setEditing(null);
              setAdding(false);
            }}
            onClose={() => setSelected(null)}
          />
        ) : null
      }
    />
  );
}

/** What sits under the calendar once a day is picked: that day's events, then a form. */
function DayPanel({
  studentId,
  dateKey,
  lessons,
  fiscalYearStart,
  defaultStartTime,
  defaultEndTime,
  editing,
  adding,
  onEdit,
  onAdd,
  onDone,
  onClose,
}: {
  studentId: string;
  dateKey: string;
  lessons: LessonDraft[];
  fiscalYearStart: number;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  editing: LessonDraft | null;
  adding: boolean;
  onEdit: (lesson: LessonDraft) => void;
  onAdd: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const date = parseDateInput(dateKey);
  const showForm = adding || editing !== null || lessons.length === 0;

  return (
    <div className="border-t border-line p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {date ? formatDateDisplay(date) : dateKey}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {lessons.length > 0 ? (
        <ul className="mb-4 divide-y divide-line rounded-md border border-line">
          {lessons.map((lesson) => {
            const meta = LESSON_STATUS_META[lesson.status];
            const held = lesson.status === "HELD";
            const slot = formatTimeRange(lesson.startTime, lesson.endTime);
            return (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {held ? (
                    <Badge tone="brand">{lesson.hours} h</Badge>
                  ) : (
                    <Badge tone="accent">
                      {meta.code} · {meta.label}
                    </Badge>
                  )}
                  {slot ? <span className="text-muted">{slot}</span> : null}
                  {lesson.topics ? <span className="text-ink">{lesson.topics}</span> : null}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(lesson)}
                  disabled={editing?.id === lesson.id}
                >
                  {editing?.id === lesson.id ? "Editing" : "Edit"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showForm ? (
        <>
          <p className="mb-3 text-sm font-medium text-ink">
            {editing ? "Edit event" : "New event"}
          </p>
          <LessonForm
            key={editing?.id ?? `new-${dateKey}`}
            studentId={studentId}
            lesson={editing ?? undefined}
            defaultDate={dateKey}
            defaultStartTime={defaultStartTime}
            defaultEndTime={defaultEndTime}
            fiscalYearStart={fiscalYearStart}
            onDone={onDone}
          />
        </>
      ) : (
        <Button onClick={onAdd}>Add another event on this day</Button>
      )}
    </div>
  );
}
