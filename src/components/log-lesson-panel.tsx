"use client";

import { useState } from "react";

import { LessonForm } from "@/components/lesson-form";
import { Button, Card } from "@/components/ui";

/** "Add event" toggles an inline panel rather than a modal — less to get wrong. */
export function LogLessonPanel({
  studentId,
  fiscalYearStart,
  defaultStartTime,
  defaultEndTime,
}: {
  studentId: string;
  fiscalYearStart: number;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add event</Button>;
  }

  return (
    <Card className="w-full border-brand/40 p-4">
      <p className="mb-4 text-sm font-medium text-ink">New tutoring event</p>
      <LessonForm
        studentId={studentId}
        fiscalYearStart={fiscalYearStart}
        defaultStartTime={defaultStartTime}
        defaultEndTime={defaultEndTime}
        onDone={() => setOpen(false)}
      />
    </Card>
  );
}
