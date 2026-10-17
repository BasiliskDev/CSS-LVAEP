-- Office-run accounts, scheduled sessions, and the unassigned-student pool.
--
-- Every statement below is additive or a loosening of an existing constraint, so it is
-- safe against existing rows:
--   * new tables and new nullable columns reject nothing;
--   * ALTER COLUMN "tutorId" DROP NOT NULL cannot fail on existing data;
--   * the tutorId foreign key moves from ON DELETE CASCADE to SET NULL, and every
--     current value is still valid, so it re-validates instantly;
--   * both new unique indexes cover columns that are NULL in every existing row, and
--     Postgres treats NULLs as distinct, so no current row can collide.
--
-- Nothing here drops a column or adds NOT NULL to one that already exists.

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_tutorId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT,
ADD COLUMN     "removedByName" TEXT,
ADD COLUMN     "removedReason" TEXT,
ALTER COLUMN "tutorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "scheduledSessionId" TEXT;

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TUTOR',
    "siteId" TEXT,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSession" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "siteId" TEXT,
    "title" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSessionStudent" (
    "id" TEXT NOT NULL,
    "scheduledSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledSessionStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSessionSkip" (
    "id" TEXT NOT NULL,
    "scheduledSessionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledSessionSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_invitedById_idx" ON "Invite"("invitedById");

-- CreateIndex
CREATE INDEX "ScheduledSession_tutorId_status_idx" ON "ScheduledSession"("tutorId", "status");

-- CreateIndex
CREATE INDEX "ScheduledSession_status_startsOn_endsOn_idx" ON "ScheduledSession"("status", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "ScheduledSessionStudent_studentId_idx" ON "ScheduledSessionStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledSessionStudent_scheduledSessionId_studentId_key" ON "ScheduledSessionStudent"("scheduledSessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledSessionSkip_scheduledSessionId_date_key" ON "ScheduledSessionSkip"("scheduledSessionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Lesson_scheduledSessionId_date_idx" ON "Lesson"("scheduledSessionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_scheduledSessionId_studentId_date_key" ON "Lesson"("scheduledSessionId", "studentId", "date");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "ScheduledSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSessionStudent" ADD CONSTRAINT "ScheduledSessionStudent_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "ScheduledSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSessionStudent" ADD CONSTRAINT "ScheduledSessionStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSessionSkip" ADD CONSTRAINT "ScheduledSessionSkip_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "ScheduledSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

