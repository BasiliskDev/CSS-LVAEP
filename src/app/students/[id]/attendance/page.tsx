import { requireStudent } from "@/lib/guards";
import { prisma } from "@/lib/db";
import {
  FISCAL_MONTHS,
  calendarYearForFiscalMonth,
  fiscalYearLabel,
  formatDateInput,
  summarizeAttendance,
  todayUTC,
} from "@/lib/fiscal-year";
import type { LessonStatus } from "@/lib/constants";
import { AttendanceGrid } from "@/components/attendance-grid";
import { ButtonLink } from "@/components/ui";
import { LessonList } from "@/components/lesson-list";
import { LogLessonPanel } from "@/components/log-lesson-panel";
import { ViewToggle } from "@/components/view-toggle";
import { Card, CardHeader, StatTile } from "@/components/ui";

export default async function AttendancePage({
  params,
  searchParams,
}: PageProps<"/students/[id]/attendance">) {
  const { id } = await params;
  const query = await searchParams;
  const { student, readOnly } = await requireStudent(id);

  const lessons = await prisma.lesson.findMany({
    where: { studentId: id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const view = query.view === "grid" ? "grid" : "list";

  const today = todayUTC();

  const summary = summarizeAttendance(
    lessons.map((l) => ({
      id: l.id,
      date: l.date,
      hours: l.hours,
      status: l.status as LessonStatus,
    })),
    student.fiscalYearStart,
  );

  const drafts = lessons.map((l) => ({
    id: l.id,
    date: formatDateInput(l.date),
    hours: l.hours,
    startTime: l.startTime,
    endTime: l.endTime,
    status: l.status as LessonStatus,
    topics: l.topics,
    homeworkAssigned: l.homeworkAssigned,
    homeworkCompleted: l.homeworkCompleted,
    notes: l.notes,
  }));

  // Sessions usually recur at the same time, so seed the next one from the last slot.
  const lastSlot = lessons.find((l) => l.startTime && l.endTime);

  const basePath = `/students/${student.id}/attendance`;

  const thisMonthHours = summary.monthTotals[
    FISCAL_MONTHS.findIndex((m) => m.month === today.getUTCMonth())
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Hours this year"
          value={summary.grandTotal}
          sublabel={fiscalYearLabel(student.fiscalYearStart)}
        />
        <StatTile label="Hours this month" value={thisMonthHours ?? 0} />
        <StatTile
          label="Events logged"
          value={lessons.length}
          sublabel="Lessons, absences and holidays"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToggle basePath={basePath} view={view} />
        {readOnly ? null : (
          <LogLessonPanel
            studentId={student.id}
            fiscalYearStart={student.fiscalYearStart}
            defaultStartTime={lastSlot?.startTime ?? null}
            defaultEndTime={lastSlot?.endTime ?? null}
          />
        )}
      </div>

      {summary.outOfRange.length > 0 ? (
        <p className="rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-accent">
          {summary.outOfRange.length === 1
            ? "1 event falls"
            : `${summary.outOfRange.length} events fall`}{" "}
          outside {fiscalYearLabel(student.fiscalYearStart)}, so{" "}
          {summary.outOfRange.length === 1 ? "it is" : "they are"} not counted in the
          yearly total. Change the student&apos;s fiscal year on the Overview tab, or
          edit the dates.
        </p>
      ) : null}

      {view === "grid" ? (
        <Card>
          <CardHeader
            title={`Attendance grid · ${fiscalYearLabel(student.fiscalYearStart)}`}
            description="Hours by day and month, exactly as the paper form lays it out."
            action={
              <ButtonLink href={`/students/${student.id}/print`} variant="secondary">
                Print form
              </ButtonLink>
            }
          />
          <div className="overflow-x-auto p-5">
            <AttendanceGrid
              summary={summary}
              fiscalYearStart={student.fiscalYearStart}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Tutoring events"
            description={`${lessons.length} logged, newest first`}
          />
          <LessonList
            studentId={student.id}
            lessons={drafts}
            fiscalYearStart={student.fiscalYearStart}
            readOnly={readOnly}
          />
        </Card>
      )}

      {view === "grid" ? null : (
        <MonthlyTotals summary={summary} fiscalYearStart={student.fiscalYearStart} />
      )}
    </div>
  );
}

/** The one thing the paper grid did well: twelve monthly totals, at a glance. */
function MonthlyTotals({
  summary,
  fiscalYearStart,
}: {
  summary: ReturnType<typeof summarizeAttendance>;
  fiscalYearStart: number;
}) {
  return (
    <Card>
      <CardHeader
        title={`Monthly totals · ${fiscalYearLabel(fiscalYearStart)}`}
        description="Hours tutored per month, July through June."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-center text-xs tabular-nums">
          <thead>
            <tr>
              {FISCAL_MONTHS.map((m, i) => (
                <th
                  key={m.label}
                  scope="col"
                  className="border-b border-line px-1 py-2 font-semibold text-muted"
                  title={`${m.label} ${calendarYearForFiscalMonth(fiscalYearStart, i)}`}
                >
                  {m.label}
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-l border-line px-2 py-2 font-semibold text-ink"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {summary.monthTotals.map((total, i) => (
                <td
                  key={FISCAL_MONTHS[i].label}
                  className={total ? "px-1 py-2.5 font-semibold text-ink" : "px-1 py-2.5 text-faint"}
                >
                  {total || "—"}
                </td>
              ))}
              <td className="border-l border-line px-2 py-2.5 font-semibold text-brand">
                {summary.grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
