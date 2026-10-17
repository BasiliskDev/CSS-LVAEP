"use client";

import { useActionState } from "react";

import { reassignStudentAction } from "@/app/admin/actions";
import { Button, FormError, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const initialState: ActionState = {};

/**
 * Hand an unassigned student to a tutor. The student's hours, goals and reports come
 * along untouched — this writes one column.
 */
export function ReassignStudent({
  studentId,
  tutors,
}: {
  studentId: string;
  tutors: Array<{ id: string; displayName: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    reassignStudentAction.bind(null, studentId),
    initialState,
  );

  if (tutors.length === 0) {
    return <p className="text-xs text-muted">No tutors have finished setting up yet.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <FormError message={state.error} />
      <div className="w-48">
        <Select
          name="tutorId"
          aria-label="Assign to tutor"
          defaultValue=""
          className="text-xs"
          required
        >
          <option value="" disabled>
            Assign to…
          </option>
          {tutors.map((tutor) => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.displayName}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Assigning…" : "Assign"}
      </Button>
      {state.fieldErrors?.tutorId ? (
        <span className="text-xs text-danger" role="alert">
          {state.fieldErrors.tutorId}
        </span>
      ) : null}
    </form>
  );
}
