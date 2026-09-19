"use client";

import { useEffect, useRef } from "react";

/**
 * Run a callback once a server action reports success.
 *
 * The obvious `if (state.ok) onDone()` in the component body fires *during render*,
 * which sets state on the parent mid-render and trips React's
 * "Cannot update a component while rendering a different component" warning.
 * Running it in an effect defers it to after commit.
 *
 * The callback is held in a ref because callers pass an inline arrow, whose identity
 * changes every render; keying the effect on `ok` alone keeps it firing exactly once
 * per successful submission.
 */
export function useOnActionSuccess(ok: boolean | undefined, callback?: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (ok) callbackRef.current?.();
  }, [ok]);
}
