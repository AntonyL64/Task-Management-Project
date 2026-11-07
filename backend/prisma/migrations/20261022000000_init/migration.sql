CREATE TYPE "TaskPriority"     AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TaskStatus"       AS ENUM ('TODO', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED');
CREATE TYPE "EventSource"      AS ENUM ('INTERNAL', 'ICS', 'GOOGLE');
CREATE TYPE "RunTrigger"       AS ENUM ('MANUAL', 'TASK_CHANGED', 'DEPENDENCY_CHANGED', 'EVENT_CHANGED', 'WORKING_HOURS_CHANGED', 'SETTINGS_CHANGED', 'SESSION_MISSED');
CREATE TYPE "RunStatus"        AS ENUM ('PREVIEW', 'APPLIED', 'DISCARDED', 'FAILED');
CREATE TYPE "SessionStatus"    AS ENUM ('PLANNED', 'DONE', 'PARTIAL', 'MISSED');
CREATE TYPE "NotificationType" AS ENUM ('SESSION_REMINDER', 'DEADLINE_APPROACHING', 'TASK_AT_RISK', 'SCHEDULE_UPDATED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL, "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"));

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"));

CREATE TABLE "working_hours" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL, "endMinute" INTEGER NOT NULL,
  CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"));

CREATE TABLE "day_exceptions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "date" DATE NOT NULL,
  "isDayOff" BOOLEAN NOT NULL DEFAULT true, "note" TEXT,
  CONSTRAINT "day_exceptions_pkey" PRIMARY KEY ("id"));

CREATE TABLE "day_exception_slots" (
  "id" TEXT NOT NULL, "exceptionId" TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL, "endMinute" INTEGER NOT NULL,
  CONSTRAINT "day_exception_slots_pkey" PRIMARY KEY ("id"));

CREATE TABLE "scheduler_settings" (
  "userId" TEXT NOT NULL,
  "minSessionMinutes" INTEGER NOT NULL DEFAULT 30, "maxSessionMinutes" INTEGER NOT NULL DEFAULT 120,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 10, "planningHorizonDays" INTEGER NOT NULL DEFAULT 28,
  "dailyMaxMinutes" INTEGER, "autoReschedule" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "scheduler_settings_pkey" PRIMARY KEY ("userId"));

CREATE TABLE "projects" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#2F6FEB', "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"));

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT,
  "title" TEXT NOT NULL, "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM', "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  "deadline" TIMESTAMP(3), "earliestStart" TIMESTAMP(3),
  "estimatedMinutes" INTEGER NOT NULL, "remainingMinutes" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3), "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"));

CREATE TABLE "subtasks" (
  "id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "isDone" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id"));

CREATE TABLE "task_dependencies" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "predecessorId" TEXT NOT NULL, "successorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id"));

CREATE TABLE "calendar_events" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL,
  "recurrenceRule" TEXT, "timezone" TEXT, "excludedDates" TIMESTAMP(3)[],
  "recurringEventId" TEXT, "originalStartAt" TIMESTAMP(3),
  "source" "EventSource" NOT NULL DEFAULT 'INTERNAL', "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id"));

CREATE TABLE "scheduler_runs" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "trigger" "RunTrigger" NOT NULL, "status" "RunStatus" NOT NULL,
  "contractVersion" INTEGER NOT NULL, "input" JSONB NOT NULL, "inputHash" TEXT, "result" JSONB,
  "runtimeMs" INTEGER, "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "appliedAt" TIMESTAMP(3),
  CONSTRAINT "scheduler_runs_pkey" PRIMARY KEY ("id"));

CREATE TABLE "work_sessions" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "taskId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL,
  "plannedMinutes" INTEGER NOT NULL, "actualMinutes" INTEGER,
  "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED', "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "schedulerRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id"));

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL, "body" TEXT NOT NULL, "payload" JSONB,
  "scheduledFor" TIMESTAMP(3) NOT NULL, "sentAt" TIMESTAMP(3), "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"));

-- Chỉ mục
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "working_hours_userId_weekday_idx" ON "working_hours"("userId", "weekday");
CREATE UNIQUE INDEX "day_exceptions_userId_date_key" ON "day_exceptions"("userId", "date");
CREATE INDEX "day_exception_slots_exceptionId_idx" ON "day_exception_slots"("exceptionId");
CREATE INDEX "projects_userId_idx" ON "projects"("userId");
CREATE UNIQUE INDEX "tasks_id_userId_key" ON "tasks"("id", "userId");
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");
CREATE INDEX "tasks_userId_deadline_idx" ON "tasks"("userId", "deadline");
CREATE INDEX "subtasks_taskId_idx" ON "subtasks"("taskId");
CREATE UNIQUE INDEX "task_dependencies_predecessorId_successorId_key" ON "task_dependencies"("predecessorId", "successorId");
CREATE INDEX "task_dependencies_successorId_idx" ON "task_dependencies"("successorId");
CREATE UNIQUE INDEX "calendar_events_recurringEventId_originalStartAt_key" ON "calendar_events"("recurringEventId", "originalStartAt");
CREATE INDEX "calendar_events_userId_startAt_idx" ON "calendar_events"("userId", "startAt");
CREATE INDEX "scheduler_runs_userId_createdAt_idx" ON "scheduler_runs"("userId", "createdAt");
CREATE INDEX "work_sessions_userId_startAt_idx" ON "work_sessions"("userId", "startAt");
CREATE INDEX "work_sessions_taskId_idx" ON "work_sessions"("taskId");
CREATE INDEX "work_sessions_schedulerRunId_idx" ON "work_sessions"("schedulerRunId");
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX "notifications_scheduledFor_sentAt_idx" ON "notifications"("scheduledFor", "sentAt");

-- Khoá ngoại
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "day_exceptions" ADD CONSTRAINT "day_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "day_exception_slots" ADD CONSTRAINT "day_exception_slots_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "day_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduler_settings" ADD CONSTRAINT "scheduler_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessorId_userId_fkey" FOREIGN KEY ("predecessorId", "userId") REFERENCES "tasks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successorId_userId_fkey" FOREIGN KEY ("successorId", "userId") REFERENCES "tasks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurringEventId_fkey" FOREIGN KEY ("recurringEventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduler_runs" ADD CONSTRAINT "scheduler_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "tasks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_schedulerRunId_fkey" FOREIGN KEY ("schedulerRunId") REFERENCES "scheduler_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
