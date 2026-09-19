"use client";

import { useActionState } from "react";

import { loginAction, type AuthFormState } from "../actions";
import { Button, Card, Field, FormError, Input } from "@/components/ui";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <Field label="Username" htmlFor="username" error={state.fieldErrors?.username}>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
