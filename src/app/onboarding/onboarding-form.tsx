"use client";

import { useActionState, useState } from "react";

import { completeOnboardingAction, type OnboardingState } from "./actions";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";

const initialState: OnboardingState = {};

export type TutorProfile = {
  displayName: string;
  phone: string;
  siteId: string;
  defaultDays: string;
  defaultTimes: string;
};

export function OnboardingForm({
  sites,
  profile,
  isFirstRun,
}: {
  sites: Array<{ id: string; name: string }>;
  profile: TutorProfile;
  isFirstRun: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initialState,
  );
  const [siteChoice, setSiteChoice] = useState(
    profile.siteId || sites[0]?.id || "new",
  );

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <Field
          label="Your name"
          htmlFor="displayName"
          error={state.fieldErrors?.displayName}
          required
        >
          <Input
            id="displayName"
            name="displayName"
            defaultValue={profile.displayName}
            required
          />
        </Field>

        <Field label="Phone" htmlFor="phone" error={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone}
            placeholder="(973) 555-0123"
          />
        </Field>

        <Field
          label="Tutoring site"
          htmlFor="siteId"
          error={state.fieldErrors?.siteId}
          required
        >
          <Select
            id="siteId"
            name="siteId"
            value={siteChoice}
            onChange={(e) => setSiteChoice(e.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
            <option value="new">Add a new site…</option>
          </Select>
        </Field>

        {siteChoice === "new" ? (
          <div className="space-y-4 rounded-md border border-line bg-surface-2 p-4">
            <Field
              label="Site name"
              htmlFor="newSiteName"
              error={state.fieldErrors?.newSiteName}
              required
            >
              <Input id="newSiteName" name="newSiteName" placeholder="Public Library" />
            </Field>
            <Field
              label="Address"
              htmlFor="newSiteAddress"
              error={state.fieldErrors?.newSiteAddress}
            >
              <Input id="newSiteAddress" name="newSiteAddress" />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Usual day(s)"
            htmlFor="defaultDays"
            hint="Prefills new students."
            error={state.fieldErrors?.defaultDays}
          >
            <Input
              id="defaultDays"
              name="defaultDays"
              defaultValue={profile.defaultDays}
              placeholder="Tue & Thu"
            />
          </Field>
          <Field
            label="Usual time(s)"
            htmlFor="defaultTimes"
            error={state.fieldErrors?.defaultTimes}
          >
            <Input
              id="defaultTimes"
              name="defaultTimes"
              defaultValue={profile.defaultTimes}
              placeholder="6:00–7:30 pm"
            />
          </Field>
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : isFirstRun ? "Save and continue" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
