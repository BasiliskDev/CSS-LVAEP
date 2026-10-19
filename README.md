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

**Nobody signs themselves up.** The office account creates every other account from
`/admin/invites`, which produces an invite link the tutor opens to choose their own
username and password. The link is always shown on screen and can be copied by hand,
so invites work whether or not email is configured (see **Email** below).

Because self-registration is closed and the app has no password reset, the seeded office
account is the way back in. If its password is lost:

```bash
SEED_ADMIN_RESET=1 SEED_ADMIN_PASSWORD='a-new-password' npx prisma db seed
```

Without `SEED_ADMIN_RESET=1` the seed leaves an existing account untouched, so a routine
deploy can never quietly reset a password.

### Email

Invite emails go through a Vercel Marketplace integration:

```bash
vercel integration add resend/resend-email   # accept the provider terms in the browser
vercel env pull                              # brings down RESEND_API_KEY
```

That key is the only thing required. Mail goes out through Resend's shared sender until
you verify a domain of your own and set `EMAIL_FROM`; the shared sender reliably reaches
the account owner and little else, so **the copyable invite link is the real path** until
a domain is verified. `/admin/invites` says so plainly when the key is missing.

A send that fails is recorded on the invite (`emailError`) and never loses it. All the
provider-specific code is in [`src/lib/email.ts`](src/lib/email.ts).

> `vercel env pull` writes `.env.local`, which Next loads at **higher precedence than
> `.env`**. If the pull brings down a hosted `DATABASE_URL`, it will silently override
> your local one — check the diff before running anything that writes to the database.

## How it works

| Screen | What it does |
|---|---|
| `/login` | Username + password. There is no sign-up form — accounts come from invites. |
| `/invite/[token]` | Public. Where an invited tutor chooses their username and password. |
| `/onboarding` | Tutor name, phone, site, usual days/times — the form's header block. Doubles as the profile editor afterwards. |
| `/dashboard` | The tutor's students, split Active / Stopped, with hours this month and this year. The office has no students, so an `ADMIN` is sent to `/admin` instead. |
| `/students/[id]` | **Overview** — student details, the STOPPED box (reason required), and removal. |
| `…/attendance` | Every tutoring event, as a **list** or a **calendar**, plus the Jul–Jun monthly totals. |
| `…/print` | The filled paper form for one student, ready to print. |
| `/print` | Every student's form, one page each, printed in a single run. |
| `…/achievements` | The 17-item checklist plus custom goals. |
| `…/reports` | Written progress reports. |
| `/calendar` | **Global calendar** — every event across all your students in one month view. The office gets a tutor switcher: all tutors, or one at a time (`?tutor=<id>`). |
| `/admin` | **Office.** Every tutor and student, plus the pool of unassigned students waiting to be given to a tutor. Requires an `ADMIN` account. |
| `/admin/invites` | Create, resend and revoke invites. Each open invite shows its copyable link. |
| `/admin/students/new` | Create a student and assign them to a tutor. Only the office can do this. |
| `/admin/sessions` | Weekly sessions: a tutor, one or more weekdays, a time slot, a set of students, and an end — either a last date or a number of meetings. |
| `/admin/sessions/[id]` | Edit a session, change who is in it, and cancel individual dates. |
| `/sessions/[id]/[date]` | One occurrence, every student, one submit — where a tutor logs a scheduled session. |

### Who can do what

The club runs top-down, and the app matches that.

**The office (`ADMIN`)** creates accounts, creates students, decides who tutors whom, and
schedules sessions. It can read every student's record but deliberately cannot *write* to
one — `requireStudent` returns `readOnly` for anyone who is not that student's tutor, so
the office changes assignments through its own actions rather than by editing a tutor's
sheet behind their back.

**A tutor** logs hours, ticks achievements and writes reports for their own students, and
nothing else. They cannot create a student, and they cannot create or edit a session.

