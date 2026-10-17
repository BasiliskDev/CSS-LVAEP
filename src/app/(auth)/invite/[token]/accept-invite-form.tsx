"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "../actions";
import { Button, Card, Field, FormError, Input } from "@/components/ui";
import type { FormState } from "@/lib/action-state";

const initialState: FormState = {};

export function AcceptInviteForm({
  token,
  defaultDisplayName,
}: {
  token: string;
  defaultDisplayName: string;
}) {
  const [state, formAction, pending] = useActionState(
    acceptInviteAction.bind(null, token),
    initialState,
  );

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <Field
          label="Your name"
          htmlFor="displayName"
          hint="This is the name the office sees on your students' forms."
          error={state.fieldErrors?.displayName}
          required
        >
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            defaultValue={defaultDisplayName}
            required
          />
        </Field>

        <Field
          label="Choose a username"
          htmlFor="username"
          hint="Letters, numbers, dots, dashes or underscores."
          error={state.fieldErrors?.username}
          required
        >
          <Input id="username" name="username" autoComplete="username" autoFocus required />
        </Field>

        <Field
          label="Choose a password"
          htmlFor="password"
          hint="At least 8 characters."
          error={state.fieldErrors?.password}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={state.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
