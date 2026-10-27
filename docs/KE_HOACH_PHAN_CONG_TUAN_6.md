# TÀI LIỆU KẾ HOẠCH KỸ THUẬT VÀ PHÂN CÔNG NHIỆM VỤ: TUẦN 6
**Dự án:** Hệ thống Quản lý Công việc Cá nhân và Lập lịch Thông minh (Personal Task Manager & Scheduling System)  
**Mã dự án:** HK261-DAGD1-137  
**Giai đoạn:** Sprint Tuần 6 (Chuẩn bị cho Cột mốc Tích hợp Giữa kỳ Tuần 7–8)  
**Thời gian áp dụng:** 28/10/2026 – 03/11/2026  
**Tiêu chuẩn tài liệu:** ISO/IEC/IEEE 29148:2018 (Software Engineering Requirements & Work Breakdown Structure)

---

## 1. TỔNG QUAN VÀ MỤC TIÊU GIAI ĐOẠN

### 1.1. Bối cảnh
Dự án đã hoàn thành giai đoạn Tuần 5 với các cột mốc đã được xác nhận:
* **Thành viên A:** Đã bàn giao thiết kế cơ sở dữ liệu quan hệ PostgreSQL, Prisma Schema, Migration và Seed Data ban đầu.
* **Thành viên B:** Đã hoàn thiện lõi thuật toán lập lịch xác định (Deterministic Scheduling Engine) đạt chuẩn Contract v2, giải thuật kiểm tra chu trình đồ thị có hướng (DAG Cycle Detection), trừ khoảng bận (Interval Subtraction), tính toán đệm 15 phút (Buffer), phân bổ phiên (Session Allocation), và hệ thống cảnh báo rủi ro thời hạn (Deadline Risk Warnings). Kiểm thử tự động đạt 12/12 ca kiểm thử thành công (100% Pass).
* **Thành viên C:** Đã hoàn thiện bộ khung giao diện người dùng (UI Scaffolding) trên nền tảng React 19, Tailwind v4, Vite, bao gồm các khung nhìn: Calendar, TaskList, Kanban, Gantt, Focus và Settings.

### 1.2. Mục tiêu trọng tâm Tuần 6
1. **Thành viên A:** Hiện thực hóa tầng REST API trên NestJS, đóng gói logic nghiệp vụ CRUD cho Tasks, Projects, Calendar Events và Xác thực người dùng (Authentication).
2. **Thành viên B:** Hoàn thiện giải thuật Tái lập lịch (Rescheduling Core) tuân thủ nguyên lý Ổn định lịch trình (Schedule Stability) và Hạn chế xáo trộn (Minimum Disruption); xây dựng tầng dịch vụ `SchedulingModule` trên NestJS sẵn sàng tích hợp cơ sở dữ liệu.
3. **Thành viên C:** Xóa bỏ sự phụ thuộc vào dữ liệu tuần cố định (Hardcoded Week) trên giao diện Lịch, hỗ trợ bộ điều hướng tuần/tháng linh động và triển khai tương tác Khóa phiên làm việc (`isLocked`).

---

## 2. ĐẶC TẢ KIẾN TRÚC VÀ GIAO DIỆN HỢP ĐỒNG (INTER-MODULE CONTRACTS)

Hệ thống hoạt động theo mô hình Kiến trúc Nguyên khối Phân tầng (Modular Monolith) với phân định trách nhiệm rõ ràng:

```text
[Frontend: React 19 + Vite (Member C)]
               │
               ▼  HTTP REST API (JSON)
[Backend Core: NestJS (Member A)]  ──▶  [PostgreSQL 16 (Prisma ORM)]
               │
               ▼  In-Memory Invocation / Domain Service
[Scheduling Engine: Contract v2 (Member B)]
```

