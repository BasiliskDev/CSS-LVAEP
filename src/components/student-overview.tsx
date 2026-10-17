"use client";

import { useActionState, useState, useTransition } from "react";

import {
  removeStudentAction,
  resumeStudentAction,
  stopStudentAction,
  updateStudentAction,
  type ActionState,
} from "@/app/students/[id]/actions";
import { fiscalYearLabel, formatDateInput, todayUTC } from "@/lib/fiscal-year";
import {
  Button,
  Card,
  CardHeader,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

export type StudentDetails = {
  id: string;
  firstName: string;
  lastName: string;
  siteId: string | null;
  days: string | null;
  times: string | null;
  fiscalYearStart: number;
  notes: string | null;
  status: string;
  stoppedReason: string | null;
};

const initialState: ActionState = {};

export function StudentOverview({
  student,
  sites,
  readOnly,
}: {
  student: StudentDetails;
  sites: Array<{ id: string; name: string }>;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateStudentAction.bind(null, student.id),
    initialState,
  );

  const years = [
    student.fiscalYearStart - 1,
    student.fiscalYearStart,
    student.fiscalYearStart + 1,
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Student details"
          description="The header block of the paper form."
        />
        <form action={formAction} className="space-y-4 p-5">
          <FormError message={state.error} />
          {state.ok ? (
            <p className="rounded-md border border-positive/30 bg-positive-soft px-3 py-2 text-sm text-positive">
              Saved.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              htmlFor="firstName"
              error={state.fieldErrors?.firstName}
              required
            >
              <Input
                id="firstName"
                name="firstName"
                defaultValue={student.firstName}
                disabled={readOnly}
                required
              />
            </Field>
            <Field
              label="Last name"
              htmlFor="lastName"
              error={state.fieldErrors?.lastName}
              required
            >
              <Input
                id="lastName"
                name="lastName"
                defaultValue={student.lastName}
                disabled={readOnly}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tutoring site" htmlFor="siteId">
              <Select
                id="siteId"
                name="siteId"
                defaultValue={student.siteId ?? ""}
                disabled={readOnly}
              >
                <option value="">No site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Fiscal year"
              htmlFor="fiscalYearStart"
              hint="Changing this re-files every lesson in the grid."
              error={state.fieldErrors?.fiscalYearStart}
            >
              <Select
                id="fiscalYearStart"
                name="fiscalYearStart"
                defaultValue={student.fiscalYearStart}
                disabled={readOnly}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {fiscalYearLabel(year)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day(s)" htmlFor="days">
              <Input
                id="days"
                name="days"
                defaultValue={student.days ?? ""}
                disabled={readOnly}
              />
            </Field>
            <Field label="Time(s)" htmlFor="times">
              <Input
                id="times"
                name="times"
                defaultValue={student.times ?? ""}
                disabled={readOnly}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              defaultValue={student.notes ?? ""}
              disabled={readOnly}
            />
          </Field>

          {readOnly ? null : (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          )}
        </form>
      </Card>

      <StoppedCard student={student} readOnly={readOnly} />
      {readOnly ? null : <RemoveStudentCard student={student} />}
    </div>
  );
}

/**
 * Handing a student back to the office. Irreversible for the tutor, so it takes two
 * deliberate steps: opening the panel, then typing the student's name. There is no
 * Dialog primitive in this app, and a reveal panel reads better here anyway — the
 * warning stays on screen while you type rather than vanishing with a click.
 */
function RemoveStudentCard({ student }: { student: StudentDetails }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    removeStudentAction.bind(null, student.id),
    initialState,
  );

  const fullName = `${student.firstName} ${student.lastName}`;

  return (
    <Card>
      <CardHeader
        title="Remove this student"
        description="Takes them off your list. Only the office can give them back."
        action={
          open ? null : (
            <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
              Remove student
            </Button>
          )
        }
      />

      {open ? (
        <form action={formAction} className="space-y-4 p-5">
          <div
            className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger"
            role="alert"
          >
            <p className="font-semibold">You cannot undo this yourself.</p>
            <p className="mt-1">
              {fullName} will disappear from your list immediately. Nothing is deleted —
              every hour, goal and report is kept — but only the office can assign them
              back to you or to another tutor.
            </p>
          </div>

          <FormError message={state.error} />

          <Field
            label={`Type "${fullName}" to confirm`}
            htmlFor="confirmName"
            error={state.fieldErrors?.confirmName}
            required
          >
            <Input id="confirmName" name="confirmName" autoComplete="off" autoFocus required />
          </Field>

          <Field
            label="Reason"
            htmlFor="removedReason"
            hint="Optional, but it helps the office decide what happens next."
            error={state.fieldErrors?.removedReason}
          >
            <Input
              id="removedReason"
              name="removedReason"
              placeholder="Moved away, schedule clash, finished the programme…"
            />
          </Field>

          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Removing…" : "Remove student"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

/** Mirrors the form's STOPPED box, where a reason is mandatory. */
function StoppedCard({
  student,
  readOnly,
}: {
  student: StudentDetails;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(
    stopStudentAction.bind(null, student.id),
    initialState,
  );

  if (student.status === "STOPPED") {
    return (
      <Card>
        <CardHeader
          title="Stopped"
          description="This student is no longer being tutored. Let the office know."
        />
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Reason
            </p>
            <p className="mt-1 text-sm text-ink">{student.stoppedReason}</p>
          </div>
          {readOnly ? null : (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() =>
                startTransition(() => resumeStudentAction(student.id))
              }
            >
              {isPending ? "Reactivating…" : "Resume tutoring"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (readOnly) return null;

  return (
    <Card>
      <CardHeader
        title="Stopped"
        description='The form asks you to tick this box and notify the office when a student is no longer being tutored.'
        action={
          open ? null : (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Mark as stopped
            </Button>
          )
        }
      />
      {open ? (
        <form action={formAction} className="space-y-4 p-5">
          <FormError message={state.error} />

          <Field
            label="Reason"
            htmlFor="stoppedReason"
            error={state.fieldErrors?.stoppedReason}
            required
          >
            <Input
              id="stoppedReason"
              name="stoppedReason"
              placeholder="Moved away, completed goals, stopped attending…"
              autoFocus
              required
            />
          </Field>

          <Field
            label="Date stopped"
            htmlFor="stoppedAt"
            error={state.fieldErrors?.stoppedAt}
          >
            <Input
              id="stoppedAt"
              name="stoppedAt"
              type="date"
              className="sm:max-w-52"
              defaultValue={formatDateInput(todayUTC())}
            />
          </Field>

          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Saving…" : "Mark as stopped"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
