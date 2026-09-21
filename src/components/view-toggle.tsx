import Link from "next/link";

import { cx } from "@/components/ui";

/** List / Grid switch. Server-rendered links so the view is linkable and shareable. */
export function ViewToggle({
  basePath,
  view,
}: {
  basePath: string;
  view: "list" | "grid";
}) {
  const options = [
    { key: "list" as const, label: "List", href: `${basePath}?view=list` },
    { key: "grid" as const, label: "Grid", href: `${basePath}?view=grid` },
  ];

  return (
    <div
      role="group"
      aria-label="Attendance view"
      className="inline-flex rounded-md border border-line-strong bg-surface p-0.5"
    >
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={view === option.key ? "true" : undefined}
          className={cx(
            "rounded px-3 py-1.5 text-sm font-medium transition-colors",
            view === option.key
              ? "bg-brand text-white"
              : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
