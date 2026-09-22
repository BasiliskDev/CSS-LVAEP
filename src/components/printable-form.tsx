import { ACHIEVEMENT_GROUPS } from "@/lib/achievements";
import { fiscalYearLabel, type AttendanceSummary } from "@/lib/fiscal-year";
import { AttendanceGrid } from "@/components/attendance-grid";

/**
 * A print reproduction of the LVA Essex/Passaic "Student Monthly Attendance &
 * Achievement Form", filled in from the logged events.
 *
 * Laid out for one landscape page: the attendance grid on the left, the achievements
 * checklist on the right, exactly as the original. Everything is plain black rules on
 * white so it photocopies and faxes the way the office expects.
 */
export function PrintableForm({
  student,
  tutorName,
  siteName,
  summary,
  attained,
  customGoals,
}: {
  student: {
    firstName: string;
    lastName: string;
    fiscalYearStart: number;
    days: string | null;
    times: string | null;
    status: string;
    stoppedReason: string | null;
  };
  tutorName: string;
  siteName: string | null;
  summary: AttendanceSummary;
  /** Codes the student has attained, e.g. {"A1","B4"}. */
  attained: Set<string>;
  customGoals: Array<{ code: string; label: string | null; attained: boolean }>;
}) {
  const stopped = student.status === "STOPPED";

  return (
    <article className="print-sheet mx-auto bg-white text-black">
      {/* Header: org block + contact box */}
      <div className="flex border border-black">
        <div className="flex-1 border-r border-black px-3 py-1.5 text-center">
          <h1 className="text-[9pt] font-bold leading-tight">
            LITERACY VOLUNTEERS OF AMERICA, ESSEX/PASSAIC COUNTY
          </h1>
          <p className="text-[8pt] font-bold leading-tight">
            Student Monthly Attendance &amp; Achievement Form – {fiscalYearLabel(student.fiscalYearStart)}
          </p>
          <div className="mt-2 flex items-end justify-center gap-6 text-[8pt]">
            <span className="flex items-end gap-1">
              Tutor:
              <span className="min-w-52 border-b border-black px-1 text-left font-medium">
                {tutorName}
              </span>
            </span>
            <span className="flex items-end gap-1">
              Student:
              <span className="min-w-52 border-b border-black px-1 text-left font-medium">
                {student.firstName} {student.lastName}
              </span>
            </span>
          </div>
        </div>

        <div className="w-60 px-2 py-1.5 text-center text-[7pt] leading-tight">
          <p className="font-bold">Contact Information</p>
          <p className="italic">90 Broad Street, Bloomfield, NJ 07003</p>
          <p className="italic">Bloomfield Public Library</p>
          <p className="italic">info@lvaep.org -- (973) 566-6200 x216</p>
        </div>
      </div>

      {/* Body: attendance | achievements */}
      <div className="flex border-x border-b border-black">
        <section className="flex-1 border-r border-black p-2">
          <h2 className="text-center text-[9pt] font-bold underline">ATTENDANCE</h2>
          <p className="mt-1 text-center text-[7.5pt] italic leading-tight">
            Please <span className="underline">complete a separate form for each student you tutor</span>.
            <br />
            Place number of hours tutored in the appropriate box (day and month).
          </p>
          <p className="mb-1.5 text-center text-[6.5pt] italic">
            (For Internal Use Only: <b>TA</b>: Tutor Absent <b>SA</b>: Student Absent <b>H</b>: Holiday)
          </p>

          <AttendanceGrid summary={summary} fiscalYearStart={student.fiscalYearStart} />
        </section>

        <aside className="w-60 p-2 text-[7.5pt] leading-tight">
          <h2 className="text-center text-[9pt] font-bold underline">ACHIEVEMENTS</h2>
          <p className="mb-2 mt-1 text-center text-[7pt] italic">
            Place a &quot;√&quot; next to each student&apos;s goal when attained.
          </p>

          {ACHIEVEMENT_GROUPS.map((group) => (
            <div key={group.key} className="mb-1.5">
              <p className="border-b border-black font-bold underline">
                {group.letter}. {group.title}
              </p>
              {group.items.map((item) => (
                <Row
                  key={item.code}
                  label={`${item.number}. ${item.core ? "*" : ""}${item.label}`}
                  checked={attained.has(item.code)}
                />
              ))}
            </div>
          ))}

          <div className="mb-1.5">
            <p className="border-b border-black font-bold underline">E. Other(s):</p>
            {customGoals.length === 0 ? (
              <>
                <EmptyRow />
                <EmptyRow />
              </>
            ) : (
              customGoals.map((goal, index) => (
                <Row
                  key={goal.code}
                  label={`${index + 1}. ${goal.label ?? ""}`}
                  checked={goal.attained}
                />
              ))
            )}
          </div>

          <div className="mt-2">
            <p className="text-center font-bold underline">STOPPED</p>
            <p className="flex gap-1">
              <Box checked={stopped} />
              <span>
                Please place a &quot;√&quot; in the box if your student is no longer being
                tutored and notify the office ASAP.
              </span>
            </p>
            <p className="mt-0.5 flex items-end gap-1">
              Reason:
              <span className="flex-1 border-b border-black">{student.stoppedReason ?? ""}</span>
            </p>
          </div>
        </aside>
      </div>

      {/* Footer strip */}
      <div className="flex border-x border-b border-black text-[8pt]">
        <span className="flex flex-1 items-end gap-1 border-r border-black px-2 py-1">
          <b>Tutoring Site:</b> {siteName ?? ""}
        </span>
        <span className="flex w-52 items-end gap-1 border-r border-black px-2 py-1">
          <b>Day(s):</b> {student.days ?? ""}
        </span>
        <span className="flex w-52 items-end gap-1 px-2 py-1">
          <b>Time(s):</b> {student.times ?? ""}
        </span>
      </div>

      <p className="mt-2 text-center text-[7pt] font-bold">
        Please consider adding extra time to all meetings, coordinating an extra session
        whenever possible, and regularly assigning homework (give your students credit for
        all completed work.)
      </p>
    </article>
  );
}

function Row({ label, checked }: { label: string; checked: boolean }) {
  return (
    <p className="flex items-start justify-between gap-1 border-b border-black">
      <span>{label}</span>
      <Box checked={checked} />
    </p>
  );
}

function EmptyRow() {
  return <p className="flex justify-between border-b border-black">&nbsp;</p>;
}

/** The form's checkbox: empty square, or a "√" once attained. */
function Box({ checked }: { checked: boolean }) {
  return (
    <span className="mt-[1px] inline-flex h-[8pt] w-[8pt] shrink-0 items-center justify-center border border-black text-[7pt] leading-none">
      {checked ? "√" : ""}
    </span>
  );
}
