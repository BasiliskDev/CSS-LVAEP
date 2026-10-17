"use client";

import { useActionState, useRef } from "react";

import { createInviteAction } from "../actions";
import { useOnActionSuccess } from "@/hooks/use-on-action-success";
import { Button, Card, CardHeader, Field, FormError, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { USER_ROLES } from "@/lib/constants";

const initialState: ActionState = {};

const ROLE_LABELS: Record<string, string> = {
  TUTOR: "Tutor",
  ADMIN: "Office (can invite and assign)",
};

export function InviteForm({ sites }: { sites: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createInviteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields so the next invite starts blank rather than re-sending the last one.
  useOnActionSuccess(state.ok, () => formRef.current?.reset());

  return (
    <Card>
      <CardHeader
        title="Invite a tutor"
        description="They choose their own username and password from the link."
      />
      <form ref={formRef} action={formAction} className="space-y-4 p-5">
        <FormError message={state.error} />

        {state.ok ? (
          <p className="rounded-md bg-positive-soft px-3 py-2 text-sm text-positive" role="status">
            Invite created — the link is in the list below.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" htmlFor="email" error={state.fieldErrors?.email} required>
            <Input id="email" name="email" type="email" autoComplete="off" required />
          </Field>

          <Field
            label="Their name"
            htmlFor="displayName"
            error={state.fieldErrors?.displayName}
            required
          >
            <Input id="displayName" name="displayName" autoComplete="off" required />
          </Field>

          <Field label="Role" htmlFor="role" error={state.fieldErrors?.role}>
            <Select id="role" name="role" defaultValue="TUTOR">
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] ?? role}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Tutoring site"
            htmlFor="siteId"
            hint="They can change this when they set up their profile."
            error={state.fieldErrors?.siteId}
          >
            <Select id="siteId" name="siteId" defaultValue="">
              <option value="">Let them choose</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </Button>
      </form>
    </Card>
  );
}
