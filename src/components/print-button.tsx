"use client";

import { Button } from "@/components/ui";

/** Opens the browser's print dialog for whatever print route is showing. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()}>
      {label}
    </Button>
  );
}
