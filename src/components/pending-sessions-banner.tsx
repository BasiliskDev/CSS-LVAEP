import Link from "next/link";

import { ButtonLink, Card } from "@/components/ui";
import { formatDateDisplay } from "@/lib/fiscal-year";
import { getPendingSessions } from "@/lib/scheduled-sessions";
import { formatTimeRange } from "@/lib/time-slot";

/**
 * "You still owe hours for these." Shown on the dashboard above everything else,
 * because a reminder below the fold isn't a reminder.
 *
 * This is the whole notification mechanism: no push, no service worker, no cron. The
 * trade is honest — it only reaches a tutor who opens the app — but it never silently
 * fails, never needs permission, and can't fire twice or go stale.
 */
export async function PendingSessionsBanner({ tutorId }: { tutorId: string }) {
  const pending = await getPendingSessions(tutorId);
  if (pending.length === 0) return null;

  return (
    <Card className="mb-6 border-accent/40 bg-accent-soft">
      <div className="border-b border-accent/20 px-5 py-3">
        <h2 className="text-sm font-semibold text-accent">
          {pending.length === 1
            ? "1 session is waiting on your hours"
            : `${pending.length} sessions are waiting on your hours`}
        </h2>
        <p className="mt-0.5 text-xs text-accent/80">
          These finished without any hours logged. It takes one form each.
        </p>
      </div>

      <ul className="divide-y divide-accent/20">
        {pending.map((occurrence) => (
          <li
            key={`${occurrence.seriesId}-${occurrence.dateKey}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {formatDateDisplay(occurrence.date)}
                <span className="font-normal text-muted">
                  {" · "}
                  {formatTimeRange(occurrence.startTime, occurrence.endTime)}
                </span>
              </p>
              <p className="truncate text-xs text-muted">
                {occurrence.title ? `${occurrence.title} · ` : ""}
                {occurrence.students
                  .map((student) => `${student.firstName} ${student.lastName}`)
                  .join(", ")}
              </p>
            </div>

            <ButtonLink
              href={`/sessions/${occurrence.seriesId}/${occurrence.dateKey}`}
              size="sm"
              className="ml-auto shrink-0"
            >
              Log hours
            </ButtonLink>
          </li>
        ))}
      </ul>

      <p className="px-5 py-3 text-xs text-muted">
        Scheduled by the office.{" "}
        <Link href="/calendar" className="font-medium text-brand hover:underline">
          See the calendar
        </Link>
      </p>
    </Card>
  );
}
