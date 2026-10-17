"use client";

import { useState } from "react";

import { Button, Input } from "@/components/ui";

/**
 * A URL the office needs to be able to hand over by other means.
 *
 * The readonly input is the primary element, not a fallback: `navigator.clipboard` is a
 * secure-context API, so it is simply undefined over plain http from anything but
 * localhost. Copy is the enhancement; selecting the text always works.
 */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access. The input is right there, already selectable.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label ?? "Invite link"}
        onFocus={(event) => event.currentTarget.select()}
        className="font-mono text-xs"
      />
      <Button type="button" variant="secondary" size="sm" onClick={copy} className="shrink-0">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
