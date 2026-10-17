"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { restoreOccurrenceAction, skipOccurrenceAction } from "../actions";
import { useOnActionSuccess } from "@/hooks/use-on-action-success";
import { Badge, Button, Card, CardHeader, Checkbox, FormError, Input } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const initialState: ActionState = {};

export type OccurrenceRow = {
  dateKey: string;
  label: string;
  skipped: boolean;
  skipReason: string | null;
  loggedCount: number;
  studentCount: number;
  past: boolean;
};

/**
 * Every date the series falls on, with a cancel/restore control each.
 *
 * Cancelling is per-date on purpose: a closure for Thanksgiving shouldn't mean editing
 * the term's date range or deleting the series.
 */
export function OccurrenceList({
  scheduledSessionId,
  occurrences,
}: {
  scheduledSessionId: string;
  occurrences: OccurrenceRow[];
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Dates"
        description={`${occurrences.length} in this run. Cancel a single date without touching the rest.`}
      />
      <ul className="divide-y divide-line">
        {occurrences.map((occurrence) => (
          <li key={occurrence.dateKey} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className={
                  occurrence.skipped ? "text-sm text-faint line-through" : "text-sm text-ink"
                }
              >
                {occurrence.label}
              </span>

              {occurrence.skipped ? (
                <Badge tone="accent">
                  cancelled{occurrence.skipReason ? ` · ${occurrence.skipReason}` : ""}
                </Badge>
              ) : occurrence.loggedCount >= occurrence.studentCount &&
                occurrence.studentCount > 0 ? (
                <Badge tone="positive">logged</Badge>
              ) : occurrence.loggedCount > 0 ? (
                <Badge tone="brand">
                  {occurrence.loggedCount} of {occurrence.studentCount} logged
                </Badge>
              ) : occurrence.past ? (
                <Badge tone="danger">no hours</Badge>
              ) : (
                <Badge>upcoming</Badge>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Link
                  href={`/sessions/${scheduledSessionId}/${occurrence.dateKey}`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  View
                </Link>
                {occurrence.skipped ? (
                  <RestoreButton
                    scheduledSessionId={scheduledSessionId}
                    dateKey={occurrence.dateKey}
                  />
                ) : cancelling === occurrence.dateKey ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelling(occurrence.dateKey)}
                  >
                    Cancel date
                  </Button>
                )}
              </div>
            </div>

            {cancelling === occurrence.dateKey && !occurrence.skipped ? (
              <CancelForm
                scheduledSessionId={scheduledSessionId}
                dateKey={occurrence.dateKey}
                onDone={() => setCancelling(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CancelForm({
  scheduledSessionId,
  dateKey,
  onDone,
}: {
  scheduledSessionId: string;
  dateKey: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    skipOccurrenceAction.bind(null, scheduledSessionId),
    initialState,
  );

  useOnActionSuccess(state.ok, onDone);

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-md bg-surface-2 p-3">
      <input type="hidden" name="date" value={dateKey} />
      <FormError message={state.error} />

      <Input
        name="reason"
        placeholder="Reason — Thanksgiving, snow day, library closed…"
        aria-label="Reason for cancelling"
        autoFocus
      />
      {state.fieldErrors?.date ? (
        <p className="text-xs text-danger" role="alert">
          {state.fieldErrors.date}
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-xs text-muted">
        <Checkbox name="logHoliday" className="mt-0.5" />
        <span>
          Also mark it as a holiday on each student&apos;s form, so the printed sheet shows
          the form&apos;s own <strong>H</strong> rather than an unexplained gap.
        </span>
      </label>

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="danger" disabled={pending}>
          {pending ? "Cancelling…" : "Cancel this date"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Keep it
        </Button>
      </div>
    </form>
  );
}

function RestoreButton({
  scheduledSessionId,
  dateKey,
}: {
  scheduledSessionId: string;
  dateKey: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(() => restoreOccurrenceAction(scheduledSessionId, dateKey))
      }
    >
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
