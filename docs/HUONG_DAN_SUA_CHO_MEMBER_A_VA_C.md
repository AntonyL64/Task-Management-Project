# BÁO CÁO KỸ THUẬT & HƯỚNG DẪN KHẮC PHỤC LỖI HỆ THỐNG
## DÀNH CHO THÀNH VIÊN A (BACKEND) VÀ THÀNH VIÊN C (FRONTEND)
**Dự án:** Hệ thống Quản lý Công việc Cá nhân và Lập lịch Thông minh (HK261-DAGD1-137)  
**Thời gian ban hành:** 07/11/2026  
**Mục tiêu:** Đồng bộ hóa Hợp đồng dữ liệu (Contract), kết nối thông luồng API thực tế và loại trừ rủi ro tương tranh.

---

## PHẦN 1: HƯỚNG DẪN DÀNH CHO THÀNH VIÊN A (BACKEND & DATABASE)

### 1. Vấn đề cốt tử: Thiếu Module Lập lịch (`SchedulerModule`) trong NestJS
* **Hiện trạng:** Trong `backend/src/app.module.ts`, hệ thống mới chỉ có `AuthModule`, `TasksModule`, `CalendarEventsModule`, `WorkingHoursModule`. Thành phần giá trị nhất của đồ án là Lập lịch tự động chưa có Endpoint nào trong Backend.
* **Yêu cầu thực hiện:** Tạo mới module `backend/src/scheduler/` và tích hợp vào `AppModule`.

#### Các bước triển khai chi tiết:
1. **Tạo Controller & Service:**
   Tạo tệp `backend/src/scheduler/scheduler.controller.ts`:
   ```typescript
   import { Controller, Post, Body, UseGuards } from '@nestjs/common';
   import { CurrentUser } from '../common/current-user.decorator';
   import { JwtAuthGuard } from '../auth/jwt-auth.guard';
   import { SchedulerService } from './scheduler.service';

   @Controller('scheduler')
   @UseGuards(JwtAuthGuard)
   export class SchedulerController {
     constructor(private readonly schedulerService: SchedulerService) {}

     @Post('auto-schedule')
     async autoSchedule(
       @CurrentUser('id') userId: string,
       @Body() body: { planningHorizonDays?: number; minSessionMinutes?: number; maxSessionMinutes?: number; bufferMinutes?: number; dailyMaxMinutes?: number }
     ) {
       return this.schedulerService.runAutoSchedule(userId, body);
     }

     @Post('reschedule')
     async reschedule(
       @CurrentUser('id') userId: string,
       @Body() body: { newBusyEventId?: string; completedTaskId?: string }
     ) {
       return this.schedulerService.runReschedule(userId, body);
     }
   }
   ```

2. **Kết nối Dữ liệu bằng Adapter có sẵn của Thành viên B:**
   Sử dụng tệp `backend/src/scheduler/adapter/prisma-to-contract-adapter.ts` (Thành viên B đã viết sẵn và test 100%):
   * Đọc `tasks`, `calendarEvents`, `workingHours`, `workSessions` của `userId` từ Prisma.
   * Gọi `convertPrismaToScheduleInput(user, tasks, events, workingHours, sessions)`.
   * Chạy hàm `schedule(input)` và lưu các `plannedSessions` mới vào bảng `WorkSession` trong một Transaction an toàn.

---

### 2. Sửa lỗi tương tranh Race Condition trong DAG Cycle Check
* **Hiện trạng:** Trong `backend/src/tasks/tasks.service.ts`, hàm `replaceDependencies` gọi `assertNoCycle(tx, ...)` rồi `createMany`. Mức cô lập mặc định của Postgres là `READ COMMITTED`, cho phép 2 request đồng thời tạo ra cạnh đối nghịch $A \to B$ và $B \to A$, sinh chu trình chết trong DB.
* **Giải pháp khắc phục:**
  1. Nâng mức cô lập lên `SERIALIZABLE`:
     ```typescript
     return this.prisma.$transaction(
       async (tx) => { ... },
       { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
     );
     ```
  2. Hoặc áp dụng khóa dòng bi quan (Pessimistic Locking) trên bản ghi User trước khi tính toán:
     ```typescript
     await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
     ```

---

