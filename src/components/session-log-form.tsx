"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { logSessionOccurrenceAction } from "@/app/sessions/actions";
import { Badge, Button, Card, CardHeader, Checkbox, FormError, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { LESSON_STATUSES, LESSON_STATUS_META, type LessonStatus } from "@/lib/constants";
import { formatDuration } from "@/lib/time-slot";

const initialState: ActionState = {};

export type SessionLogStudent = {
  id: string;
  firstName: string;
  lastName: string;
  /** The event already logged for this occurrence, if the tutor is coming back to it. */
  logged: {
    status: LessonStatus;
    topics: string | null;
    homeworkAssigned: boolean;
    homeworkCompleted: boolean;
    notes: string | null;
  } | null;
};

/**
 * One occurrence, every student, one submit.
 *
 * The time slot is shown but not editable: it is what makes the derived hours
 * trustworthy. A session that actually ran to different times gets logged by hand on the
 * student's own attendance tab, which is what the per-row link is for.
 */
export function SessionLogForm({
  scheduledSessionId,
  dateKey,
  dateLabel,
  slotLabel,
  hours,
  students,
}: {
  scheduledSessionId: string;
  dateKey: string;
  dateLabel: string;
  slotLabel: string;
  hours: number;
  students: SessionLogStudent[];
}) {
  const [state, formAction, pending] = useActionState(
    logSessionOccurrenceAction.bind(null, scheduledSessionId, dateKey),
    initialState,
  );

  return (
    <Card>
      <CardHeader
        title={dateLabel}
        description={`${slotLabel} · ${formatDuration(hours)} per student`}
        action={
          students.some((student) => student.logged) ? (
            <Badge tone="positive">Already logged — saving again will update it</Badge>
          ) : null
        }
      />

      <form action={formAction} className="space-y-4 p-5">
        <FormError message={state.error} />

        {state.ok ? (
          <p className="rounded-md bg-positive-soft px-3 py-2 text-sm text-positive" role="status">
            Hours logged.
          </p>
        ) : null}

        <ul className="space-y-4">
          {students.map((student) => (
            <StudentRow
              /**
               * Keyed by what was last saved. React resets the form after a successful
               * action, which would otherwise leave a row that saved as an absence
               * reading "Lesson held" — indistinguishable from a lost edit. Remounting
               * when the saved status changes re-initialises the row from the server's
               * own answer.
               */
              key={`${student.id}-${student.logged?.status ?? "new"}`}
              student={student}
              fieldErrors={state.fieldErrors}
            />
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Log hours"}
          </Button>
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            Back to students
          </Link>
        </div>
      </form>
    </Card>
  );
}

function StudentRow({
  student,
  fieldErrors,
}: {
  student: SessionLogStudent;
  fieldErrors?: Record<string, string>;
}) {
  const [include, setInclude] = useState(true);
  const [status, setStatus] = useState<LessonStatus>(student.logged?.status ?? "HELD");
  const [homeworkAssigned, setHomeworkAssigned] = useState(
    student.logged?.homeworkAssigned ?? false,
  );

  const isHeld = status === "HELD";
  const error = (field: string) => fieldErrors?.[`${field}.${student.id}`];

  return (
    <li className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <Checkbox
            name={`include.${student.id}`}
            checked={include}
            onChange={(event) => setInclude(event.target.checked)}
          />
          {student.firstName} {student.lastName}
        </label>

        {student.logged ? <Badge tone="positive">logged</Badge> : null}

        <div className="ml-auto w-48">
          <Select
            name={`status.${student.id}`}
            aria-label={`Status for ${student.firstName} ${student.lastName}`}
            defaultValue={status}
            onChange={(event) => setStatus(event.target.value as LessonStatus)}
            disabled={!include}
          >
            {LESSON_STATUSES.map((value) => {
              const meta = LESSON_STATUS_META[value];
              return (
                <option key={value} value={value}>
                  {meta.code ? `${meta.label} (${meta.code})` : meta.label}
                </option>
              );
            })}
          </Select>
        </div>
      </div>

      {error("status") ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error("status")}
        </p>
      ) : null}

      {include ? (
        <div className="mt-3 space-y-3">
          {isHeld ? (
            <>
              <Input
                name={`topics.${student.id}`}
                defaultValue={student.logged?.topics ?? ""}
                placeholder="Topics covered"
                aria-label={`Topics for ${student.firstName}`}
              />

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 text-ink">
                  <Checkbox
                    name={`homeworkAssigned.${student.id}`}
                    checked={homeworkAssigned}
                    onChange={(event) => setHomeworkAssigned(event.target.checked)}
                  />
                  Homework assigned
                </label>
                <label
                  className={`flex items-center gap-2 ${homeworkAssigned ? "text-ink" : "text-faint"}`}
                >
                  <Checkbox
                    name={`homeworkCompleted.${student.id}`}
                    defaultChecked={student.logged?.homeworkCompleted ?? false}
                    disabled={!homeworkAssigned}
                  />
                  Previous homework completed
                </label>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">
              An absence counts as zero hours on the form, so it needs no times or topics.
            </p>
          )}

          <Textarea
            name={`notes.${student.id}`}
            defaultValue={student.logged?.notes ?? ""}
            placeholder="Notes (optional)"
            aria-label={`Notes for ${student.firstName}`}
          />

          <p className="text-xs text-faint">
            Ran to different times?{" "}
            <Link
              href={`/students/${student.id}/attendance`}
              className="font-medium text-brand hover:underline"
            >
              Log this one by hand
            </Link>
          </p>
        </div>
      ) : null}
    </li>
  );
}
