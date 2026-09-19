"use client";

import { useState, useTransition } from "react";

import { deleteLessonAction } from "@/app/students/[id]/actions";
import { LESSON_STATUS_META } from "@/lib/constants";
import { formatDateDisplay, parseDateInput } from "@/lib/fiscal-year";
import { formatTimeRange } from "@/lib/time-slot";
import { LessonForm, type LessonDraft } from "@/components/lesson-form";
import { Badge, Button, Card, EmptyState, cx } from "@/components/ui";

/**
 * Every tutoring event, newest first, grouped by month with a subtotal per month —
 * the numbers the office used to read off the bottom of the paper grid.
 */
export function LessonList({
  studentId,
  lessons,
  fiscalYearStart,
  readOnly,
}: {
  studentId: string;
  lessons: LessonDraft[];
  fiscalYearStart: number;
  readOnly: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (lessons.length === 0) {
    return (
      <EmptyState
        title="No tutoring events logged yet"
        description="Add each session as it happens — the monthly totals and the calendar fill in from these."
      />
    );
  }

  // Lessons arrive newest-first; preserve that order while grouping.
  const months: Array<{ key: string; label: string; items: LessonDraft[] }> = [];
  for (const lesson of lessons) {
    const key = lesson.date.slice(0, 7);
    let group = months.find((m) => m.key === key);
    if (!group) {
      const date = parseDateInput(lesson.date);
      group = {
        key,
        label: date
          ? date.toLocaleDateString("en-US", {
              timeZone: "UTC",
              month: "long",
              year: "numeric",
            })
          : key,
        items: [],
      };
      months.push(group);
    }
    group.items.push(lesson);
  }

  return (
    <div>
      {months.map((month) => {
        const held = month.items.filter(
          (l) => LESSON_STATUS_META[l.status].countsAsHours,
        );
        const subtotal =
          Math.round(held.reduce((sum, l) => sum + l.hours, 0) * 100) / 100;

        return (
          <section key={month.key}>
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {month.label}
              </h3>
              <p className="text-xs text-muted">
                <span className="font-semibold tabular-nums text-ink">{subtotal}</span>{" "}
                hours · {month.items.length} event
                {month.items.length === 1 ? "" : "s"}
              </p>
            </div>

            <ul className="divide-y divide-line">
              {month.items.map((lesson) =>
                editingId === lesson.id ? (
                  <li key={lesson.id} className="p-4">
                    <Card className="border-brand/40 p-4">
                      <p className="mb-4 text-sm font-medium text-ink">
                        Edit tutoring event
                      </p>
                      <LessonForm
                        studentId={studentId}
                        lesson={lesson}
                        fiscalYearStart={fiscalYearStart}
                        onDone={() => setEditingId(null)}
                      />
                    </Card>
                  </li>
                ) : (
                  <LessonRow
                    key={lesson.id}
                    studentId={studentId}
                    lesson={lesson}
                    readOnly={readOnly}
                    onEdit={() => setEditingId(lesson.id)}
                  />
                ),
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LessonRow({
  studentId,
  lesson,
  readOnly,
  onEdit,
}: {
  studentId: string;
  lesson: LessonDraft;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const meta = LESSON_STATUS_META[lesson.status];
  const date = parseDateInput(lesson.date);
  const held = lesson.status === "HELD";
  const slot = formatTimeRange(lesson.startTime, lesson.endTime);

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-4">
      <div
        className={cx(
          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md text-center",
          held ? "bg-brand text-white" : "bg-accent-soft text-accent",
        )}
      >
        <span className="text-sm font-semibold leading-none tabular-nums">
          {held ? lesson.hours : meta.code}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide opacity-90">
          {held ? "hrs" : ""}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">
            {date ? formatDateDisplay(date) : lesson.date}
          </span>
          {slot ? (
            <span className="text-sm text-muted">{slot}</span>
          ) : held ? (
            // Logged before time slots existed, so only the total was ever recorded.
            <span className="text-sm text-faint">no time slot recorded</span>
          ) : null}
          {held ? null : <Badge tone="accent">{meta.label}</Badge>}
          {lesson.homeworkAssigned ? (
            <Badge tone={lesson.homeworkCompleted ? "positive" : "neutral"}>
              {lesson.homeworkCompleted ? "Homework done" : "Homework assigned"}
            </Badge>
          ) : null}
        </div>

        {lesson.topics ? (
          <p className="mt-1.5 text-sm text-ink">{lesson.topics}</p>
        ) : null}
        {lesson.notes ? (
          <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{lesson.notes}</p>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex shrink-0 gap-1">
          {confirming ? (
            <>
              <Button
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteLessonAction(studentId, lesson.id);
                    setConfirming(false);
                  })
                }
              >
                {isPending ? "Deleting…" : "Confirm delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
