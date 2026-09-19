# TutorLog — Student Attendance & Achievement

A web replacement for the Literacy Volunteers of America, Essex/Passaic County
**Student Monthly Attendance & Achievement Form** (FY 2026–2027).

The paper form is one sheet per student per fiscal year: a 31-day × 12-month grid of
hours running July→June, a five-group achievements checklist, and a STOPPED box.

This app replaces that grid with a log of individual **tutoring events**. Tutors add
each session as it happens — date, hours, what was covered — and read them back as
either a **list** or a **calendar**. Every total is derived from those events, so there
is no double entry, the numbers cannot disagree with the log, and there is room for
what paper had nowhere to put: per-event topics, homework and notes, plus longer
written reports per student.

## Setup

Requires Node 20+. No API keys, no hosted services.

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
npx prisma migrate dev        # create the SQLite database
npx prisma db seed            # seed the site + an office account
npm run dev                   # http://localhost:3000
```

The seed creates:
- **Bloomfield Public Library** (90 Broad Street, Bloomfield, NJ 07003) as a tutoring site
- an office account — username `admin`, password `changeme123`
  (override with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`)

Tutors sign themselves up at `/register`.

## How it works

| Screen | What it does |
|---|---|
| `/register`, `/login` | Username + password. Tutors self-register. |
| `/onboarding` | Tutor name, phone, site, usual days/times — the form's header block. Doubles as the profile editor afterwards. |
| `/dashboard` | The tutor's students, split Active / Stopped, with hours this month and this year. |
| `/students/[id]` | **Overview** — student details and the STOPPED box (reason required). |
| `…/attendance` | Every tutoring event, as a **list** or a **calendar**, plus the Jul–Jun monthly totals. |
| `…/achievements` | The 17-item checklist plus custom goals. |
| `…/reports` | Written progress reports. |
| `/calendar` | **Global calendar** — every event across all your students in one month view. |
| `/admin` | Office view: every tutor and student, read-only. Requires an `ADMIN` account. |

### Attendance: two views over one log

Every tutoring event is added by hand and stored as its own row. Nothing is inferred.

- **List** (default) — newest first, grouped by month with an hours subtotal and an
  event count per month. Edit or delete any event inline.
- **Calendar** — a month grid. Each day shows the events logged on it; clicking a day's
  `+` opens the form prefilled with that date, and clicking an event opens it for
  editing. Arrows page between months, `Today` jumps back. The view and month live in
  the URL (`?view=calendar&month=2026-09`), so any month is linkable.

Both views sit above a **monthly totals** strip — Jul through Jun plus a grand total —
which is the one thing the paper grid genuinely did well.

### Global calendar

`/calendar` answers the question a per-student page cannot: *what does my week actually
look like?* It shows every event across all of a tutor's students in one month, each chip
labelled with the student, plus a per-student hours breakdown for that month. Clicking an
event opens that student's own calendar on the same month.

It is a read-only overview: there is no add button, because "which student?" has no answer
on a shared day. Logging happens on a student's page.

Signed in as an `ADMIN`, the same page widens to every tutor's events and names the tutor
on each chip — the office's version of the same question.

Both calendars share one scaffold, [`CalendarMonth`](src/components/calendar-month.tsx),
which owns the month navigation, weekday row and day cells. The two callers supply only
the chips and the per-day action, which is the sole thing that differs between them.

### Hours come from the time slot

An event is recorded as a **time slot** — start and end — because that is what a tutor
actually knows. The duration is computed from it and shown live as you type
("1 hr 45 min · 1.75 h logged"), and the slot prefills from the student's most recent
event, since sessions usually recur at the same time.

`Lesson.hours` is a stored column, but it is **derived server-side** in
[`src/lib/validation.ts`](src/lib/validation.ts) and never read from the request — a
hand-crafted POST cannot inflate a student's total. A slot that ends before it starts
is treated as a typo rather than an overnight booking, and is rejected both in the form
and on the server; so is a slot longer than 12 hours.

Absences carry no slot at all and are always worth zero hours. Events logged before
time slots existed keep their hours and are shown as "no time slot recorded" until
edited — nothing was rewritten by the migration.

Several events on the same day are kept separate in both views but add up in the
totals. Absences carry the form's own codes — `TA` tutor absent, `SA` student absent,
`H` holiday — and are always worth zero hours, so they can never inflate a count.

An event dated outside the student's fiscal year is still saved and still shown on the
calendar, but is excluded from the yearly total and flagged on the page — the form
warns rather than silently dropping or misfiling it.

All dates are stored and read in **UTC**, so a day can't drift into its neighbour — and
therefore the neighbouring month or fiscal year — because of the server's timezone.

This logic lives in [`src/lib/fiscal-year.ts`](src/lib/fiscal-year.ts) as pure functions
and is the most heavily tested part of the app.

### Achievements

The catalog in [`src/lib/achievements.ts`](src/lib/achievements.ts) is transcribed
verbatim from the form, including the `*` that marks federally reportable outcomes. It
lives in code, not the database, so the checklist renders for a student with no saved
rows and revising the form needs no migration. Only state — attained, date, note — is
stored. "E. Other(s)" rows are per-student and store their own label.

## Security — read this before using real student data

The auth here is deliberately minimal, sized for a club prototype:

- passwords are **bcrypt**-hashed (10 rounds), never stored in the clear
- sessions are opaque 32-byte random tokens in an `httpOnly`, `SameSite=Lax` cookie
- every page and every server action authorizes through
  [`src/lib/guards.ts`](src/lib/guards.ts); a student that isn't yours returns 404, so a
  URL can't confirm that someone else's record exists
- the office (`ADMIN`) can read any student but writes are rejected server-side

**Not implemented:** password reset, email verification, login rate limiting, CSRF
tokens beyond the SameSite cookie, session rotation, and audit logging. `src/proxy.ts`
only checks that a session cookie is *present* — it can't reach the database, so it is a
redirect convenience, not the security boundary.

## Commands

```bash
npm run dev            # dev server
npm run build && npm start
npm run lint
npx vitest run         # unit tests
npx prisma studio      # browse the database
```

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · Prisma 7 over SQLite via
`better-sqlite3` · Tailwind v4 · Zod · Vitest.

Notes on versions: Next 16 renames `middleware.ts` to **`proxy.ts`**, `cookies()` is
async, and route `params` is a `Promise`. Prisma 7 requires a **driver adapter** and
generates its client into `src/generated/prisma` (gitignored — run `npx prisma generate`
after a fresh clone).

`npm audit` reports advisories in `mysql2` and `deepmerge-ts`. Both are transitive
dependencies of the Prisma **CLI** only; this project uses SQLite and ships neither.