A tutor *can* hand a student back, from the student's Overview tab. It takes two
deliberate steps — opening the panel, then typing the student's full name — because they
cannot undo it themselves. **Nothing is deleted:** every hour, goal, report and note is
kept, `Student.tutorId` becomes null, and the student appears in the office's
"Unassigned students" list, where an admin can assign them to anyone. Reassignment writes
one column, so the whole history comes along untouched.

### Scheduled sessions and the hours reminder

A session is a weekly rule — *Tutor Tony, Tuesdays and Thursdays 5:30–6:30 PM, Sep 1 to
Jan 19, students Nicky and Bonito* — not a pile of rows. Occurrences are computed from the
rule by `src/lib/recurrence.ts` and never stored, so editing the series is never a
reconciliation problem. A single date can be cancelled (a holiday, a closure) without
touching the rest, optionally stamping the paper form's own `H` on each student's sheet.

**Recurrence, the way a calendar app does it.** A series repeats on any combination of
weekdays — tick Tue and Thu and it meets twice a week — and it ends either on a date or
after a set number of meetings. The form previews what the rule produces ("10 meetings ·
Sep 1, 2026 – Oct 1, 2026") before anything is saved.

Both endings are stored the same way: `endsOn` always holds the real last date, and a
count is resolved to that date on save. `endMode` and `occurrenceCount` record only *how
the office expressed it*, so editing a series reopens the control they actually used.
That keeps every range query, index and membership check working on two plain columns
rather than branching on the end mode — and `nthOccurrence` is tested to agree with
`weeklyOccurrences` at every position, so "after 12 meetings" cannot store a date that
yields some other number.

Two of a calendar app's options are deliberately missing. There is no *repeats every N
weeks* (nobody asked, and it multiplies the cases to test), and no *never ends* — an
unbounded series would defeat the 18-month span cap that stops a mistyped year scheduling
sessions into the 2040s, and the club works in terms.

Occurrences show on `/calendar` as dashed outlines until their hours are logged, so a
glance distinguishes what was *meant* to happen from what did.

When a session's slot has passed and no hours were logged, the tutor's dashboard shows a
**"Sessions awaiting hours"** banner linking to a form that logs an event for every
student in that session at once. The slot comes from the series row rather than the form,
so hours stay derived and unforgeable; re-submitting updates the same events instead of
duplicating them.

This reminder is in-app only — no push notifications, no service worker, no cron, no extra
dependency. The trade is honest: it only reaches a tutor who opens the app. In exchange it
can never fire twice, go stale, be denied permission, or fail silently.

> **Time zones matter here.** Slots are wall-clock `"HH:MM"` strings and dates are stored
> as UTC midnight. Deciding "has this 5:30 PM session finished?" by treating the slot as
> UTC would fire the reminder four or five hours early in New Jersey. `src/lib/club-time.ts`
> compares in wall-clock space instead, which also makes daylight saving a non-event. It
> is the only module that knows about a time zone, and `todayUTC()` now routes through it —
> so an evening lesson no longer defaults to tomorrow's date.

### Attendance: two views over one log

Every tutoring event is added by hand and stored as its own row. Nothing is inferred.

- **List** (default) — newest first, grouped by month with an hours subtotal and an
  event count per month. Edit or delete any event inline.
- **Calendar** — a month laid out by real weekdays, but filled in like the paper grid:
  each day shows only the hours tutored that day, or the absence code. Clicking a day
  opens it — its events, with edit, and a form prefilled with that date. Arrows page
  between months and `Today` jumps back.

The view and month live in the URL (`?view=calendar&month=2026-09`), so either is
linkable.

The form's 31 x 12 grid was tried on screen and dropped: mapping a row and column back
to a real date is work the calendar does for you. It survives where it is actually
required — the printed form, below.

### Printing

Two buttons produce the original paper form, filled in:

- **Print form** on a student — `/students/[id]/print`
- **Print all forms** on the dashboard — `/print`, one page per student, active students
  by default, with a link to include stopped ones

Both render the same [`PrintableForm`](src/components/printable-form.tsx): a landscape
sheet with the form's own 31 x 12 attendance grid on the left and the achievements checklist on the right,
ticks on attained goals, the STOPPED box, and the tutoring site / day(s) / time(s) strip
— plain black rules on white so it photocopies like the original. The on-screen toolbar
carries `no-print`, so only the sheet itself reaches the paper.

### Global calendar

The calendar is now a cross-student view only. `/calendar` answers the question a
per-student page cannot: *what does my week actually look like?* It shows every event across all of a tutor's students in one month, each chip
labelled with the student, plus a per-student hours breakdown for that month. Clicking an
event opens that student's own calendar on the same month.

Scheduled sessions appear alongside, as dashed outlines, until their hours are logged —
so the same month view shows both what happened and what still owes hours. Clicking one
opens the session form for that date.

There is still no "add event" button here, because "which student?" has no answer on a
shared day. Ad-hoc logging happens on a student's page; scheduled logging happens through
the session chip.

Signed in as an `ADMIN`, the same page widens to every tutor's events and names the tutor
on each chip, with a row of pills above it to narrow the month to one tutor — the office's
version of the same question, asked of whoever they like. Each pill carries a count of
that tutor's past sessions still waiting on hours, and each tutor on `/admin` links
straight to their own calendar. The selected tutor lives in the URL, so a single tutor's
calendar is a link you can send them, and paging between months keeps them selected.

That switcher is also why the office only has two tabs. They are never assigned students,
so the Students tab would always be empty for them: their nav is **Calendar** and
**Office**, and both the logo and every post-login redirect lead to the control panel.

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
- accounts exist only by invitation; there is no public sign-up form
- **invite tokens are stored unhashed.** That is a deliberate trade: the requirement is a
  link the office can re-copy days later, which a hash would make impossible. The exposure
  is bounded by a 7-day expiry, single use, and the fact that accepting an invite closes it
- hours are always *derived* from a time slot and never read from the request, on both the
  single-lesson and the whole-session forms, so a hand-crafted POST cannot inflate a total
- a date arriving in a URL (`/sessions/[id]/[date]`) is checked against the series rule
  before anything is written

**Not implemented:** password reset in the app (see the seed escape hatch under **Setup**),
email verification, login rate limiting, CSRF tokens beyond the SameSite cookie, session
rotation, and audit logging. `src/proxy.ts`
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

Migrations need a direct (unpooled) connection — DDL and advisory locks don't survive a
transaction-mode pooler. Hosted, that resolves itself. Against a local Postgres without
TLS you'll need `?sslmode=disable`:

```bash
DIRECT_URL='postgresql://postgres:postgres@127.0.0.1:5432/tutorlog?sslmode=disable' \
  npx prisma migrate deploy
```

The date logic is timezone-sensitive, and a machine already in US Eastern time hides
exactly the bugs worth catching. Run the dev server as `TZ=UTC npm run dev` when testing
anything involving the reminder or a lesson's default date — Vercel's runtime is UTC.

## Deploying to Vercel

The app is a standard Next.js server app with one external dependency: Postgres.

1. **Provision Postgres** — Vercel Postgres, Neon, Supabase, Railway; any of them work,
   since the code targets plain `postgresql` through `@prisma/adapter-pg`.
2. **Set environment variables** in the Vercel project: `DATABASE_URL` (the **pooled**
   connection string) and optionally `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` /
   `SEED_ADMIN_EMAIL`, plus `RESEND_API_KEY` for invite emails.
   Migrations need an unpooled connection, but Neon's integration already injects
   `DATABASE_URL_UNPOOLED` and the Prisma config picks it up, so there is nothing extra
   to set. Override with `DIRECT_URL` only if your host names it differently.
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
