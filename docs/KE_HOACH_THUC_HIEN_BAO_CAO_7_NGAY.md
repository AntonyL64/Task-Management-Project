# KẾ HOẠCH HÀNH ĐỘNG 7 NGÀY & DÀN Ý CHI TIẾT BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH
**Dự án:** Hệ thống Quản lý Công việc Cá nhân và Lập lịch Thông minh (Personal Task Manager)  
**Mã đồ án:** HK261-DAGD1-137 | **Khoa:** Khoa học và Kỹ thuật Máy tính - ĐH Bách Khoa ĐHQG-HCM  

---

## 👥 PHÂN CÔNG NHÂN SỰ & VAI TRÒ TRÊN GIT:
* **Member A (Huy Lê - `huyle1207`):** Backend Architecture, PostgreSQL, Prisma ORM, Auth JWT, Task CRUD & 38 E2E Tests.
* **Member B (Hưng Lê - `codemiy282`):** Algorithms & Scheduling Core, Kahn Topo Sort O(V log V + E), Interval Subtraction, Contract v2 & 14 Unit Tests.
* **Member C (Lưu Hùng - `AntonyL64`):** Frontend Architecture, React 19, FullCalendar View, TaskList, Modal Khóa phiên & Axios API Client.

---

## 📅 PHẦN 1: BẢN KẾ HOẠCH HÀNH ĐỘNG 7 NGÀY (DAY-BY-DAY ACTION ROADMAP)

### NGÀY 1: KHỞI TẠO KHUNG TÀI LIỆU, CHƯƠNG 1 (MỞ ĐẦU) & CHƯƠNG 2 (KHẢO SÁT ỨNG DỤNG)
* **Member C**:
  * Dựng khung Báo cáo Đồ án chuyên ngành chuẩn bìa, mục lục, danh mục bảng, danh mục hình (theo format Luận văn 144 trang).
  * Viết Chương 1 (Mục 1.1 - 1.5): Bối cảnh quản lý công việc cá nhân bị phân mảnh, nghịch lý quá tải; mục tiêu đề tài; phạm vi Giai đoạn 1.
* **Member B**:
  * Cung cấp bảng so sánh kỹ thuật cho Chương 2: Khảo sát 3 giải pháp hiện nay (*Google Calendar*, *Notion*, *Motion/Reclaim.ai*).
  * Lập Table 2.1: Bảng so sánh tính năng (Tự động xếp lịch, Xử lý ràng buộc phụ thuộc DAG, Bảo vệ phiên khóa, Tối ưu xáo trộn tối thiểu).
* **Member A**:
  * Rà soát yêu cầu nghiệp vụ và viết phần 1.5.1 Target Users and Roles.

### NGÀY 2: CHƯƠNG 3 - CƠ SỞ LÝ THUYẾT TOÁN HỌC & CÔNG NGHỆ NỀN TẢNG
* **Member B**:
  * Viết Mục 3.1: Cơ sở giải thuật & Toán học:
    * Lý thuyết Đồ thị có hướng không chu trình (DAG) cho phụ thuộc Finish-to-Start.
    * Thuật toán sắp xếp Topo của Kahn kết hợp Hàng đợi ưu tiên chèn nhị phân O(V log V + E).
    * Đại số khoảng thời gian (Interval Algebra): Phép hợp khoảng bận, Phép đệm 15m trước/sau, Phép trừ khoảng trống khả dụng.
    * Nguyên lý ổn định lịch trình và bài toán Invariants (INV-01 đến INV-04).
* **Member A**:
  * Viết Mục 3.2.1: NestJS Framework, Prisma ORM, PostgreSQL (Transaction, Khóa bi quan SELECT ... FOR UPDATE).
* **Member C**:
  * Viết Mục 3.2.2: React 19, FullCalendar Engine, Tailwind CSS v4.

### NGÀY 3: CHƯƠNG 4 - ĐẶC TẢ YÊU CẦU PHẦN MỀM (SYSTEM REQUIREMENTS)
* **Member C**:
  * Viết Mục 4.1.1 & 4.1.2: User Stories cho Phân hệ Quản lý tài khoản và Phân hệ Quản lý Task & Dự án.
  * Viết Mục 4.2.3: Yêu cầu phi chức năng về Trải nghiệm người dùng (UI Responsiveness, Thao tác dưới 3 click).
