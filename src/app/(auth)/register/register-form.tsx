"use client";

import { useActionState } from "react";

import { registerAction, type AuthFormState } from "../actions";
import { Button, Card, Field, FormError, Input } from "@/components/ui";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

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
            autoComplete="name"
            placeholder="Jane Doe"
            autoFocus
            required
          />
        </Field>

        <Field
          label="Username"
          htmlFor="username"
          hint="Letters, numbers, dots, dashes or underscores."
          error={state.fieldErrors?.username}
          required
        >
          <Input id="username" name="username" autoComplete="username" required />
        </Field>

        <Field
          label="Password"
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
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
