"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createStudentAction, type StudentFormState } from "../actions";
import { fiscalYearLabel } from "@/lib/fiscal-year";
import {
  Button,
  Card,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const initialState: StudentFormState = {};

export function NewStudentForm({
  sites,
  defaultFiscalYear,
  defaultDays,
  defaultTimes,
  defaultSiteId,
}: {
  sites: Array<{ id: string; name: string }>;
  defaultFiscalYear: number;
  defaultDays: string;
  defaultTimes: string;
  defaultSiteId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createStudentAction,
    initialState,
  );

  // Offer the current fiscal year plus one either side.
  const years = [defaultFiscalYear - 1, defaultFiscalYear, defaultFiscalYear + 1];

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

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
          <Select id="siteId" name="siteId" defaultValue={defaultSiteId}>
            <option value="">Same as my site</option>
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
            <Input id="days" name="days" defaultValue={defaultDays} />
          </Field>
          <Field label="Time(s)" htmlFor="times" error={state.fieldErrors?.times}>
            <Input id="times" name="times" defaultValue={defaultTimes} />
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
            href="/dashboard"
            className="inline-flex h-10 items-center px-3 text-sm text-muted hover:text-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}
