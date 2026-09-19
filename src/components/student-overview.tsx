"use client";

import { useActionState, useState, useTransition } from "react";

import {
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
    </div>
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
