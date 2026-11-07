-- Ràng buộc Prisma không biểu diễn được: CHECK, EXCLUDE (chống trùng giờ), trigger cùng chủ sở hữu.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================ giờ làm việc ================================
ALTER TABLE "working_hours"
  ADD CONSTRAINT "working_hours_weekday_chk" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "working_hours_range_chk"
    CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute"),
  -- Hai khung giờ cùng một thứ không được chồng nhau.
  ADD CONSTRAINT "working_hours_no_overlap"
    EXCLUDE USING gist ("userId" WITH =, "weekday" WITH =,
                        int4range("startMinute", "endMinute") WITH &&);

ALTER TABLE "day_exception_slots"
  ADD CONSTRAINT "day_exception_slots_range_chk"
    CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute"),
  ADD CONSTRAINT "day_exception_slots_no_overlap"
    EXCLUDE USING gist ("exceptionId" WITH =,
                        int4range("startMinute", "endMinute") WITH &&);

-- ============================ cấu hình ====================================
ALTER TABLE "scheduler_settings"
  ADD CONSTRAINT "scheduler_settings_session_chk"
    CHECK ("minSessionMinutes" > 0 AND "minSessionMinutes" <= "maxSessionMinutes"),
  ADD CONSTRAINT "scheduler_settings_buffer_chk" CHECK ("bufferMinutes" >= 0),
  ADD CONSTRAINT "scheduler_settings_horizon_chk" CHECK ("planningHorizonDays" BETWEEN 1 AND 90),
  ADD CONSTRAINT "scheduler_settings_daily_chk"
    CHECK ("dailyMaxMinutes" IS NULL OR "dailyMaxMinutes" > 0);

-- ============================ dự án và công việc ==========================
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_color_chk" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_estimated_chk" CHECK ("estimatedMinutes" > 0),
  ADD CONSTRAINT "tasks_remaining_chk" CHECK ("remainingMinutes" >= 0),
  ADD CONSTRAINT "tasks_window_chk"
    CHECK ("earliestStart" IS NULL OR "deadline" IS NULL OR "earliestStart" < "deadline"),
  -- completedAt có giá trị khi và chỉ khi trạng thái là DONE.
  ADD CONSTRAINT "tasks_completed_chk"
    CHECK (("status" = 'DONE') = ("completedAt" IS NOT NULL)),
  -- Task DONE không còn phút nào, để tiến độ dự án luôn đạt 100% khi xong.
  ADD CONSTRAINT "tasks_completed_remaining_chk"
    CHECK ("status" <> 'DONE' OR "remainingMinutes" = 0);

ALTER TABLE "task_dependencies"
  ADD CONSTRAINT "task_dependencies_no_self_chk" CHECK ("predecessorId" <> "successorId");

-- Task chỉ được gắn vào dự án của chính người dùng đó. Không dùng khoá ngoại
-- ghép (projectId, userId) vì khi xoá dự án, SetNull sẽ đặt cả userId về null.
CREATE OR REPLACE FUNCTION "enforce_task_project_owner"() RETURNS trigger AS $$
BEGIN
  IF NEW."projectId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "projects" p
    WHERE p."id" = NEW."projectId" AND p."userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'Task % tro toi du an cua nguoi dung khac', NEW."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tasks_project_owner"
  BEFORE INSERT OR UPDATE OF "projectId", "userId" ON "tasks"
  FOR EACH ROW EXECUTE FUNCTION "enforce_task_project_owner"();

-- ============================ lịch ========================================
ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_range_chk" CHECK ("endAt" > "startAt"),
  -- Bản ghi override phải có cả recurringEventId lẫn originalStartAt.
  ADD CONSTRAINT "calendar_events_override_pair_chk"
    CHECK (("recurringEventId" IS NULL) = ("originalStartAt" IS NULL)),
  -- Bản ghi override không được tự lặp.
  ADD CONSTRAINT "calendar_events_override_norule_chk"
    CHECK ("recurringEventId" IS NULL OR "recurrenceRule" IS NULL);

-- Override phải trỏ tới một sự kiện LẶP của CHÍNH người dùng đó.
CREATE OR REPLACE FUNCTION "enforce_event_override_target"() RETURNS trigger AS $$
BEGIN
  IF NEW."recurringEventId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "calendar_events" e
    WHERE e."id" = NEW."recurringEventId"
      AND e."userId" = NEW."userId"
      AND e."recurrenceRule" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Override % phai tro toi su kien lap cua cung nguoi dung', NEW."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "calendar_events_override_target"
  BEFORE INSERT OR UPDATE OF "recurringEventId", "userId" ON "calendar_events"
  FOR EACH ROW EXECUTE FUNCTION "enforce_event_override_target"();

-- ============================ lần chạy và phiên ===========================
ALTER TABLE "scheduler_runs"
  ADD CONSTRAINT "scheduler_runs_runtime_chk" CHECK ("runtimeMs" IS NULL OR "runtimeMs" >= 0),
  ADD CONSTRAINT "scheduler_runs_applied_chk"
    CHECK (("status" = 'APPLIED') = ("appliedAt" IS NOT NULL));

ALTER TABLE "work_sessions"
  ADD CONSTRAINT "work_sessions_range_chk" CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT "work_sessions_planned_chk" CHECK ("plannedMinutes" > 0),
  -- plannedMinutes luôn khớp đúng khoảng startAt–endAt.
  ADD CONSTRAINT "work_sessions_planned_matches_chk"
    CHECK ("plannedMinutes" * interval '1 minute' = "endAt" - "startAt"),
  ADD CONSTRAINT "work_sessions_actual_chk"
    CHECK ("actualMinutes" IS NULL OR "actualMinutes" >= 0),
  ADD CONSTRAINT "work_sessions_actual_required_chk"
    CHECK ("status" NOT IN ('DONE', 'PARTIAL') OR "actualMinutes" IS NOT NULL),
  -- Hai phiên còn hiệu lực (PLANNED) của cùng người dùng không bao giờ trùng giờ.
  -- Phiên đã DONE, PARTIAL, MISSED là lịch sử nên được miễn: người dùng có thể
  -- xong sớm và thời gian còn lại được xếp cho việc khác.
  ADD CONSTRAINT "work_sessions_no_overlap"
    EXCLUDE USING gist ("userId" WITH =, tsrange("startAt", "endAt") WITH &&)
    WHERE ("status" = 'PLANNED');

-- Phiên chỉ được gắn vào lần chạy lập lịch của CHÍNH người dùng đó. Không dùng
-- khoá ngoại ghép (schedulerRunId, userId) vì khi xoá lần chạy, SetNull sẽ đặt
-- cả userId về null.
CREATE OR REPLACE FUNCTION "enforce_session_run_owner"() RETURNS trigger AS $$
BEGIN
  IF NEW."schedulerRunId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "scheduler_runs" r
    WHERE r."id" = NEW."schedulerRunId" AND r."userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'Phien % gan vao lan chay cua nguoi dung khac', NEW."id"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "work_sessions_run_owner"
  BEFORE INSERT OR UPDATE OF "schedulerRunId", "userId" ON "work_sessions"
  FOR EACH ROW EXECUTE FUNCTION "enforce_session_run_owner"();