* **Member B**:
  * Viết Mục 4.1.4: User Stories cho Phân hệ Lập lịch thông minh & Tái lập lịch (Auto-Schedule, Deadline Risk, Session Locking).
  * Viết Mục 4.2.4 & 4.2.5: Yêu cầu hiệu năng (Thời gian chạy thuật toán < 5ms, Không trôi múi giờ UTC+7).
* **Member A**:
  * Viết Mục 4.1.3: User Stories cho Phân hệ Sự kiện Lịch & Giờ làm việc (Giờ làm việc tuần, Lịch bận, Sự kiện lặp RRULE).
  * Viết Mục 4.2.1 & 4.2.2: Ràng buộc Toàn vẹn dữ liệu (Data Integrity, Khóa ngoại kép, Chống SQL Injection, Bảo mật JWT).

### NGÀY 4: TRỌNG TÂM CHƯƠNG 5 (PHẦN 1) - USE CASES & THIẾT KẾ CƠ SỞ DỮ LIỆU
* **Member C**:
  * Vẽ Figure 5.1.1: Sơ đồ Use Case Tổng thể hệ thống.
  * Vẽ Figure 5.1.2: Use Case Diagram Phân hệ Quản lý Task & Dự án.
  * Soạn Table 5.1.1 - 5.1.4: Bảng mô tả Use Case chi tiết cho Task và Khóa phiên.
* **Member B**:
  * Vẽ Figure 5.1.3: Use Case Diagram Phân hệ Lập lịch & Tái lập lịch.
  * Soạn Table 5.1.5 - 5.1.7: Bảng mô tả Use Case cho Auto-Schedule, Reschedule on Event Collision, Lock/Unlock Session.
* **Member A**:
  * Vẽ Figure 5.3.1 (Conceptual ERD): 11 thực thể từ schema.prisma.
  * Vẽ Figure 5.3.2 (Relational Model Schema): Bảng chi tiết từng thuộc tính, kiểu dữ liệu, PK, FK và Composite Constraints.
  * Viết thuyết minh 5.3.1 & 5.3.2: Chuẩn hóa 3NF và quy tắc ánh xạ ERD sang bảng quan hệ.

### NGÀY 5: TRỌNG TÂM CHƯƠNG 5 (PHẦN 2) - ACTIVITY DIAGRAMS & KIẾN TRÚC 4+1 VIEW
* **Member A**:
  * Vẽ Figure 5.4.1: Activity Diagram luồng Tạo Task và kiểm tra phụ thuộc chu trình DAG (Pessimistic Locking).
  * Vẽ Figure 5.5.2: Backend Class Diagram (Controllers -> Services -> Repositories).
  * Vẽ Figure 5.5.4: Deployment Diagram (Client React -> API Gateway NestJS -> PostgreSQL Container).
* **Member B**:
  * Vẽ Figure 5.4.2: Activity Diagram luồng Đường ống Lập lịch tự động 8 bước.
  * Vẽ Figure 5.4.3: Activity Diagram luồng Tái lập lịch xáo trộn tối thiểu (Minimum Disruption).
  * Vẽ Figure 5.5.3: Engine Architecture Class Diagram (Ranking, Interval, Allocator, Rescheduler, Validator).
* **Member C**:
  * Vẽ Figure 5.4.4: Activity Diagram luồng Tương tác Khóa/Mở khóa phiên trên Lịch.
  * Vẽ Figure 5.5.1: Sơ đồ kiến trúc tổng thể 3 tầng (Modular Monolith).

### NGÀY 6: CHƯƠNG 6 (HIỆN THỰC HÓA) & CHƯƠNG 7 (KIỂM THỬ PHẦN MỀM HỘP ĐEN)
* **Member C**:
  * Viết Chương 6.2 (Frontend Implementation): Chụp ảnh màn hình giao diện thật (TaskList, FullCalendar, Popover chi tiết phiên).
  * Viết Mục 7.4.3 (Frontend UI Test Cases): Bảng kiểm thử hộp đen điều hướng lịch và tương tác khóa phiên (UI-CAL-01 đến UI-CAL-10).