### 2.1. Hợp đồng dữ liệu đầu vào cho Thuật toán Lập lịch (Contract v2)
Toàn bộ luồng giao tiếp giữa Backend (Member A) và Lõi lập lịch (Member B) phải tuân thủ nghiêm ngặt DTO `ScheduleInput`:
* `now`: Chuỗi định dạng ISO-8601 UTC phản ánh thời điểm hiện tại.
* `settings`: Tham số cấu hình thuật toán (`planningHorizonDays`, `minSessionMinutes`, `maxSessionMinutes`, `bufferMinutes`, `dailyMaxMinutes`).
* `workingHours`: Khung giờ làm việc theo ngày trong tuần (`dayOfWeek: 0-6`, `startTime: "HH:mm"`, `endTime: "HH:mm"`).
* `busyIntervals`: Khoảng thời gian bận cố định không thể dịch chuyển (`start: ISO`, `end: ISO`, `isHardBusy: boolean`).
* `lockedSessions`: Các phiên làm việc đã được chốt cứng (`id`, `taskId`, `start: ISO`, `end: ISO`).
* `tasks`: Danh sách công việc cần lập lịch (`id`, `title`, `estimatedMinutes`, `remainingMinutes`, `priority`, `deadline`, `earliestStart`, `dependencyIds`).

---

## 3. BẢNG PHÂN RÃ CÔNG VIỆC CHI TIẾT (WORK BREAKDOWN STRUCTURE)

### 3.1. THÀNH VIÊN A: MODULE QUẢN TRỊ DỮ LIỆU, XÁC THỰC VÀ REST API CORE

#### Nhiệm vụ A.1: Xây dựng Module Xác thực (Authentication Module)
* **Mô tả:** Triển khai cơ chế xác thực người dùng dựa trên JSON Web Token (JWT) và mã hóa mật khẩu bằng `bcrypt`.
* **Endpoints yêu cầu:**
  * `POST /api/auth/register`: Tiếp nhận `email`, `password`, `name`. Trả về đối tượng `User` và mã trạng thái `201 Created`.
  * `POST /api/auth/login`: Xác thực thông tin đăng nhập, trả về `accessToken` và thông tin hồ sơ rút gọn.
  * `GET /api/auth/me`: Trả về thông tin chi tiết của người dùng đang đăng nhập qua `Bearer Token`.
* **Tiêu chuẩn kỹ thuật:**
  * Không lưu mật khẩu dạng văn bản thuần (Plaintext). Bắt buộc `saltRounds >= 10`.
  * Đính kèm `JwtAuthGuard` để bảo vệ các tài nguyên phía sau.

#### Nhiệm vụ A.2: Xây dựng Module Quản lý Công việc (Tasks Module API)
* **Mô tả:** Triển khai đầy đủ các thao tác CRUD cho thực thể Task, đồng bộ hoàn toàn với `schema.prisma`.
* **Endpoints yêu cầu:**
  * `GET /api/tasks`: Lấy danh sách công việc của người dùng hiện tại, hỗ trợ lọc theo `status` (`TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`) và `projectId`.
  * `POST /api/tasks`: Tạo công việc mới. Bắt buộc kiểm tra ràng buộc: `estimatedMinutes > 0`, `remainingMinutes = estimatedMinutes`, và các `dependencyIds` phải tồn tại trong cơ sở dữ liệu.
  * `PATCH /api/tasks/:id`: Cập nhật trạng thái công việc hoặc điều chỉnh thời gian còn lại (`remainingMinutes`). Khi `status` chuyển thành `DONE`, tự động gán `remainingMinutes = 0`.
  * `DELETE /api/tasks/:id`: Xóa công việc. Phải kiểm tra tính toàn vẹn khóa ngoại (Foreign Key Constraints) đối với các bảng `TaskDependency` và `WorkSession`.

