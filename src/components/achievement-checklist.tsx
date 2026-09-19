"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";

import {
  addCustomAchievementAction,
  deleteCustomAchievementAction,
  toggleAchievementAction,
  type ActionState,
} from "@/app/students/[id]/actions";
import { ACHIEVEMENT_GROUPS } from "@/lib/achievements";
import { formatDateDisplay, formatDateInput, parseDateInput } from "@/lib/fiscal-year";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  FormError,
  Input,
} from "@/components/ui";

export type AchievementState = {
  code: string;
  label: string | null;
  attained: boolean;
  attainedAt: string | null;
  note: string | null;
};

/**
 * The form's achievements block: "Place a √ next to each student's goal when attained."
 * Catalog rows (A1-D4) always render; only their state is stored.
 */
export function AchievementChecklist({
  studentId,
  saved,
  readOnly,
}: {
  studentId: string;
  saved: AchievementState[];
  readOnly: boolean;
}) {
  const byCode = new Map(saved.map((a) => [a.code, a]));
  const custom = saved.filter((a) => a.code.startsWith("E"));

  const attainedCount = saved.filter((a) => a.attained).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Achievements"
          description="Tick a goal when the student attains it. Starred goals are the federally reportable outcomes."
          action={
            <Badge tone={attainedCount > 0 ? "positive" : "neutral"}>
              {attainedCount} attained
            </Badge>
          }
        />

        <div className="divide-y divide-line">
          {ACHIEVEMENT_GROUPS.map((group) => (
            <section key={group.key} className="px-5 py-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">
                {group.letter}. {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <AchievementRow
                    key={item.code}
                    studentId={studentId}
                    code={item.code}
                    label={`${item.number}. ${item.label}`}
                    core={item.core}
                    state={byCode.get(item.code)}
                    readOnly={readOnly}
                  />
                ))}
              </ul>
            </section>
          ))}

          <section className="px-5 py-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">E. Other(s)</h3>
            {custom.length === 0 ? (
              <p className="mb-3 text-sm text-muted">
                No custom goals yet.
              </p>
            ) : (
              <ul className="mb-3 space-y-1">
                {custom.map((achievement, index) => (
                  <AchievementRow
                    key={achievement.code}
                    studentId={studentId}
                    code={achievement.code}
                    label={`${index + 1}. ${achievement.label ?? ""}`}
                    core={false}
                    state={achievement}
                    readOnly={readOnly}
                    removable
                  />
                ))}
              </ul>
            )}
            {readOnly ? null : <AddCustomGoal studentId={studentId} />}
          </section>
        </div>
      </Card>
    </div>
  );
}

function AchievementRow({
  studentId,
  code,
  label,
  core,
  state,
  readOnly,
  removable = false,
}: {
  studentId: string;
  code: string;
  label: string;
  core: boolean;
  state?: AchievementState;
  readOnly: boolean;
  removable?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const attainedAt = state?.attainedAt ? parseDateInput(state.attainedAt) : null;

  // The tick is a controlled input driven by server state, so without an optimistic
  // value it would snap back until the round-trip finished and feel broken.
  const [attained, setAttainedOptimistic] = useOptimistic(state?.attained ?? false);

  function submit(next: {
    attained: boolean;
    attainedAt?: string | null;
    note?: string | null;
  }) {
    const formData = new FormData();
    formData.set("code", code);
    formData.set("attained", String(next.attained));
    if (next.attainedAt) formData.set("attainedAt", next.attainedAt);
    if (next.note) formData.set("note", next.note);
    startTransition(async () => {
      setAttainedOptimistic(next.attained);
      await toggleAchievementAction(studentId, formData);
    });
  }

  return (
    <li className="rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`ach-${code}`}
          checked={attained}
          disabled={readOnly}
          onChange={(e) =>
            submit({
              attained: e.target.checked,
              attainedAt: state?.attainedAt,
              note: state?.note,
            })
          }
          className="mt-0.5"
        />

        <label
          htmlFor={`ach-${code}`}
          className="min-w-0 flex-1 cursor-pointer text-sm text-ink"
        >
          {core ? (
            <span
              className="font-semibold text-accent"
              title="Federally reportable outcome"
            >
              *
            </span>
          ) : null}
          {label}
          {attained && attainedAt ? (
            <span className="ml-2 text-xs text-positive">
              attained {formatDateDisplay(attainedAt)}
            </span>
          ) : null}
        </label>

        {!readOnly && attained ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Close" : "Details"}
          </Button>
        ) : null}

        {!readOnly && removable ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(() => deleteCustomAchievementAction(studentId, code))
            }
          >
            Remove
          </Button>
        ) : null}
      </div>

      {expanded && attained && !readOnly ? (
        <div className="mt-2 ml-7 grid gap-3 rounded-md bg-surface-2 p-3 sm:grid-cols-2">
          <Field label="Date attained" htmlFor={`date-${code}`}>
            <Input
              id={`date-${code}`}
              type="date"
              defaultValue={state?.attainedAt ?? formatDateInput(new Date())}
              onBlur={(e) =>
                submit({ attained: true, attainedAt: e.target.value, note: state?.note })
              }
            />
          </Field>
          <Field label="Note" htmlFor={`note-${code}`}>
            <Input
              id={`note-${code}`}
              defaultValue={state?.note ?? ""}
              placeholder="Optional detail"
              onBlur={(e) =>
                submit({
                  attained: true,
                  attainedAt: state?.attainedAt,
                  note: e.target.value,
                })
              }
            />
          </Field>
        </div>
      ) : null}
    </li>
  );
}

const initialState: ActionState = {};

function AddCustomGoal({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(
    addCustomAchievementAction.bind(null, studentId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <Field label="Add another goal" htmlFor="label" error={state.fieldErrors?.label}>
          <Input id="label" name="label" placeholder="e.g. Pass driving theory test" />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add goal"}
      </Button>
      <div className="w-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}
