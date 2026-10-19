"use client";

import { useActionState, useState } from "react";

import {
  createScheduledSessionAction,
  updateScheduledSessionAction,
} from "./actions";
import { useOnActionSuccess } from "@/hooks/use-on-action-success";
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import {
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  formatDateDisplay,
  parseDateInput,
} from "@/lib/fiscal-year";
import { MAX_OCCURRENCES, countOccurrences, nthOccurrence } from "@/lib/recurrence";
import { formatDuration, hoursBetween } from "@/lib/time-slot";

const initialState: ActionState = {};

type EndMode = "ON_DATE" | "AFTER_COUNT";

export type SessionTutor = {
  id: string;
  displayName: string;
  siteId: string | null;
  students: Array<{ id: string; firstName: string; lastName: string; status: string }>;
};

export type SessionDraft = {
  id: string;
  tutorId: string;
  title: string | null;
  weekdays: number[];
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  endMode: EndMode;
  occurrenceCount: number | null;
  siteId: string | null;
  notes: string | null;
  studentIds: string[];
};

export function SessionForm({
  tutors,
  sites,
  session,
  onDone,
}: {
  tutors: SessionTutor[];
  sites: Array<{ id: string; name: string }>;
  session?: SessionDraft;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    session
      ? updateScheduledSessionAction.bind(null, session.id)
      : createScheduledSessionAction,
    initialState,
  );

  const [tutorId, setTutorId] = useState(session?.tutorId ?? tutors[0]?.id ?? "");
  const [startTime, setStartTime] = useState(session?.startTime ?? "17:30");
  const [endTime, setEndTime] = useState(session?.endTime ?? "18:30");
  // Membership is per-tutor, so switching tutors has to clear it rather than carry
  // someone else's students across.
  const [studentIds, setStudentIds] = useState<string[]>(session?.studentIds ?? []);

  // Recurrence. Held in state rather than left to the DOM so the summary below can show
  // what the rule actually produces before anyone submits it.
  const [weekdays, setWeekdays] = useState<number[]>(session?.weekdays ?? [2]);
  const [endMode, setEndMode] = useState<EndMode>(session?.endMode ?? "ON_DATE");
  const [startsOn, setStartsOn] = useState(session?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(session?.endsOn ?? "");
  const [occurrenceCount, setOccurrenceCount] = useState(
    session?.occurrenceCount != null ? String(session.occurrenceCount) : "12",
  );

  /**
   * Held in state rather than left to `defaultValue`, because React resets a form once
   * its action settles. An uncontrolled field therefore survives a *successful* submit
   * (the form unmounts) but is silently wiped by a *rejected* one — so the office fixed
   * the date, submitted again, and saved a series with no name and no notes.
   */
  const [title, setTitle] = useState(session?.title ?? "");
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [siteId, setSiteId] = useState(session?.siteId ?? "");

  useOnActionSuccess(state.ok, onDone);

  const tutor = tutors.find((candidate) => candidate.id === tutorId);
  const roster = (tutor?.students ?? []).filter(
    (student) => student.status === "ACTIVE" || studentIds.includes(student.id),
  );
  const slotHours = hoursBetween(startTime, endTime);

  function toggleStudent(id: string, checked: boolean) {
    setStudentIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id),
    );
  }

  function toggleWeekday(index: number, checked: boolean) {
    setWeekdays((current) =>
      checked
        ? [...new Set([...current, index])].sort((a, b) => a - b)
        : current.filter((value) => value !== index),
    );
  }

  /**
   * The same arithmetic the server will do, so the office sees what the rule produces
   * before saving rather than after. Purely advisory: every number here is recomputed
   * and re-validated server-side.
   *
   * Deliberately worded differently from the schema's messages. When both layers used
   * the same sentence there was no way — for a reader or a test — to tell whether the
   * server had actually answered yet, which is its own kind of bug.
   */
  const firstDate = parseDateInput(startsOn);
  const summary = (() => {
    if (weekdays.length === 0) return "No days picked yet.";
    if (!firstDate) return "Waiting on a first date.";

    if (endMode === "AFTER_COUNT") {
      const count = Number(occurrenceCount);
      if (!Number.isInteger(count) || count < 1) return "Waiting on a meeting count.";
      if (count > MAX_OCCURRENCES) return `Too many meetings — ${MAX_OCCURRENCES} is the limit.`;
      const last = nthOccurrence(firstDate, weekdays, count);
      if (!last) return "Those days produce no dates.";
      return `${count} ${count === 1 ? "meeting" : "meetings"} · ${formatDateDisplay(
        firstDate,
      )} – ${formatDateDisplay(last)}`;
    }

    const lastDate = parseDateInput(endsOn);
    if (!lastDate) return "Waiting on a last date.";
    if (lastDate < firstDate) return "That last date comes first — check the order.";
    const total = countOccurrences({ weekdays, startsOn: firstDate, endsOn: lastDate });
    if (total === 0) return "No session dates fall inside that range.";
    return `${total} ${total === 1 ? "meeting" : "meetings"} · ${formatDateDisplay(
      firstDate,
    )} – ${formatDateDisplay(lastDate)}`;
  })();

  return (
    <Card>
      <CardHeader
        title={session ? "Edit session" : "New session"}
        description="Repeats weekly on the days you pick. Individual dates can be cancelled afterwards."
      />
      {/* React resets the form once its action settles. That is right for a form that
          disappears on success, but this one stays on screen when the action *rejects* —
          and the reset visibly clears the day chips, the student ticks and the tutor
          back to their defaults while React's state still holds the real values. The
          next keystroke repairs it, which is worse than useless: the office sees its
          selections vanish and a resubmit can post the defaults. The reset is
          cancelable, so cancel it and let the controlled state stand. */}
      <form
        action={formAction}
        onReset={(event) => event.preventDefault()}
        className="space-y-4 p-5"
      >
        <FormError message={state.error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tutor" htmlFor="tutorId" error={state.fieldErrors?.tutorId} required>
            <Select
              id="tutorId"
              name="tutorId"
              value={tutorId}
              onChange={(event) => {
                setTutorId(event.target.value);
                setStudentIds([]);
                // A site override belongs to the tutor it was chosen for; blank means
                // "wherever this tutor works", which is the right default for the new one.
                setSiteId("");
              }}
              required
            >
              {tutors.length === 0 ? <option value="">No tutors set up yet</option> : null}
              {tutors.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.displayName}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Name"
            htmlFor="title"
            hint="Optional, e.g. “Tuesday reading group”."
            error={state.fieldErrors?.title}
          >
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            Repeats on<span className="ml-0.5 text-danger">*</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_NAMES.map((name, index) => {
              const checked = weekdays.includes(index);
              return (
                <label
                  key={index}
                  className={cx(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40",
                    checked
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong text-muted hover:border-brand/50 hover:text-ink",
                  )}
                >
                  {/* Visually a chip, but still a real checkbox: it posts under one name,
                      so a two-day series arrives as two values of "weekdays". */}
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={index}
                    checked={checked}
                    onChange={(event) => toggleWeekday(index, event.target.checked)}
                    aria-label={name}
                    className="sr-only"
                  />
                  {WEEKDAY_LABELS[index]}
                </label>
              );
            })}
          </div>
          {state.fieldErrors?.weekdays ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {state.fieldErrors.weekdays}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="startTime" error={state.fieldErrors?.startTime} required>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </Field>

          <Field label="Ends" htmlFor="endTime" error={state.fieldErrors?.endTime} required>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </Field>
        </div>

        <p className="text-xs text-muted" aria-live="polite">
          {slotHours === null
            ? "The end time must be after the start time."
            : `${formatDuration(slotHours)} per session — each student's hours come from this slot.`}
        </p>

        <Field
          label="First date"
          htmlFor="startsOn"
          error={state.fieldErrors?.startsOn}
          required
        >
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            required
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Ends</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="endMode"
                value="ON_DATE"
                checked={endMode === "ON_DATE"}
                onChange={() => setEndMode("ON_DATE")}
                className="h-4 w-4 border-line-strong accent-brand"
              />
              On a date
            </label>
            {endMode === "ON_DATE" ? (
              <div className="ml-6">
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  aria-label="Last date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-muted">
                  Inclusive — the term&apos;s final session.
                </p>
                {state.fieldErrors?.endsOn ? (
                  <p className="mt-1 text-xs text-danger" role="alert">
                    {state.fieldErrors.endsOn}
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="endMode"
                value="AFTER_COUNT"
                checked={endMode === "AFTER_COUNT"}
                onChange={() => setEndMode("AFTER_COUNT")}
                className="h-4 w-4 border-line-strong accent-brand"
              />
              After a number of meetings
            </label>
            {endMode === "AFTER_COUNT" ? (
              <div className="ml-6">
                <div className="flex items-center gap-2">
                  <Input
                    id="occurrenceCount"
                    name="occurrenceCount"
                    type="number"
                    min={1}
                    max={MAX_OCCURRENCES}
                    step={1}
                    aria-label="Number of meetings"
                    className="w-24"
                    value={occurrenceCount}
                    onChange={(event) => setOccurrenceCount(event.target.value)}
                    required
                  />
                  <span className="text-sm text-muted">meetings</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Counted across every day you picked, starting from the first date.
                </p>
                {state.fieldErrors?.occurrenceCount ? (
                  <p className="mt-1 text-xs text-danger" role="alert">
                    {state.fieldErrors.occurrenceCount}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </fieldset>

        {/* The rule spelled out. Cancelling a date later doesn't change this count: the
            series still has the dates it has, one of them just isn't running. */}
        <p
          className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted"
          aria-live="polite"
        >
          {summary}
        </p>

        <Field label="Site" htmlFor="siteId" error={state.fieldErrors?.siteId}>
          <Select
            id="siteId"
            name="siteId"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            <option value="">Same as the tutor&apos;s site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            Students<span className="ml-0.5 text-danger">*</span>
          </legend>
          {roster.length === 0 ? (
            <p className="text-sm text-muted">
              That tutor has no students yet. Add one first, then come back.
            </p>
          ) : (
            <ul className="space-y-1">
              {roster.map((student) => (
                <li key={student.id}>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <Checkbox
                      name="studentIds"
                      value={student.id}
                      checked={studentIds.includes(student.id)}
                      onChange={(event) => toggleStudent(student.id, event.target.checked)}
                    />
                    {student.firstName} {student.lastName}
                    {student.status === "STOPPED" ? (
                      <span className="text-xs text-muted">(stopped)</span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {state.fieldErrors?.studentIds ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {state.fieldErrors.studentIds}
            </p>
          ) : null}
        </fieldset>

        <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes}>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending || roster.length === 0}>
            {pending ? "Saving…" : session ? "Save changes" : "Create session"}
          </Button>
          {onDone ? (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
