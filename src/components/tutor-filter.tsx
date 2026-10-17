import Link from "next/link";

import { cx } from "@/components/ui";

export type TutorOption = {
  id: string;
  displayName: string;
  /** Past occurrences in the visible month that still owe hours. */
  toLog: number;
};

/**
 * Whose calendar the office is looking at. Server-rendered links, so each tutor's
 * calendar is a real URL you can bookmark or send to them, and no JavaScript is
 * needed to switch.
 */
export function TutorFilter({
  tutors,
  selectedId,
  hrefFor,
}: {
  tutors: TutorOption[];
  selectedId: string | null;
  hrefFor: (tutorId: string | null) => string;
}) {
  return (
    <nav aria-label="Whose calendar to show" className="mb-6 flex flex-wrap gap-1.5">
      <Pill href={hrefFor(null)} active={selectedId === null}>
        All tutors
      </Pill>

      {tutors.map((tutor) => (
        <Pill key={tutor.id} href={hrefFor(tutor.id)} active={selectedId === tutor.id}>
          {tutor.displayName}
          {tutor.toLog > 0 ? (
            <span
              title={`${tutor.toLog} past session${tutor.toLog === 1 ? "" : "s"} this month still waiting on hours`}
              className={cx(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                selectedId === tutor.id
                  ? "bg-white/20 text-white"
                  : "bg-accent-soft text-accent",
              )}
            >
              {tutor.toLog}
            </span>
          ) : null}
        </Pill>
      ))}
    </nav>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-line-strong text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