* **Member B**:
  * Viết Chương 6.1.2 (Scheduling Core Implementation): Bóc tách mã nguồn hàm schedule(), thuật toán Kahn trong ranking.ts, và rescheduling.ts.
  * Viết Mục 7.4.1 (Algorithm Testing): Bảng ECP & BVA cho thời lượng phiên (30m - 120m), Bảng quyết định (Decision Table) cho xung đột lịch, và bảng 14 Test Cases Vitest (SCHED-01 đến SCHED-14) - 100% Pass.
* **Member A**:
  * Viết Chương 6.1.1 (Backend Implementation): Bóc tách mã nguồn SchedulerService, TasksService, và các route REST API.
  * Viết Mục 7.4.2 (Backend E2E Testing): Bảng 38 Test Cases kiểm thử tích hợp (AUTH-01, TASK-01 đến 10, SCHED-API-01 đến 11) - 100% Pass.

### NGÀY 7: CHƯƠNG 8 (KẾT LUẬN & KẾ HOẠCH GĐ2) & HOÀN THIỆN XUẤT BẢN BÁO CÁO
* **Member B**:
  * Viết Chương 8: Conclusion & Future Work: Đúc kết kết quả GĐ1 và lập lộ trình Giai đoạn 2 (Đồ án tốt nghiệp: Google Calendar Sync, Focus Score, Mobile App).
* **Member A & Member C**:
  * Rà soát định dạng, đánh số trang, kiểm tra số thứ tự hình vẽ, bảng biểu và chuẩn hóa tài liệu tham khảo.
  * Xuất file PDF báo cáo đồ án chính thức nộp Hội đồng.

---

## 📑 PHẦN 2: DÀN Ý CHI TIẾT 8 CHƯƠNG BÁO CÁO (BÓC TÁCH TỪ CODE THỰC TẾ)

| Chương & Mục | Người viết | Nội dung bóc tách từ Git | File code & Minh chứng đối chiếu |
| :--- | :---: | :--- | :--- |
| **1. Introduction** | Member C | Bối cảnh quản lý công việc, nghịch lý kiệt sức, 4 mục tiêu, phạm vi Giai đoạn 1 | `docs/ARCHITECTURE.md` |
| **2. Related Works** | Member C & B | Khảo sát Google Calendar, Notion, Motion/Reclaim; Bảng đối chiếu 4 hệ thống | Table 2.1: Feature Comparison Matrix |
| **3. Theoretical Basis** | Member B & A | Toán học DAG, Kahn O(V log V + E), Phép toán khoảng bận; NestJS, Prisma, React | `packages/scheduling-engine/src/core/ranking.ts`<br>`backend/prisma/schema.prisma` |
| **4. System Requirements** | C, B, A | User Stories 4 phân hệ (Auth, Task, Calendar, Scheduler); Ràng buộc phi chức năng | `src/types/domain.ts`<br>`contracts/scheduler-contract.ts` |
| **5. Analysis & Design** | Cả 3 người | Use Cases (15 bảng), Conceptual ERD (11 bảng), Relational Model 3NF, 4 Activity Diagrams, Class Diagrams, Deployment 4+1 | Figure 5.1.1 -> 5.5.4 |
| **6. Implementation** | Cả 3 người | Bóc tách SchedulerService, Engine Allocator/Rescheduling, FullCalendar UI (kèm ảnh chụp) | `backend/src/scheduler/scheduler.service.ts`<br>`src/views/Calendar.tsx` |
| **7. Software Testing** | Member B & A | Kiểm thử hộp đen ECP, BVA, Decision Table; 14 test Vitest (B) + 38 test NestJS E2E (A) | `packages/scheduling-engine/test/scheduler.test.ts`<br>`backend/test/scheduler.e2e-spec.ts` |
| **8. Conclusion & Plan** | Member B | Tổng kết thành tựu GĐ1 và Bảng kế hoạch chi tiết cho Giai đoạn 2 (ĐATN) | Roadmap Tuần 9 -> Tuần 16 |
