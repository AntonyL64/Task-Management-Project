# Tempo — Personal Task Management & Automated Scheduling System

> **Đồ án chuyên ngành** | Hệ thống quản lý công việc cá nhân và tự động lập lịch trên lịch cá nhân  
> **Thời gian:** Phase 1 (15 tuần)  
> **Nhóm thực hiện:** 3 thành viên

---

## 1. Giới thiệu tổng quan (Overview)

**Tempo** là ứng dụng web quản lý công việc cá nhân kết hợp thuật toán tự động lập lịch (Automatic Scheduling Engine) thông minh. Hệ thống giúp giải quyết bài toán phân bổ thời gian thực tế: chuyển đổi các đầu việc (Tasks) với thời lượng ước tính, độ ưu tiên, hạn chót và quan hệ phụ thuộc thành các phiên làm việc cụ thể (**Work Sessions**) lấp đầy các khoảng thời gian trống (**Free Slots**) trên lịch cá nhân.

### Điểm nổi bật cốt lõi
* **Tự động lập lịch (Auto-Scheduling):** Thuật toán Hybrid Heuristic xác định các khoảng trống khả dụng dựa trên giờ làm việc (Working Hours) và các sự kiện bận cố định (Fixed Events) để tự động xếp lịch.
* **Chia nhỏ công việc (Task Splitting/Chunking):** Tự động phân rã các task dài thành các phiên làm việc (sessions) phù hợp với độ dài tập trung của người dùng.
* **Xếp lại lịch thông minh (Targeted Rescheduling):** Tự động điều chỉnh lịch trình khi có phiên bị bỏ lỡ (missed session) hoặc hoàn thành một phần (partial work) mà vẫn giữ tính ổn định (schedule stability), bảo vệ các phiên đã khóa (locked sessions).
* **Đa chế độ xem (Multi-View UI):** Hỗ trợ toàn diện Task List, Calendar (Day/Week/Month), Kanban Board, Gantt/Timeline, và Focus Mode (Pomodoro/Deep Work).

---

## 2. Kiến trúc & Công nghệ (Tech Stack)

Hệ thống được thiết kế theo mô hình **Modular Monolith**:

| Tầng (Layer) | Công nghệ sử dụng | Vai trò |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Giao diện người dùng SPA hiện đại, tối ưu hiệu năng |
| **Styling & Icons** | Tailwind CSS v4 + Lucide React | Hệ thống thiết kế đồng nhất, responsive |
| **Calendar & Dnd** | FullCalendar + dnd-kit | Tương tác kéo thả, co giãn phiên, hiển thị lịch chuyên sâu |
| **Client State** | TanStack Query + React Router v7 | Quản lý server state, cache dữ liệu và điều hướng route |
| **Backend** | NestJS + TypeScript | Cung cấp RESTful API, xử lý nghiệp vụ và scheduling |
| **Database & ORM** | PostgreSQL + Prisma ORM | Lưu trữ dữ liệu quan hệ, transactional scheduling |
| **Testing** | Vitest, React Testing Library, Playwright | Unit test, component test và E2E testing |

---

## 3. Phân chia trách nhiệm trong nhóm (Team Ownership)

Dự án áp dụng nguyên tắc sở hữu domain rõ ràng: mỗi thành viên chịu trách nhiệm code nghiệp vụ thực tế và nắm trọn vẹn luồng dữ liệu khi bảo vệ.

* **Thành viên A (Domain & Data Engine):**
  * `M2 — Project / Task / Dependency`: CRUD Project, Task, Subtask checklist; quan hệ phụ thuộc Finish-to-Start và phát hiện chu trình (cycle detection).
  * `M3 — Calendar & Time Model`: Sự kiện cố định (Fixed Events), Working Hours, Day-off/Exceptions, múi giờ và quy ước UTC; API cung cấp dữ liệu cho Engine.
* **Thành viên B (Core Scheduling Engine):**
  * `M4 — Scheduling Engine`: Thuật toán tìm khoảng trống (Free-slot detection), xếp hạng task theo độ ưu tiên/deadline, chia phiên, phát hiện quá tải và sinh warning.
  * `M5 — Session Lifecycle & Rescheduling`: Vòng đời Work Session, cập nhật tiến độ (partial/missed), thuật toán xếp lại lịch có phạm vi và kiểm thử tính bất biến (invariants).
* **Thành viên C (Multi-view UI & Client Interactions):**
  * `M1 — Auth & Availability (UI)`: Giao diện Đăng nhập/Đăng ký, màn hình cấu hình Working Hours, Day-off, múi giờ và preferences.
  * `M6 — Views & Progress`: Hiện thực hóa toàn bộ các chế độ xem: Task List, Calendar tương tác, Kanban kéo thả, Gantt chart, Focus view, và Dashboard tiến độ/cảnh báo rủi ro; kiểm thử E2E.

---

## 4. Cấu trúc thư mục Frontend (`client/`)

```text
client/
├── public/              # Static assets & favicons
├── src/
│   ├── assets/          # Hình ảnh, icons nội bộ
│   ├── components/      # UI components dùng chung (Layout, Sidebar, Header, Modals)
│   ├── lib/             # Mock data, tiện ích cấu hình (utils, types)
│   ├── views/           # Các màn hình chính theo phân hệ
│   │   ├── Calendar.tsx # Chế độ xem lịch (Day / Week / Month)
│   │   ├── Focus.tsx    # Giao diện tập trung làm việc (Focus Session)
│   │   ├── Gantt.tsx    # Chế độ xem Gantt / Timeline trực quan
│   │   ├── Kanban.tsx   # Bảng trạng thái kéo thả Kanban
│   │   ├── Login.tsx    # Giao diện đăng nhập người dùng
│   │   ├── Progress.tsx # Bảng tiến độ, phân bổ thời gian và cảnh báo
│   │   ├── Settings.tsx # Cài đặt Working Hours, Timezone, Exceptions
│   │   ├── Signup.tsx   # Giao diện đăng ký tài khoản mới
│   │   └── TaskList.tsx # Danh sách công việc dạng bảng chi tiết
│   ├── App.tsx          # Định tuyến ứng dụng (React Router)
│   ├── index.css        # Khởi tạo Tailwind CSS & Theme variables
│   └── main.tsx         # Entry point của ứng dụng
├── package.json
└── vite.config.ts