# Kiến trúc Hệ thống Scheduling Engine

## 1. Ranh giới kiến trúc (Hexagonal / Clean Architecture)
Module `scheduling-engine` hoạt động như một Domain Service độc lập.

```text
[ Database: PostgreSQL / Prisma ]
              │
      (Adapter của A)
              ▼
    ScheduleInput (Contract v2)
              ▼
   ┌──────────────────────────────────────────────┐
   │             SCHEDULING ENGINE                │
   │                                              │
   │  1. Validator (Check cycle, ISO dates, bounds)│
   │  2. Interval Core (Buffer, Merge, Subtract)  │
   │  3. Task Ranking (DAG readiness, Deadlines)  │
   │  4. Allocator (DailyMax, Min/Max sessions)   │
   │  5. Rescheduling Core (Locked sessions)      │
   └──────────────────────────────────────────────┘
              ▼
   ScheduleResult (PlannedSessions + Warnings)
              ▼
      (Adapter của A & C)
              │
[ Web API / NestJS / UI React / Calendar View ]
```

## 2. Quy trình xử lý chi tiết (8 Bước)
1. **Validation:** Kiểm tra toàn bộ schema, phát hiện nếu có chu trình vòng tròn giữa các task phụ thuộc nhau (Topological Cycle).
2. **Filter Active Tasks:** Tách task đã `DONE` hoặc `CANCELLED` ra khỏi luồng xử lý.
3. **Calculate Blocked Windows:**
   - Lấy toàn bộ `busyIntervals`, áp dụng `bufferMinutes` về cả hai phía trước/sau.
   - Ghim các `lockedSessions` vào danh sách bị chiếm chỗ.
4. **Generate Working Windows:** Lấy lịch `workingHours` nhân bản qua số ngày `planningHorizonDays`.
5. **Compute Free Slots:** `workingWindows - blockedWindows = freeSlots`.
6. **Task Ranking (Deterministic):**
   - Tiêu chí 1: Task đã thỏa mãn dependency lên trước.
   - Tiêu chí 2: Deadline sớm hơn lên trước (task không có deadline xếp sau).
   - Tiêu chí 3: Độ ưu tiên cao hơn (`URGENT` > `HIGH` > `MEDIUM` > `LOW`).
   - Tiêu chí 4: `createdAt` sớm hơn (FIFO).
   - Tiêu chí 5: `id` (đảm bảo tính xác định 100%).
7. **Session Allocation:**
   - Cắt slot thành các phiên có độ dài từ `minSessionMinutes` đến `maxSessionMinutes`.
   - Giới hạn tổng thời gian mỗi ngày không vượt quá `dailyMaxMinutes`.
   - Cập nhật thời điểm hoàn thành để mở khóa cho task phụ thuộc kế tiếp.
8. **Result & Warning Generation:**
   - Trả về `plannedSessions`.
   - Nếu task thiếu slot: đưa vào `unscheduledTasks` và tạo warning `PARTIALLY_SCHEDULED` hoặc `DEADLINE_RISK`.
