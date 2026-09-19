"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "attendance", label: "Attendance" },
  { segment: "achievements", label: "Achievements" },
  { segment: "reports", label: "Reports" },
];

export function StudentTabs({ studentId }: { studentId: string }) {
  const pathname = usePathname();
  const base = `/students/${studentId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
