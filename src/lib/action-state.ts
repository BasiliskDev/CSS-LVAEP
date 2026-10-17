/**
 * The shape every server action returns, and the one place Zod errors become field
 * errors.
 *
 * This module is deliberately not `server-only`: client components import the types to
 * annotate their `useActionState` calls.
 */

/** Returned by an action that redirects on success, so there is no success to render. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Returned by an action that stays put and reports whether it worked. */
export type ActionState = FormState & { ok?: boolean };

/**
 * The first message per top-level field, keyed by field name. Only the first is kept:
 * a field with three complaints still only has room for one line under the input.
 *
 * `prefix` suffixes the key, for forms that repeat a field set per row — the session
 * logging form keys its errors `status.<studentId>`.
 *
 * The parameter is typed structurally rather than as `z.ZodError` so this module stays
 * free of a Zod import, since client components pull it in.
 */
export function fieldErrorsOf(
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
  prefix = "",
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = `${String(issue.path[0] ?? "form")}${prefix}`;
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