#### Nhiệm vụ A.3: Xây dựng Module Sự kiện Lịch và Cài đặt (Calendar Events & Settings API)
* **Mô tả:** Quản lý các lịch bận cố định (họp, học tập) và cấu hình thời gian làm việc hàng ngày.
* **Endpoints yêu cầu:**
  * `GET /api/calendar/events`: Truy vấn danh sách sự kiện cố định trong khoảng thời gian `from` và `to`.
  * `POST /api/calendar/events`: Tạo sự kiện cố định mới.
  * `GET /api/users/working-hours`: Lấy danh sách khung giờ làm việc của người dùng.
  * `PUT /api/users/working-hours`: Cập nhật khung giờ làm việc theo ngày trong tuần.

---

### 3.2. THÀNH VIÊN B: SCHEDULING ENGINE, RESCHEDULING CORE VÀ ADAPTER INTEGRATION

#### Nhiệm vụ B.1: Hoàn thiện Thuật toán Tái Lập Lịch (Rescheduling Core)
* **Mô tả:** Nâng cấp giải thuật tái lập lịch tại `src/core/rescheduling.ts` nhằm đảm bảo nguyên lý Ổn định Lịch trình (Schedule Stability).
* **Đặc tả logic:**
  * **Xử lý sự kiện bận đột xuất:** Khi một sự kiện bận mới xuất hiện gây xung đột với một hoặc nhiều phiên làm việc hiện có, thuật toán chỉ được phép rút các phiên bị ảnh hưởng trực tiếp và dời chúng vào các khoảng trống khả dụng tiếp theo. Toàn bộ các phiên không bị ảnh hưởng phải được giữ nguyên vị trí (Retained Sessions).
  * **Bảo vệ phiên khóa (Locked Sessions):** Nếu sự kiện bận mới đè lên phiên làm việc đã bị khóa (`isLocked = true`), thuật toán không được phép tự ý dịch chuyển mà phải phát cảnh báo mã `LOCKED_SESSION_CONFLICT`.
  * **Xử lý công việc hoàn thành sớm:** Khi người dùng đánh dấu công việc là `DONE` trước hạn, toàn bộ các phiên làm việc dự kiến của công việc đó trong tương lai phải bị hủy bỏ ngay lập tức, giải phóng các slot trống cho các công việc có độ ưu tiên kế tiếp.
* **Kiểm thử tự động:** Mở rộng bộ kiểm thử Vitest, bổ sung tối thiểu 3 ca kiểm thử chuyên sâu cho các kịch bản trên, đảm bảo tỷ lệ Pass 100%.

#### Nhiệm vụ B.2: Đóng gói Scheduling Module trong Kiến trúc NestJS
* **Mô tả:** Đưa toàn bộ mã nguồn Scheduling Engine vào tầng dịch vụ của Backend tại thư mục `backend/src/scheduler/`.
* **Cấu trúc triển khai:**
  * `SchedulingService`: Lớp dịch vụ chịu trách nhiệm điều phối dữ liệu.
  * `SchedulingController`: Cung cấp 2 endpoint HTTP cho Frontend:
    * `POST /api/scheduler/auto-schedule`: Thực hiện lập lịch toàn diện.
    * `POST /api/scheduler/reschedule`: Thực hiện tái lập lịch cục bộ khi có biến động.
  * Tích hợp `PrismaToContractAdapter` đã xây dựng để tự động chuyển đổi dữ liệu từ các Model của Prisma (`Task`, `CalendarEvent`, `WorkSession`, `WorkingHour`) sang cấu trúc `ScheduleInput` của Engine.

#### Nhiệm vụ B.3: Soạn thảo Tài liệu Kỹ thuật và Báo cáo Giữa kỳ
* **Mô tả:** Chuẩn bị tài liệu kỹ thuật chi tiết phục vụ báo cáo tiến độ với Giảng viên hướng dẫn.
* **Nội dung bắt buộc:**
  * Sơ đồ đường ống dữ liệu (Pipeline Data Flow) 8 bước.
  * Phân tích toán học về giải thuật sắp xếp topo (Topological Sorting) và trừ khoảng thời gian (Interval Subtraction).
  * Bảng số liệu đo đạc hiệu năng (Benchmark Execution Time), chứng minh thời gian xử lý trung bình dưới 2ms cho kịch bản 20 công việc.

