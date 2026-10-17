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
} from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { WEEKDAY_LABELS } from "@/lib/fiscal-year";
import { formatDuration, hoursBetween } from "@/lib/time-slot";

const initialState: ActionState = {};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
  weekday: number;
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
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

  return (
    <Card>
      <CardHeader
        title={session ? "Edit session" : "New session"}
        description="Repeats weekly. Individual dates can be cancelled afterwards."
      />
      <form action={formAction} className="space-y-4 p-5">
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
            <Input id="title" name="title" defaultValue={session?.title ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Day" htmlFor="weekday" error={state.fieldErrors?.weekday} required>
            <Select id="weekday" name="weekday" defaultValue={session?.weekday ?? 2} required>
              {WEEKDAY_LABELS.map((_, index) => (
                <option key={index} value={index}>
                  {WEEKDAY_NAMES[index]}
                </option>
              ))}
            </Select>
          </Field>

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

        <div className="grid gap-4 sm:grid-cols-2">
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
              defaultValue={session?.startsOn ?? ""}
              required
            />
          </Field>
          <Field
            label="Last date"
            htmlFor="endsOn"
            hint="Inclusive. The term's final session."
            error={state.fieldErrors?.endsOn}
            required
          >
            <Input
              id="endsOn"
              name="endsOn"
              type="date"
              defaultValue={session?.endsOn ?? ""}
              required
            />
          </Field>
        </div>

        <Field label="Site" htmlFor="siteId" error={state.fieldErrors?.siteId}>
          <Select
            id="siteId"
            name="siteId"
            key={tutor?.siteId ?? "none"}
            defaultValue={session?.siteId ?? tutor?.siteId ?? ""}
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
          <Textarea id="notes" name="notes" defaultValue={session?.notes ?? ""} />
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
