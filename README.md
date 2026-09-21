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

Requires Node 20+ and a Postgres database.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL
npx prisma migrate deploy     # create the tables
npx prisma db seed            # seed the site + an office account
npm run dev                   # http://localhost:3000
```

For a local database, either point `DATABASE_URL` at your hosted development
database, or run one in Docker:

```bash
docker run -d --name tutorlog-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tutorlog postgres:16
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
| `…/attendance` | Every tutoring event, as a **list** or the **grid**, plus the Jul–Jun monthly totals. |
| `…/print` | The filled paper form for one student, ready to print. |
| `/print` | Every student's form, one page each, printed in a single run. |
| `…/achievements` | The 17-item checklist plus custom goals. |
| `…/reports` | Written progress reports. |
| `/calendar` | **Global calendar** — every event across all your students in one month view. |
| `/admin` | Office view: every tutor and student, read-only. Requires an `ADMIN` account. |

### Attendance: two views over one log

Every tutoring event is added by hand and stored as its own row. Nothing is inferred.

- **List** (default) — newest first, grouped by month with an hours subtotal and an
  event count per month. Edit or delete any event inline.
- **Grid** — the paper form's own layout: 31 day-rows by 12 month-columns, Jul through
  Jun, with a total per month. Read-only by construction, since it is derived from the
  events, so its totals cannot disagree with the log. Days a month doesn't have (Feb 30,
  Jun 31) are greyed rather than left blank.

The view lives in the URL (`?view=grid`), so either is linkable.

### Printing

Two buttons produce the original paper form, filled in:

- **Print form** on a student — `/students/[id]/print`
- **Print all forms** on the dashboard — `/print`, one page per student, active students
  by default, with a link to include stopped ones

Both render the same [`PrintableForm`](src/components/printable-form.tsx): a landscape
sheet with the attendance grid on the left and the achievements checklist on the right,
ticks on attained goals, the STOPPED box, and the tutoring site / day(s) / time(s) strip
— plain black rules on white so it photocopies like the original. The on-screen toolbar
carries `no-print`, so only the sheet itself reaches the paper.

### Global calendar

The calendar is now a cross-student view only. `/calendar` answers the question a
per-student page cannot: *what does my week actually look like?* It shows every event across all of a tutor's students in one month, each chip
labelled with the student, plus a per-student hours breakdown for that month. Clicking an
event opens that student's own calendar on the same month.

It is a read-only overview: there is no add button, because "which student?" has no answer
on a shared day. Logging happens on a student's page.

Signed in as an `ADMIN`, the same page widens to every tutor's events and names the tutor
on each chip — the office's version of the same question.

It is built on [`CalendarMonth`](src/components/calendar-month.tsx), which owns the month
navigation, weekday row and day cells.

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

## Deploying to Vercel

The app is a standard Next.js server app with one external dependency: Postgres.

1. **Provision Postgres** — Vercel Postgres, Neon, Supabase, Railway; any of them work,
   since the code targets plain `postgresql` through `@prisma/adapter-pg`.
2. **Set environment variables** in the Vercel project: `DATABASE_URL` (the **pooled**
   connection string), `DIRECT_URL` (the unpooled one, used only by the Prisma CLI for
   migrations — DDL through a transaction-mode pooler is unreliable), and optionally
   `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.
3. **Set the build command** to `npm run vercel-build`, which runs
   `prisma generate && prisma migrate deploy && next build`. Both steps matter:
   the generated Prisma client is gitignored, so a build without `prisma generate`
   fails with `Can't resolve '@/generated/prisma/client'`; and without
   `migrate deploy` the database has no tables.
4. **Seed once**, against the hosted database:
   `DATABASE_URL="<your url>" npx prisma db seed`.

Use a **pooled** connection string. Each serverless instance opens its own pool, so an
unpooled endpoint runs out of connections under load; `DATABASE_POOL_MAX` (default 3)
caps the per-instance size.

Before putting a real roster behind a public URL, read the security section above —
the auth is prototype-grade and has no password reset, rate limiting or CSRF tokens.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · Prisma 7 over Postgres via
`@prisma/adapter-pg` · Tailwind v4 · Zod · Vitest.

Notes on versions: Next 16 renames `middleware.ts` to **`proxy.ts`**, `cookies()` is
async, and route `params` is a `Promise`. Prisma 7 requires a **driver adapter** and
generates its client into `src/generated/prisma` (gitignored — run `npx prisma generate`
after a fresh clone).

`npm audit` reports advisories in `mysql2` and `deepmerge-ts`. Both are transitive
dependencies of the Prisma **CLI** only; neither is shipped by this app.
