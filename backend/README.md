# backend: Thành viên A, tuần 8

REST API NestJS 11 + Prisma 6 + PostgreSQL 16. Thư mục này **thay thế thư mục `database/`** của tuần 3–4: `prisma/` (schema, migrations, seed) được chuyển vào đây nguyên vẹn. Thay đổi duy nhất là seed đã có mật khẩu thật.

## Chạy lần đầu (Windows, PowerShell)

Cần: Docker Desktop đang chạy, Node 22, pnpm (`corepack enable`).

```powershell
copy .env.example .env      # rồi đổi JWT_SECRET thành chuỗi ngẫu nhiên dài
pnpm install
pnpm db:up                  # PostgreSQL trong Docker
pnpm db:migrate             # tạo bảng + ràng buộc
pnpm db:seed                # dữ liệu mẫu
pnpm start:dev              # http://localhost:3000/api
```

Kiểm thử: `pnpm test:e2e` (38 test, chạy trên DB trong `.env`). Test tự tạo user email ngẫu nhiên rồi xoá khi xong, không đụng vào dữ liệu seed.

**Tài khoản seed:** `demo@example.com` và `other@example.com`, mật khẩu đều là `Demo@12345`.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | Khoá ký JWT. **Bắt buộc**, thiếu thì server không khởi động |
| `JWT_EXPIRES_IN` | Thời hạn token, mặc định `1d` |
| `BCRYPT_ROUNDS` | Mặc định 10; đặt thấp hơn 10 thì vẫn dùng 10 (DoD) |
| `CORS_ORIGIN` | Origin của frontend, nhiều origin cách nhau bằng dấu phẩy. Mặc định `http://localhost:5173` (Vite) |

## Cấu trúc

```
src/
  main.ts, app.setup.ts       prefix /api, ValidationPipe, filter lỗi Prisma
  app.module.ts               JwtAuthGuard toàn cục (APP_GUARD)
  prisma/                     PrismaService (@Global) — B inject thẳng vào SchedulingModule
  common/                     @Public(), @CurrentUser(), validator ISO-có-múi-giờ, filter lỗi DB
  auth/                       register, login, me, JwtStrategy, JwtAuthGuard
  tasks/                      CRUD + dependencyIds + chặn vòng phụ thuộc
  calendar-events/            sự kiện cố định (thường, lặp RRULE, override)
  working-hours/              giờ làm theo tuần, dạng Contract v2
  scheduler/                  auto-schedule, reschedule, work-sessions
    engine.ts                 cầu nối tới ../packages/scheduling-engine (engine của B)
    recurrence.ts             bung sự kiện lặp RRULE theo múi giờ
test/app.e2e-spec.ts, test/scheduler.e2e-spec.ts
```

**Bảo mật mặc định:** mọi route đều cần `Authorization: Bearer <token>`. Route mở phải gắn `@Public()`; hiện chỉ có `register` và `login`. Module mới, ví dụ Scheduling của B, được bảo vệ sẵn mà không phải làm gì thêm. Lấy user bằng `@CurrentUser() user` → `{ id, email }`.

---

## Tài liệu API (cho B và C)

Quy ước chung:
- **Thời gian (RSK-02):** client gửi ISO-8601 **bắt buộc có múi giờ** (`Z` hoặc `+07:00`). Chuỗi không có múi giờ bị trả 400. Server luôn trả UTC dạng `2026-11-02T13:00:00.000Z`.
- **Mã lỗi:**
  - `400`: dữ liệu sai, hoặc gửi trường lạ.
  - `401`: thiếu token hoặc token sai.
  - `404`: không tìm thấy, **kể cả khi bản ghi thuộc người khác** (không lộ id).
  - `409`: dữ liệu bị trùng.
- **Định dạng lỗi** (mặc định của NestJS): `{ statusCode, message, error }`. `message` có thể là mảng khi có nhiều lỗi validate.

### Auth

