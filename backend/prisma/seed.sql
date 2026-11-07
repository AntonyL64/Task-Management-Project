-- Dữ liệu mẫu (A-19). Chạy lại bao nhiêu lần cũng được: xoá 2 người dùng mẫu rồi tạo lại.
-- Mốc thời gian: ngày 0 = thứ Hai TUẦN SAU theo giờ Việt Nam; số âm là quá khứ.

BEGIN;
SET LOCAL TIME ZONE 'UTC';

CREATE FUNCTION pg_temp.at(d int, hhmm text) RETURNS timestamp(3) LANGUAGE sql AS $$
  SELECT ((date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 7 + d + hhmm::time)
          AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'UTC'
$$;
CREATE FUNCTION pg_temp.day(d int) RETURNS date LANGUAGE sql AS $$
  SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 7 + d
$$;
-- createdAt cách nhau 1 phút để thứ tự tie-break cố định
CREATE FUNCTION pg_temp.created(n int) RETURNS timestamp(3) LANGUAGE sql AS $$
  SELECT (now() - interval '14 days' + n * interval '1 minute')::timestamp(3)
$$;

DELETE FROM "users"
WHERE "id" IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')
   OR "email" IN ('demo@example.com', 'other@example.com');

-- ------------------------------ Người dùng ------------------------------
-- Mật khẩu của cả hai tài khoản: Demo@12345 (bcrypt, 10 rounds).
INSERT INTO "users" ("id", "email", "passwordHash", "displayName", "timezone", "updatedAt") VALUES
  ('a0000000-0000-4000-8000-000000000001', 'demo@example.com',  '$2b$10$DnJ.s.xjj0q2Zp6cQNZPv.EPd2j/fqzSInQfka/gLGVVPjwCOor6C', 'Sinh viên Demo', 'Asia/Ho_Chi_Minh', now()),
  ('a0000000-0000-4000-8000-000000000002', 'other@example.com', '$2b$10$DnJ.s.xjj0q2Zp6cQNZPv.EPd2j/fqzSInQfka/gLGVVPjwCOor6C', 'Người dùng khác', 'Asia/Ho_Chi_Minh', now());

INSERT INTO "scheduler_settings" ("userId", "minSessionMinutes", "maxSessionMinutes", "bufferMinutes", "planningHorizonDays", "dailyMaxMinutes") VALUES
  ('a0000000-0000-4000-8000-000000000001', 30, 120, 10, 14, 360),
  ('a0000000-0000-4000-8000-000000000002', 30, 120, 10, 28, NULL);

-- ------------------------------ Giờ làm ---------------------------------
-- Demo: T2–T6 08:00–11:30 và 13:30–17:30; T7 08:00–11:00; CN nghỉ.
INSERT INTO "working_hours" ("id", "userId", "weekday", "startMinute", "endMinute")
SELECT gen_random_uuid()::text, 'a0000000-0000-4000-8000-000000000001', wd, s, e
FROM generate_series(1, 5) wd, (VALUES (480, 690), (810, 1050)) v(s, e)
UNION ALL
SELECT gen_random_uuid()::text, 'a0000000-0000-4000-8000-000000000001', 6, 480, 660
UNION ALL
SELECT gen_random_uuid()::text, 'a0000000-0000-4000-8000-000000000002', wd, 540, 1020
FROM generate_series(1, 5) wd;

-- Thứ Tư tuần sau chỉ làm buổi sáng; thứ Sáu tuần sau nữa nghỉ cả ngày.
INSERT INTO "day_exceptions" ("id", "userId", "date", "isDayOff", "note") VALUES
  ('d1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', pg_temp.day(2),  false, 'Chiều đi thực tập'),
  ('d1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', pg_temp.day(11), true,  'Nghỉ lễ');

INSERT INTO "day_exception_slots" ("id", "exceptionId", "startMinute", "endMinute") VALUES
  (gen_random_uuid()::text, 'd1000000-0000-4000-8000-000000000001', 480, 660);

-- ------------------------------ Dự án -----------------------------------
INSERT INTO "projects" ("id", "userId", "name", "description", "color", "archivedAt", "updatedAt") VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Đồ án chuyên ngành', 'Quản lý công việc và tự động lập lịch', '#2F6FEB', NULL, now()),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Kinh tế vĩ mô', NULL, '#E8590C', NULL, now()),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Cá nhân', NULL, '#2B8A3E', NULL, now()),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Học kỳ trước', NULL, '#868E96', pg_temp.at(-30, '00:00'), now()),
  ('b0000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000002', 'Dự án của người khác', NULL, '#AE3EC9', NULL, now());

-- ------------------------------ Công việc -------------------------------
INSERT INTO "tasks" ("id", "userId", "projectId", "title", "priority", "status", "deadline", "earliestStart",
                     "estimatedMinutes", "remainingMinutes", "completedAt", "sortOrder", "createdAt", "updatedAt")
SELECT 'c0000000-0000-4000-8000-0000000000' || t.n, t.u, t.p, t.title, t.pr::"TaskPriority", t.st::"TaskStatus",
       t.dl, t.es, t.est, t.rem, t.done, t.sort, pg_temp.created(t.sort), now()
FROM (VALUES
  ('01', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Thiết kế ERD',               'HIGH',   'DONE',        pg_temp.at(-12, '17:00'), NULL::timestamp(3), 240, 0,   pg_temp.at(-12, '16:00'), 1),
  ('02', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Viết migration và seed',     'HIGH',   'IN_PROGRESS', pg_temp.at(1, '17:00'),   NULL, 180, 90,  NULL, 2),
  ('03', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'API Project và Task',        'HIGH',   'TODO',        pg_temp.at(4, '17:00'),   NULL, 480, 480, NULL, 3),
  ('04', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'API lịch và giờ làm',        'MEDIUM', 'TODO',        pg_temp.at(6, '17:00'),   NULL, 360, 360, NULL, 4),
  ('05', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Kiểm thử tích hợp',          'MEDIUM', 'TODO',        pg_temp.at(13, '17:00'),  pg_temp.at(7, '00:00'), 300, 300, NULL, 5),
  ('06', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Viết báo cáo tuần',          'LOW',    'TODO',        pg_temp.at(4, '21:00'),   NULL, 90,  90,  NULL, 6),
  ('07', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Ôn chương 1–3',              'URGENT', 'TODO',        pg_temp.at(2, '07:00'),   NULL, 240, 240, NULL, 7),
  ('08', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Làm bài tập nhóm',           'MEDIUM', 'PAUSED',      NULL,                     NULL, 120, 60,  NULL, 8),
  ('09', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Nộp bài tập nhóm',           'MEDIUM', 'TODO',        pg_temp.at(5, '23:00'),   NULL, 30,  30,  NULL, 9),
  ('10', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Tiểu luận chủ đề cũ',        'LOW',    'CANCELLED',   NULL,                     NULL, 120, 120, NULL, 10),
  ('11', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Chỉnh sửa tiểu luận',        'LOW',    'TODO',        NULL,                     NULL, 60,  60,  NULL, 11),
  ('12', 'a0000000-0000-4000-8000-000000000001', NULL,                                   'Dọn phòng',                  'LOW',    'TODO',        NULL,                     NULL, 60,  60,  NULL, 12),
  ('13', 'a0000000-0000-4000-8000-000000000001', NULL,                                   'Gửi email cho thầy',         'MEDIUM', 'TODO',        pg_temp.at(1, '12:00'),   NULL, 20,  20,  NULL, 13),
  ('14', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Gia hạn thẻ thư viện',       'MEDIUM', 'TODO',        pg_temp.at(-9, '17:00'),  NULL, 30,  30,  NULL, 14),
  ('15', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Đọc sách Clean Code',        'LOW',    'TODO',        NULL,                     NULL, 600, 600, NULL, 15),
  ('16', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Ôn thi học kỳ trước',        'MEDIUM', 'DONE',        NULL,                     NULL, 60,  0,   pg_temp.at(-40, '10:00'), 16),
  ('17', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Chuẩn bị slide thuyết trình', 'HIGH',   'TODO',        (date_trunc('hour', now()) + interval '1 day')::timestamp(3), NULL, 600, 600, NULL, 17),
  ('99', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000099', 'Việc của người khác',        'MEDIUM', 'TODO',        pg_temp.at(3, '17:00'),   NULL, 90,  90,  NULL, 99)
) AS t(n, u, p, title, pr, st, dl, es, est, rem, done, sort);

INSERT INTO "subtasks" ("id", "taskId", "title", "isDone", "sortOrder") VALUES
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000002', 'Migration',            true,  1),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000002', 'Dữ liệu mẫu',          false, 2),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000003', 'CRUD Project',         true,  1),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000003', 'CRUD Task',            false, 2),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000003', 'Subtask',              false, 3),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000003', 'Dependency + Kahn',    false, 4),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000007', 'Chương 1',             true,  1),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000007', 'Chương 2',             false, 2),
  (gen_random_uuid()::text, 'c0000000-0000-4000-8000-000000000007', 'Chương 3',             false, 3);

-- 01 → 02 → {03, 04} → 05 (hình thoi); 08 PAUSED → 09; 10 CANCELLED → 11
INSERT INTO "task_dependencies" ("id", "userId", "predecessorId", "successorId")
SELECT gen_random_uuid()::text, 'a0000000-0000-4000-8000-000000000001',
       'c0000000-0000-4000-8000-0000000000' || p, 'c0000000-0000-4000-8000-0000000000' || s
FROM (VALUES ('01', '02'), ('02', '03'), ('02', '04'), ('03', '05'), ('04', '05'), ('08', '09'), ('10', '11')) v(p, s);

-- ------------------------------ Lịch ------------------------------------
INSERT INTO "calendar_events" ("id", "userId", "title", "startAt", "endAt", "recurrenceRule", "timezone",
                               "excludedDates", "recurringEventId", "originalStartAt", "source", "externalId", "updatedAt") VALUES
  -- Lớp học lặp T2, T4; huỷ buổi thứ Tư tuần sau
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Lớp Kinh tế vĩ mô',
   pg_temp.at(-7, '07:30'), pg_temp.at(-7, '09:30'), 'FREQ=WEEKLY;BYDAY=MO,WE', 'Asia/Ho_Chi_Minh',
   ARRAY[pg_temp.at(2, '07:30')], NULL, NULL, 'INTERNAL', NULL, now()),
  -- Họp nhóm lặp T5, 10 buổi
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Họp nhóm đồ án',
   pg_temp.at(-4, '15:00'), pg_temp.at(-4, '16:00'), 'FREQ=WEEKLY;BYDAY=TH;COUNT=10', 'Asia/Ho_Chi_Minh',
   '{}', NULL, NULL, 'INTERNAL', NULL, now()),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Gặp thầy hướng dẫn',
   pg_temp.at(2, '09:00'), pg_temp.at(2, '10:00'), NULL, NULL, '{}', NULL, NULL, 'INTERNAL', NULL, now()),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Khám răng',
   pg_temp.at(3, '16:30'), pg_temp.at(3, '17:30'), NULL, NULL, '{}', NULL, NULL, 'INTERNAL', NULL, now()),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Sinh nhật bạn',
   pg_temp.at(5, '18:00'), pg_temp.at(5, '21:00'), NULL, NULL, '{}', NULL, NULL, 'ICS', 'demo-ics-001', now()),
  ('e0000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000002', 'Lịch của người khác',
   pg_temp.at(1, '10:00'), pg_temp.at(1, '11:00'), NULL, NULL, '{}', NULL, NULL, 'INTERNAL', NULL, now());

-- Buổi học thứ Hai tuần sau dời sang chiều (override phải chèn sau bản gốc)
INSERT INTO "calendar_events" ("id", "userId", "title", "startAt", "endAt", "excludedDates",
                               "recurringEventId", "originalStartAt", "updatedAt") VALUES
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'Lớp Kinh tế vĩ mô (học bù)',
   pg_temp.at(0, '13:30'), pg_temp.at(0, '15:30'), '{}',
   'e0000000-0000-4000-8000-000000000001', pg_temp.at(0, '07:30'), now());

-- ------------------------------ Phiên làm việc --------------------------
INSERT INTO "work_sessions" ("id", "userId", "taskId", "startAt", "endAt", "plannedMinutes", "actualMinutes", "status", "isLocked", "updatedAt") VALUES
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   pg_temp.at(-10, '08:00'), pg_temp.at(-10, '09:30'), 90, 90, 'DONE', false, now()),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008',
   pg_temp.at(-9, '14:00'), pg_temp.at(-9, '15:00'), 60, 60, 'PARTIAL', false, now()),
  -- Phiên khoá: bộ lập lịch không được dời
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007',
   pg_temp.at(1, '08:00'), pg_temp.at(1, '10:00'), 120, NULL, 'PLANNED', true, now());

COMMIT;
