"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createStudentAction } from "../../actions";
import { fiscalYearLabel } from "@/lib/fiscal-year";
import type { FormState } from "@/lib/action-state";
import {
  Button,
  Card,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const initialState: FormState = {};

type Tutor = {
  id: string;
  displayName: string;
  username: string;
  defaultDays: string | null;
  defaultTimes: string | null;
  siteId: string | null;
};

export function NewStudentForm({
  sites,
  tutors,
  defaultFiscalYear,
}: {
  sites: Array<{ id: string; name: string }>;
  tutors: Tutor[];
  defaultFiscalYear: number;
}) {
  const [state, formAction, pending] = useActionState(
    createStudentAction,
    initialState,
  );

  // Picking the tutor fills in their usual site and days, which is nearly always right —
  // the office is scheduling into an existing slot, not inventing a new one.
  const [tutorId, setTutorId] = useState(tutors[0]?.id ?? "");
  const tutor = tutors.find((candidate) => candidate.id === tutorId);

  // Offer the current fiscal year plus one either side.
  const years = [defaultFiscalYear - 1, defaultFiscalYear, defaultFiscalYear + 1];

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <Field
          label="Tutor"
          htmlFor="tutorId"
          hint="Who keeps this student's sheet. You can reassign later."
          error={state.fieldErrors?.tutorId}
          required
        >
          <Select
            id="tutorId"
            name="tutorId"
            value={tutorId}
            onChange={(event) => setTutorId(event.target.value)}
            required
          >
            {tutors.length === 0 ? <option value="">No tutors have set up yet</option> : null}
            {tutors.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName} (@{candidate.username})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            htmlFor="firstName"
            error={state.fieldErrors?.firstName}
            required
          >
            <Input id="firstName" name="firstName" autoFocus required />
          </Field>
          <Field
            label="Last name"
            htmlFor="lastName"
            error={state.fieldErrors?.lastName}
            required
          >
            <Input id="lastName" name="lastName" required />
          </Field>
        </div>

        <Field label="Tutoring site" htmlFor="siteId" error={state.fieldErrors?.siteId}>
          <Select id="siteId" name="siteId" key={tutor?.siteId ?? "none"} defaultValue={tutor?.siteId ?? ""}>
            <option value="">Same as the tutor&apos;s site</option>
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
          hint="The attendance grid runs July through June."
          error={state.fieldErrors?.fiscalYearStart}
          required
        >
          <Select
            id="fiscalYearStart"
            name="fiscalYearStart"
            defaultValue={defaultFiscalYear}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {fiscalYearLabel(year)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Day(s)" htmlFor="days" error={state.fieldErrors?.days}>
            <Input id="days" name="days" key={`days-${tutorId}`} defaultValue={tutor?.defaultDays ?? ""} />
          </Field>
          <Field label="Time(s)" htmlFor="times" error={state.fieldErrors?.times}>
            <Input id="times" name="times" key={`times-${tutorId}`} defaultValue={tutor?.defaultTimes ?? ""} />
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes}>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Goals, level, anything worth remembering."
          />
        </Field>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create student"}
          </Button>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center px-3 text-sm text-muted hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}