| Method | Đường dẫn | Body | Trả về |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password (8–72), displayName, timezone? }` | `201 AuthResponse`; `409` nếu email đã dùng |
| POST | `/api/auth/login` | `{ email, password }` | `200 AuthResponse`; `401` "Email hoặc mật khẩu không đúng" |
| GET | `/api/auth/me` | — | `200 User` |

```ts
interface AuthResponse {
  accessToken: string;          // JWT, payload { sub: userId, email }
  tokenType: 'Bearer';
  expiresIn: string;            // "1d"
  user: { id, email, displayName, timezone, createdAt, updatedAt }; // không bao giờ có passwordHash
}
```

Khi đăng ký, hệ thống tạo sẵn `scheduler_settings` mặc định, nên Scheduler luôn có `settings` để đọc.

### Tasks

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/api/tasks?status=TODO,IN_PROGRESS&priority=HIGH&projectId=<uuid\|none>` | Mọi tham số đều tuỳ chọn. Sắp theo `sortOrder`, `createdAt` |
| GET | `/api/tasks/:id` | Thêm ngoài bảng phân công |
| POST | `/api/tasks` | `201 Task` |
| PATCH | `/api/tasks/:id` | Chỉ gửi trường cần đổi |
| DELETE | `/api/tasks/:id` | `204`; phiên làm việc, subtask, phụ thuộc bị xoá theo |

```ts
// Body POST. PATCH dùng cùng các trường, tất cả tuỳ chọn, TRỪ estimatedMinutes (không sửa được).
{
  title: string;                       // 1–200 ký tự
  estimatedMinutes: number;            // >= 1, bắt buộc khi tạo
  remainingMinutes?: number;           // mặc định = estimatedMinutes
  description?: string | null;
  projectId?: string | null;           // phải là project của chính mình
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';            // mặc định MEDIUM
  status?: 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED'; // mặc định TODO
  deadline?: string | null;            // ISO có múi giờ
  earliestStart?: string | null;       // phải trước deadline
  dependencyIds?: string[];            // task phải xong trước; gửi lên = THAY THẾ cả danh sách
  sortOrder?: number;
}
// Task trả về: toàn bộ cột của bảng tasks + dependencyIds: string[]
```

Quy tắc nghiệp vụ:
- **`status = DONE`** → `remainingMinutes = 0` và đặt `completedAt`. Nếu client gửi kèm `remainingMinutes` thì giá trị đó bị bỏ qua.
- **Rời khỏi `DONE`** (mở lại task) → `completedAt = null`. `remainingMinutes` lấy giá trị client gửi; nếu không gửi thì quay về `estimatedMinutes`.
- **`dependencyIds`** phải là task của chính mình, không được trỏ vào chính nó và không được tạo vòng (A → B → A). Vi phạm trả `400`.

### Calendar events

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/api/calendar/events?from=<iso>&to=<iso>` | Trả sự kiện giao với `[from, to)`, cộng **mọi sự kiện lặp bắt đầu trước `to`** |
| POST | `/api/calendar/events` | `201 CalendarEvent` |
| PATCH | `/api/calendar/events/:id` | Thêm ngoài bảng phân công, vì Calendar sẽ cần |
| DELETE | `/api/calendar/events/:id` | `204`; xoá sự kiện lặp gốc thì các override bị xoá theo |

```ts
{
  title: string;
  startAt: string; endAt: string;      // endAt > startAt
  recurrenceRule?: string | null;      // RRULE không có tiền tố "RRULE:", ví dụ "FREQ=WEEKLY;BYDAY=MO,WE"
  timezone?: string | null;            // múi giờ để bung RRULE; null = của user
  excludedDates?: string[];            // giờ bắt đầu gốc của các buổi bị huỷ
  recurringEventId?: string | null;    // override: id sự kiện lặp gốc của mình…
  originalStartAt?: string | null;     // …đi cùng giờ bắt đầu gốc của buổi bị dời
}
```

`source` luôn là `INTERNAL`; client không gửi trường này được.

> **Cho B:** API trả bản ghi như lưu trong DB, **chưa bung RRULE**. `PrismaToContractAdapter` cần bung sự kiện lặp thành `busyIntervals`: bỏ các ngày trong `excludedDates`, và thay buổi gốc bằng bản override có `originalStartAt` trùng.

### Working hours

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/api/users/working-hours` | |
| PUT | `/api/users/working-hours` | **Thay toàn bộ** giờ làm trong tuần; gửi `[]` để xoá hết |

