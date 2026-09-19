"use client";

import { useActionState, useState } from "react";

import { useOnActionSuccess } from "@/hooks/use-on-action-success";

import { saveLessonAction, type ActionState } from "@/app/students/[id]/actions";
import { LESSON_STATUSES, LESSON_STATUS_META, type LessonStatus } from "@/lib/constants";
import {
  fiscalYearLabel,
  formatDateInput,
  isDateInFiscalYear,
  parseDateInput,
  todayUTC,
} from "@/lib/fiscal-year";
import {
  addMinutes,
  formatDuration,
  hoursBetween,
  parseTimeInput,
} from "@/lib/time-slot";
import {
  Button,
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

export type LessonDraft = {
  id: string;
  date: string;
  hours: number;
  startTime: string | null;
  endTime: string | null;
  status: LessonStatus;
  topics: string | null;
  homeworkAssigned: boolean;
  homeworkCompleted: boolean;
  notes: string | null;
};

const initialState: ActionState = {};

export function LessonForm({
  studentId,
  lesson,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  fiscalYearStart,
  onDone,
}: {
  studentId: string;
  lesson?: LessonDraft;
  /** Prefills the date when adding from a specific day on the calendar. */
  defaultDate?: string;
  /** Prefills the slot from this student's last event, since sessions usually recur. */
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  fiscalYearStart: number;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveLessonAction.bind(null, studentId, lesson?.id ?? null),
    initialState,
  );
  const [status, setStatus] = useState<LessonStatus>(lesson?.status ?? "HELD");
  const [date, setDate] = useState(
    lesson?.date ?? defaultDate ?? formatDateInput(todayUTC()),
  );
  const [homeworkAssigned, setHomeworkAssigned] = useState(
    lesson?.homeworkAssigned ?? false,
  );
  const [startTime, setStartTime] = useState(
    lesson?.startTime ?? defaultStartTime ?? "",
  );
  const [endTime, setEndTime] = useState(lesson?.endTime ?? defaultEndTime ?? "");

  // Once saved, hand control back to the parent (closes the editor).
  useOnActionSuccess(state.ok, onDone);

  const isHeld = status === "HELD";
  const slotHours = hoursBetween(startTime, endTime);
  const slotFilled = Boolean(startTime && endTime);
  const parsedDate = parseDateInput(date);
  const outsideFiscalYear =
    parsedDate !== null && !isDateInFiscalYear(parsedDate, fiscalYearStart);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Date"
          htmlFor="date"
          error={state.fieldErrors?.date}
          hint={
            outsideFiscalYear
              ? `Outside ${fiscalYearLabel(fiscalYearStart)} — it will be saved, but won't count toward this year's total.`
              : undefined
          }
          required
        >
          {/*
            Deliberately no min/max: those block submission outright, which would
            dead-end anyone adding an event from a calendar month outside the
            student's fiscal year. The event saves either way and the attendance
            page flags it instead.
          */}
          <Input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>

        <Field label="What happened" htmlFor="status" error={state.fieldErrors?.status}>
          <Select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LessonStatus)}
          >
            {LESSON_STATUSES.map((value) => (
              <option key={value} value={value}>
                {LESSON_STATUS_META[value].label}
                {LESSON_STATUS_META[value].code
                  ? ` (${LESSON_STATUS_META[value].code})`
                  : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isHeld ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">
            Time slot<span className="ml-0.5 text-danger">*</span>
          </legend>

          <div className="flex flex-wrap items-start gap-3">
            <div className="w-36">
              <label htmlFor="startTime" className="mb-1 block text-xs text-muted">
                Start
              </label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={startTime}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartTime(next);
                  // Keep the slot sensible: carry the end along with the start
                  // rather than leaving a backwards range behind.
                  if (next && (!endTime || parseTimeInput(endTime)! <= parseTimeInput(next)!)) {
                    setEndTime(addMinutes(next, 60) ?? "");
                  }
                }}
                required
              />
            </div>

            <div className="w-36">
              <label htmlFor="endTime" className="mb-1 block text-xs text-muted">
                End
              </label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <div className="min-w-32 pt-5" aria-live="polite">
              {slotHours !== null ? (
                <p className="text-sm text-ink">
                  <span className="font-semibold tabular-nums">
                    {formatDuration(slotHours)}
                  </span>
                  <span className="text-muted"> · {slotHours} h logged</span>
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {slotFilled ? "End must be after start" : "Hours calculated from the slot"}
                </p>
              )}
            </div>
          </div>

          {state.fieldErrors?.startTime ? (
            <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
              {state.fieldErrors.startTime}
            </p>
          ) : null}
          {state.fieldErrors?.endTime ? (
            <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
              {state.fieldErrors.endTime}
            </p>
          ) : null}
        </fieldset>
      ) : (
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
          An absence counts as zero hours on the form, so it needs no time slot.
        </p>
      )}

      {isHeld ? (
        <>
          <Field label="Topics covered" htmlFor="topics" error={state.fieldErrors?.topics}>
            <Input
              id="topics"
              name="topics"
              defaultValue={lesson?.topics ?? ""}
              placeholder="Reading comprehension, past tense verbs…"
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Homework</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                name="homeworkAssigned"
                checked={homeworkAssigned}
                onChange={(e) => setHomeworkAssigned(e.target.checked)}
              />
              Homework assigned
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                name="homeworkCompleted"
                defaultChecked={lesson?.homeworkCompleted}
                disabled={!homeworkAssigned}
              />
              <span className={homeworkAssigned ? "" : "text-faint"}>
                Previous homework completed
              </span>
            </label>
          </fieldset>
        </>
      ) : null}

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes}>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={lesson?.notes ?? ""}
          placeholder="Progress, next steps, anything to remember."
        />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : lesson ? "Save changes" : "Add event"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