---

### 3.3. THÀNH VIÊN C: GIAO DIỆN NGƯỜI DÙNG, ĐIỀU HƯỚNG ĐA THỜI ĐIỂM VÀ TẦNG DỊCH VỤ CLIENT

#### Nhiệm vụ C.1: Xây dựng Bộ Điều hướng Tuần/Tháng Động trên Calendar
* **Mô tả:** Loại bỏ hoàn toàn mã cứng mảng ngày `[21, 22, 23, 24, 25, 26, 27]` của Tháng 9/2026 trên `Calendar.tsx`.
* **Yêu cầu kỹ thuật:**
  * Tạo trạng thái quản lý thời gian hiển thị: `selectedWeekStart: Date`.
  * Bổ sung thanh công cụ điều hướng:
    * Nút `<`: Lùi lại 7 ngày.
    * Nút `>`: Tiến lên 7 ngày.
    * Nút `Today`: Trở về tuần chứa ngày thực tế hiện tại.
  * Sinh tự động 7 cột ngày tương ứng dựa trên `selectedWeekStart`.
  * Đồng bộ hóa hàm lọc sự kiện `sessionToBlock()` để các phiên làm việc trong tháng hiện tại (Tháng 10, Tháng 11) hiển thị chính xác theo tọa độ ngày và giờ.

#### Nhiệm vụ C.2: Triển khai Tương tác Khóa / Mở khóa Phiên làm việc (Session Locking)
* **Mô tả:** Cho phép người dùng trực tiếp kiểm soát trạng thái cố định của từng phiên làm việc trên giao diện Lịch.
* **Yêu cầu kỹ thuật:**
  * Khi người dùng nhấp chuột vào một khối phiên làm việc màu tím (`WorkSession`), hiển thị thanh thao tác nhanh hoặc Popover:
    * Tùy chọn **"Khóa phiên làm việc"**: Chuyển trạng thái `isLocked = true`, hiển thị biểu tượng ổ khóa, đổi màu nền sang tông vàng cam nhạt.
    * Tùy chọn **"Mở khóa"**: Chuyển trạng thái `isLocked = false`.
  * Cập nhật trạng thái này vào danh sách `lockedSessions` để gửi vào thuật toán lập lịch.

#### Nhiệm vụ C.3: Thiết lập Tầng Dịch vụ API Client Chuẩn hóa
* **Mô tả:** Chuẩn bị sẵn cấu trúc gọi API tại thư mục `frontend/src/services/` nhằm sẵn sàng thay thế `mockData.ts` trong Tuần 7.
* **Cấu trúc yêu cầu:**
  * `apiClient.ts`: Cấu hình Axios / Fetch Base Client (quản lý `baseURL`, cấu hình Header `Authorization: Bearer <token>`).
  * `taskService.ts`: Đóng gói các hàm `getTasks()`, `createTask()`, `updateTaskStatus()`.
  * `schedulerService.ts`: Đóng gói các hàm `triggerAutoSchedule()`, `triggerReschedule()`.

---

## 4. MA TRẬN PHỤ THUỘC VÀ QUẢN TRỊ RỦI RO (DEPENDENCY & RISK MATRIX)

### 4.1. Ma trận phụ thuộc công việc (Task Dependencies)

```text
[A.1 Auth API] ───────▶ [A.2 Tasks API] ───────┐
                                               ▼
[B.1 Rescheduling] ──▶ [B.2 NestJS Scheduler] ───▶ [Tích hợp Toàn diện Tuần 7-8]
                                               ▲
[C.1 Nav Calendar] ──▶ [C.3 API Client Layer] ─┘
```

### 4.2. Quản trị rủi ro và Kế hoạch dự phòng

