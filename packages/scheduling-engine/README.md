# Scheduling Engine (Personal Task Manager)

> **Đồ án môn học:** HK261-DAGD1-137  
> **Module phụ trách (Thành viên B):** Scheduling Engine & Rescheduling Core  
> **Ngôn ngữ & Môi trường:** TypeScript (ES2022 / NodeNext), Node.js v24+

---

## 📖 Giới thiệu

Module này là trái tim tính toán lập lịch của hệ thống **Ứng dụng quản lý công việc cá nhân**. Được thiết kế theo chuẩn **Pure Core Engine**:
- Không phụ thuộc vào Database (Prisma/PostgreSQL).
- Không phụ thuộc vào Framework web (NestJS/Express) hay UI (React/Next).
- Toàn bộ dữ liệu giao tiếp thông qua **Contract v2** (`ScheduleInput` $\rightarrow$ `ScheduleResult`).

---

## ⚙️ Thuật toán cốt lõi

Áp dụng phương pháp **Deterministic Rule-Based Hybrid Scheduling**:
1. **Kiểm tra hợp lệ (Validator):** Phát hiện chu trình dependency (DAG cycle), lỗi thời gian, ràng buộc logic.
2. **Xử lý Timeline & Free Slots:**
   - Gộp các sự kiện cố định trùng nhau (`mergeIntervals`).
   - Mở rộng khoảng bận bằng thời gian đệm (`bufferMinutes`).
   - Ghim các phiên đã khóa (`LockedSession`).
   - Lấy giờ làm việc (`WorkingHours`) trừ đi các khoảng bận để thu được danh sách `Free Slots`.
3. **Phân cấp ưu tiên (Task Ranking):**
   - Lọc các task đã hoàn thành hoặc hủy.
   - Sắp xếp thứ tự: Phụ thuộc (Dependency readiness) $\rightarrow$ Hạn chót (Deadline) $\rightarrow$ Độ ưu tiên (Priority) $\rightarrow$ Thời điểm tạo (FIFO).
4. **Phân bổ phiên làm việc (Session Allocator):**
   - Tự động chia nhỏ task thành các session nằm trong khoảng `[minSessionMinutes, maxSessionMinutes]`.
   - Giới hạn tổng thời gian làm việc trong ngày theo `dailyMaxMinutes`.
   - Hỗ trợ lập lịch một phần (`PARTIALLY_SCHEDULED`) và cảnh báo quá hạn (`DEADLINE_RISK`).
5. **Tái lập lịch (Rescheduling Core - Tuần 5 P1):**
   - Xử lý khi có sự kiện cố định mới phát sinh hoặc task chưa hoàn thành.
   - Bảo vệ tuyệt đối các phiên đã khóa (`LockedSession`).

---

## 🚀 Hướng dẫn chạy thử nghiệm

### 1. Cài đặt các công cụ phát triển
```bash
npm install
```

### 2. Chạy Demo mẫu
Chạy trực tiếp kịch bản mẫu đầy đủ 4 task, sự kiện bận, buffer và locked session:
```bash
npm run demo
```

### 3. Chạy toàn bộ Unit & Integration Tests
```bash
npm test
```

---

## 📁 Cấu trúc thư mục

```text
scheduling-engine/
├── src/
│   ├── contracts/
│   │   └── scheduler-contract.ts     # Interface Contract v2 giữa Thành viên A và B
│   ├── core/
│   │   ├── validator.ts              # Kiểm tra hợp lệ dữ liệu & phát hiện vòng lặp
│   │   ├── interval.ts               # Toán tử khoảng thời gian, gộp busy, buffer, free slots
│   │   ├── ranking.ts                # Sắp xếp task theo DAG, deadline, priority
│   │   ├── allocator.ts              # Thuật toán phân bổ session và dailyMaxMinutes
│   │   └── rescheduling.ts           # Xử lý tái lập lịch (P1 Tuần 5)
│   ├── scheduler.ts                  # Hàm chính: schedule(input): ScheduleResult
│   └── demo.ts                       # Kịch bản chạy thử nghiệm thực tế
├── test/
│   └── scheduler.test.ts             # Bộ kiểm thử tự động
├── docs/
│   ├── ARCHITECTURE.md               # Sơ đồ luồng dữ liệu & kiến trúc
│   └── CONTRACT_V2.md                # Tài liệu giao ước API cho Thành viên A
├── package.json
└── tsconfig.json
```