### 3. Chuẩn hóa Múi giờ trong Working Hours
* **Hiện trạng:** Bảng `WorkingHour` chỉ lưu `startTime` và `endTime` dạng chuỗi (ví dụ `"09:00"`, `"17:00"`). Server chạy trên cloud theo UTC sẽ hiểu nhầm là `09:00 UTC` thay vì `09:00 UTC+7`.
* **Giải pháp:** Bổ sung trường `timezone` vào `User` hoặc `WorkingHour` (mặc định `'Asia/Ho_Chi_Minh'`), chuyển đổi giờ làm việc sang khoảng thời gian tuyệt đối khi trả dữ liệu cho thuật toán.

---

## PHẦN 2: HƯỚNG DẪN DÀNH CHO THÀNH VIÊN C (FRONTEND UI)

### 1. Chuẩn hóa Hợp đồng Giao diện `WorkSession`
* **Hiện trạng:** Trong `src/types/domain.ts`, `WorkSession` dùng `start`, `end`, nhưng các component FullCalendar (`Calendar.tsx`, `SessionDetailModal.tsx`) lại gọi `startAt`, `endAt`.
* **Đã xử lý:** Thành viên B đã cập nhật `src/types/domain.ts` hỗ trợ đồng thời cả `start` và `startAt`, `end` và `endAt`.
* **Quy ước từ nay:**
  * Mọi đối tượng thời gian hiển thị trên Calendar bắt buộc đọc trường `startAt` và `endAt` (chuỗi ISO-8601 UTC).

---

### 2. Sửa lỗi Đường dẫn Import tại `src/services/`
* **Hiện trạng:**
  * Tệp `src/services/api.ts` trước đây import sai `./domain` và được import sai vị trí `../types/api`.
* **Đã xử lý:**
  * Đã chuyển toàn bộ định nghĩa DTO API sang đúng vị trí: `src/types/api.ts`.
  * `src/services/api.ts` đóng vai trò re-export.
* **Yêu cầu Thành viên C:** Không tự ý tạo thêm các tệp types cục bộ mà sử dụng tập trung từ `@/types/api` và `@/types/domain`.

---

### 3. Thay thế hàm Giả lập `mockRunScheduler` bằng Gọi API Thật
* **Hiện trạng:** Nút bấm `Auto Schedule` trên Calendar và TaskList đang gọi hàm JavaScript in-memory `mockRunScheduler`.
* **Yêu cầu thực hiện:** Chuyển sang gọi HTTP thật thông qua `schedulerService`:
  ```typescript
  // Trong Calendar.tsx và TaskList.tsx:
  import { schedulerService } from '../services/schedulerService';

  const handleRunAutoSchedule = async () => {
    setIsScheduling(true);
    try {
      // Gọi API NestJS thật:
      const response = await schedulerService.runAutoSchedule({
        planningHorizonDays: 14,
        dailyMaxMinutes: 360,
      });
      // Cập nhật state lịch trình từ response trả về
      setScheduleResult(response);
    } catch (error) {
      console.error('Lỗi khi lập lịch tự động:', error);
    } finally {
      setIsScheduling(false);
    }
  };
  ```

---

### 4. Đồng bộ Trạng thái giữa Task List và Calendar
* **Hiện trạng:** Khi một task được bấm `DONE` ở trang TaskList, Calendar không biết để xóa các session tương ứng do dùng local state riêng rẽ.
* **Giải pháp:**
  * Tạo một Custom Event hoặc dùng lightweight store (ví dụ Zustand hoặc React Context) phát tín hiệu `TASK_COMPLETED`.
  * Hoặc khi người dùng chuyển tab sang Calendar, tự động kích hoạt `calendarService.getWorkSessions()` để lấy danh sách mới nhất từ server.

---

## TỔNG KẾT BÀN GIAO TỪ THÀNH VIÊN B
1. Nhánh tích hợp chung đã được tạo và kiểm tra biên dịch 0 lỗi: **`integrate/full-system`**.
2. Thành viên B đã hoàn tất và kiểm chứng 100% lõi giải thuật lập lịch và tái lập lịch trong thư mục `packages/scheduling-engine/`.
3. Thành viên A và C vui lòng kéo nhánh `integrate/full-system` về máy để tiếp tục hoàn thiện các mục theo hướng dẫn trên.