```ts
// Body PUT, và cũng là dạng trả về của cả GET lẫn PUT (bản trả về có thêm id và timezone)
{
  timezone: 'Asia/Ho_Chi_Minh',        // chỉ có ở response
  workingHours: [
    { id, dayOfWeek: 1, startTime: '08:00', endTime: '11:30' },
    { id, dayOfWeek: 1, startTime: '13:30', endTime: '17:00' },  // một ngày có thể có nhiều khung
  ]
}
```

- `dayOfWeek`: 0 là Chủ nhật, 6 là Thứ bảy.
- `startTime` và `endTime` dùng dạng `HH:mm`, là **giờ địa phương** của user. `24:00` nghĩa là hết ngày.
- Các khung trong cùng một ngày không được chồng nhau.

Mảng `workingHours` khớp đúng `ScheduleInput.workingHours` của Contract v2, trừ trường `id`.

### Scheduler (dùng engine của Thành viên B)

Server tự đọc tasks, sự kiện, giờ làm, phiên đã khoá và cấu hình của user từ DB rồi dựng `ScheduleInput` (Contract v2). **Client không gửi input.**

| Method | Đường dẫn | Body (đều tuỳ chọn) |
|---|---|---|
| POST | `/api/scheduler/auto-schedule` | `{ planningHorizonDays?, minSessionMinutes?, maxSessionMinutes?, bufferMinutes?, dailyMaxMinutes? }`: chỉ áp dụng cho lần chạy này, mặc định lấy từ `scheduler_settings` |
| POST | `/api/scheduler/reschedule` | `{ newBusyEventId?, completedTaskId?, mode?: 'MINIMAL_DISRUPTION' \| 'FULL_OPTIMIZATION' }` |
| GET | `/api/work-sessions?from=&to=` | Phiên làm việc để vẽ Calendar (có `taskTitle`, `status`) |
| PATCH | `/api/work-sessions/:id` | `{ isLocked: boolean }`: khoá hoặc mở khoá một phiên |

Response của hai endpoint scheduler là `ScheduleResult` của Contract v2, cộng thêm `runId` và `runtimeMs`. `id` trong `plannedSessions` là **id thật trong bảng `work_sessions`**:
```ts
{ runId, runtimeMs, plannedSessions: [{ id, taskId, start, end, durationMinutes, locked }], unscheduledTasks, warnings }
// reschedule có thêm: summary: { retained, moved, cancelled, added }
```

Cách lưu kết quả:
- **auto-schedule:** xoá mọi phiên `PLANNED` **chưa khoá** chưa kết thúc rồi lưu kế hoạch mới. Phiên đã khoá giữ nguyên.
- **reschedule (Minimum Disruption):**
  - Chỉ dời các phiên va chạm với `newBusyEventId`; phiên khác giữ nguyên id và giờ.
  - `completedTaskId` huỷ các phiên tương lai của task đó. Nên gọi `PATCH /api/tasks/:id {status:'DONE'}` trước.
  - Sự kiện lặp ảnh hưởng nhiều tuần nên trả 400; trường hợp này dùng auto-schedule.
- Mỗi lần chạy lưu một dòng `scheduler_runs` (input, inputHash, result, runtimeMs). Phiên mới gắn `schedulerRunId` của lần chạy đó.

Ghi chú kỹ thuật:
- **Múi giờ:** `users.timezone` được đổi thành `timezoneOffsetMinutes` (ví dụ +420) truyền cho engine.
- **Sự kiện lặp:** được bung bằng `src/scheduler/recurrence.ts`, hỗ trợ DAILY/WEEKLY, INTERVAL, BYDAY, COUNT, UNTIL, `excludedDates` và override. Thứ trong tuần tính theo giờ địa phương.
- **Chạy đồng thời:** mỗi lần lập lịch và mỗi lần đổi phụ thuộc đều khoá dòng `users` (`SELECT … FOR UPDATE`), nên các thao tác của cùng một user chạy lần lượt.
- **Build:** backend import thẳng mã nguồn `packages/scheduling-engine`, nên file chạy nằm ở `dist/backend/src/main.js`.

