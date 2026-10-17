"use client";

import { useState } from "react";

import { SessionForm, type SessionTutor } from "./session-form";
import { Button } from "@/components/ui";

/** Keeps the form out of the way until the office actually wants it. */
export function NewSessionPanel({
  tutors,
  sites,
}: {
  tutors: SessionTutor[];
  sites: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Schedule a session</Button>;
  }

  return (
    <div className="w-full">
      <SessionForm tutors={tutors} sites={sites} onDone={() => setOpen(false)} />
    </div>
  );
}