| Mã rủi ro | Mô tả rủi ro | Mức độ | Kế hoạch giảm thiểu / Dự phòng |
| :--- | :--- | :---: | :--- |
| **RSK-01** | Thành viên A chậm tiến độ hoàn thành API Auth và Tasks | Trung bình | Thành viên B và C tiếp tục sử dụng hợp đồng dữ liệu tĩnh Contract v2 và `PrismaToContractAdapter` đã được kiểm thử độc lập; tiến độ không bị nghẽn. |
| **RSK-02** | Xung đột múi giờ giữa Frontend (Local Time UTC+7) và Database/Engine (UTC) | Cao | Quy định thống nhất toàn dự án: Mọi trường `start`, `end`, `deadline` khi truyền qua API hoặc lưu vào DB bắt buộc sử dụng định dạng ISO-8601 UTC kết thúc bằng chữ `Z`. Tầng giao diện của C chịu trách nhiệm render ra giờ địa phương khi hiển thị. |
| **RSK-03** | Hiệu năng lập lịch giảm khi số lượng công việc và sự kiện tăng cao | Thấp | Lõi thuật toán của B đã được benchmark đạt ~1.5ms cho 20 tasks; cơ chế `planningHorizonDays` giới hạn phạm vi quét từ 7 đến 14 ngày, ngăn chặn suy giảm hiệu năng tuyến tính. |

---

## 5. TIÊU CHUẨN ĐÁNH GIÁ VÀ NGHIỆM THU (DEFINITION OF DONE - DoD)

Một nhiệm vụ trong Tuần 6 chỉ được coi là hoàn tất khi thỏa mãn đầy đủ các điều kiện sau:

1. **Về Mã nguồn (Source Code Quality):**
   * Tuân thủ 100% TypeScript Strict Mode. Tuyệt đối không sử dụng kiểu dữ liệu `any` không tường minh.
   * Lệnh biên dịch dự án chạy thành công tuyệt đối, không có cảnh báo:
     * Frontend: `npm run build` (kiểm tra `tsc -b && vite build` hoàn tất không lỗi).
     * Backend: `npm run build` (kiểm tra NestJS build hoàn tất).
2. **Về Kiểm thử (Testing Standards):**
   * Lõi thuật toán Scheduling và Rescheduling phải đạt tỷ lệ Pass 100% trên Vitest (`npm test` đạt tối thiểu 12/12 ca kiểm thử).
   * Các API Endpoint mới của A phải được kiểm chứng thông qua tệp test Postman hoặc Swagger UI.
3. **Về Quản lý Phiên bản (Version Control - Git):**
   * Không commit trực tiếp vào nhánh `main`.
   * Mỗi thành viên làm việc trên nhánh tính năng riêng:
     * Thành viên A: `feat/backend-api-core`
     * Thành viên B: `feat/scheduling-engine-core`
     * Thành viên C: `feat/dynamic-calendar-navigation`
   * Mọi Pull Request (PR) phải có phần mô tả tóm tắt nội dung thay đổi, đính kèm kết quả test và thông báo cho các thành viên còn lại review trước khi merge.

---

## 6. KẾ HOẠCH HỌP VÀ ĐỒNG BỘ TIẾN ĐỘ (SYNC SCHEDULE)

* **Điểm danh đầu tuần (Kick-off):** 20:00, Thứ Tư (28/10/2026) — Rà soát tài liệu phân công, chốt hợp đồng API.
* **Điểm kiểm tra kỹ thuật giữa tuần (Mid-week Checkpoint):** 20:00, Thứ Bảy (31/10/2026) — Kiểm tra tiến độ API của A, demo giải thuật Rescheduling của B, kiểm tra Calendar mới của C.
* **Nghiệm thu tuần và Chuẩn bị Tích hợp (Sprint Review):** 21:00, Thứ Hai (02/11/2026) — Chốt toàn bộ mã nguồn Tuần 6, chuẩn bị bước vào giai đoạn Tích hợp Hệ thống Tuần 7.
