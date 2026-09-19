"use client";

import { useActionState, useState, useTransition } from "react";

import { useOnActionSuccess } from "@/hooks/use-on-action-success";

import {
  deleteReportAction,
  saveReportAction,
  type ActionState,
} from "@/app/students/[id]/actions";
import { formatDateDisplay, parseDateInput } from "@/lib/fiscal-year";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  Input,
  Textarea,
} from "@/components/ui";

export type ReportDraft = {
  id: string;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  body: string;
  updatedAt: string;
};

const initialState: ActionState = {};

export function ReportsPanel({
  studentId,
  reports,
  readOnly,
}: {
  studentId: string;
  reports: ReportDraft[];
  readOnly: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Reports"
          description="Longer write-ups on progress — the paper form had nowhere to put these."
          action={
            readOnly || creating ? null : (
              <Button onClick={() => setCreating(true)}>New report</Button>
            )
          }
        />

        {creating ? (
          <div className="border-b border-line p-5">
            <ReportForm
              studentId={studentId}
              onDone={() => setCreating(false)}
            />
          </div>
        ) : null}

        {reports.length === 0 && !creating ? (
          <EmptyState
            title="No reports yet"
            description="Write one at the end of a term, or whenever the office asks for an update."
          />
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((report) =>
              editingId === report.id ? (
                <li key={report.id} className="p-5">
                  <ReportForm
                    studentId={studentId}
                    report={report}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <ReportRow
                  key={report.id}
                  studentId={studentId}
                  report={report}
                  readOnly={readOnly}
                  onEdit={() => setEditingId(report.id)}
                />
              ),
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ReportRow({
  studentId,
  report,
  readOnly,
  onEdit,
}: {
  studentId: string;
  report: ReportDraft;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const start = report.periodStart ? parseDateInput(report.periodStart) : null;
  const end = report.periodEnd ? parseDateInput(report.periodEnd) : null;

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{report.title}</h3>
          {start || end ? (
            <p className="mt-0.5 text-xs text-muted">
              {start ? formatDateDisplay(start) : "…"} –{" "}
              {end ? formatDateDisplay(end) : "…"}
            </p>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex shrink-0 gap-1">
            {confirming ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteReportAction(studentId, report.id);
                      setConfirming(false);
                    })
                  }
                >
                  {isPending ? "Deleting…" : "Confirm delete"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={onEdit}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm whitespace-pre-wrap text-ink">{report.body}</p>
    </li>
  );
}

function ReportForm({
  studentId,
  report,
  onDone,
}: {
  studentId: string;
  report?: ReportDraft;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveReportAction.bind(null, studentId, report?.id ?? null),
    initialState,
  );

  useOnActionSuccess(state.ok, onDone);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="Title" htmlFor="title" error={state.fieldErrors?.title} required>
        <Input
          id="title"
          name="title"
          defaultValue={report?.title}
          placeholder="Fall term progress"
          autoFocus
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Period start"
          htmlFor="periodStart"
          error={state.fieldErrors?.periodStart}
        >
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={report?.periodStart ?? ""}
          />
        </Field>
        <Field
          label="Period end"
          htmlFor="periodEnd"
          error={state.fieldErrors?.periodEnd}
        >
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={report?.periodEnd ?? ""}
          />
        </Field>
      </div>

      <Field label="Report" htmlFor="body" error={state.fieldErrors?.body} required>
        <Textarea
          id="body"
          name="body"
          className="min-h-48"
          defaultValue={report?.body}
          placeholder="What has the student worked on, what has improved, what comes next?"
          required
        />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : report ? "Save changes" : "Save report"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
