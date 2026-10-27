import { schedule } from './src/scheduler.js';
import type { ScheduleInput } from './src/contracts/scheduler-contract.js';

/**
 * =========================================================================
 * 🛠️ BÀI TEST TÙY BIẾN CỦA BẠN (CUSTOM SCHEDULE PLAYGROUND)
 * Bạn có thể tự do thêm bớt Task, cuộc họp (Busy), hoặc giờ làm việc ở đây.
 * Chạy lệnh: npm run my-test  (hoặc npx tsx test-my-schedule.ts)
 * =========================================================================
 */

const myInput: ScheduleInput = {
  // 1. Thời điểm hiện tại giả định (Bắt đầu từ 8:00 sáng Thứ Hai)
  now: '2026-10-26T08:00:00Z',

  // 2. Cài đặt thuật toán
  settings: {
    planningHorizonDays: 5,   // Xếp lịch trong vòng 5 ngày tới
    minSessionMinutes: 30,     // Phiên làm việc tối thiểu 30 phút
    maxSessionMinutes: 120,    // Phiên làm việc tối đa 120 phút (tránh kiệt sức)
    bufferMinutes: 15,         // Nghỉ 15 phút trước và sau mỗi cuộc họp
    dailyMaxMinutes: 360,      // Làm tối đa 6 tiếng/ngày (360 phút)
  },

  // 3. Khung giờ làm việc mỗi ngày (Thứ 2 đến Thứ 6: 08:30 - 17:30)
  workingHours: [
    { dayOfWeek: 1, startTime: '08:30', endTime: '17:30' },
    { dayOfWeek: 2, startTime: '08:30', endTime: '17:30' },
    { dayOfWeek: 3, startTime: '08:30', endTime: '17:30' },
    { dayOfWeek: 4, startTime: '08:30', endTime: '17:30' },
    { dayOfWeek: 5, startTime: '08:30', endTime: '17:30' },
  ],

  // 4. Các lịch bận cố định (Lịch học, họp nhóm, đi ăn...)
  busyIntervals: [
    {
      id: 'meeting-group',
      title: 'Họp nhóm Đồ án HK261',
      start: '2026-10-26T09:30:00Z',
      end: '2026-10-26T11:00:00Z',
      isHardBusy: true,
    },
    {
      id: 'class-math',
      title: 'Học môn Xác suất Thống kê',
      start: '2026-10-27T14:00:00Z',
      end: '2026-10-27T16:30:00Z',
      isHardBusy: true,
    },
  ],

  // 5. Phiên làm việc đã chốt cứng (nếu có)
  lockedSessions: [
    {
      id: 'locked-reading',
      taskId: 'TASK-READ',
      start: '2026-10-26T14:00:00Z',
      end: '2026-10-26T15:00:00Z',
    },
  ],

  // 6. DANH SÁCH TASK CỦA BẠN (TỰ DO THÊM/SỬA TASK TẠI ĐÂY)
  tasks: [
    {
      id: 'TASK-READ',
      title: 'Đọc tài liệu Contract v2',
      estimatedMinutes: 60,
      remainingMinutes: 60,
      priority: 'MEDIUM',
      deadline: '2026-10-27T17:00:00Z',
      dependencyIds: [],
    },
    {
      id: 'TASK-CODE-1',
      title: 'Code thuật toán Lập lịch',
      estimatedMinutes: 180, // 3 tiếng -> Thuật toán sẽ tự xé nhỏ thành các session <= 120m
      remainingMinutes: 180,
      priority: 'HIGH',
      deadline: '2026-10-28T17:00:00Z',
      dependencyIds: ['TASK-READ'], // Phụ thuộc vào TASK-READ
    },
    {
      id: 'TASK-TEST',
      title: 'Viết Unit Test Vitest',
      estimatedMinutes: 90,
      remainingMinutes: 90,
      priority: 'URGENT',
      deadline: '2026-10-29T12:00:00Z',
      dependencyIds: ['TASK-CODE-1'], // Phải code xong mới test được
    },
    {
      id: 'TASK-REPORT',
      title: 'Viết báo cáo nộp Thầy',
      estimatedMinutes: 120,
      remainingMinutes: 120,
      priority: 'LOW',
      deadline: '2026-10-30T17:00:00Z',
      dependencyIds: ['TASK-TEST'],
    },
  ],
};

console.log('='.repeat(70));
console.log(' BẮT ĐẦU CHẠY THỬ THUẬT TOÁN VỚI LỊCH MỚI CỦA BẠN');
console.log('='.repeat(70));
console.log(` Số lượng Task: ${myInput.tasks.length}`);
console.log(` Số lịch bận cố định: ${myInput.busyIntervals.length}`);
console.log(` Số phiên khóa: ${myInput.lockedSessions.length}`);

const startTime = performance.now();
const result = schedule(myInput);
const duration = (performance.now() - startTime).toFixed(2);

console.log(`\n Thuật toán tính toán xong trong: ${duration} ms`);
console.log(`Tổng số phiên làm việc được xếp: ${result.plannedSessions.length}`);

console.log('\n BẢNG KẾT QUẢ PHÂN BỔ LỊCH LÀM VIỆC:');
console.table(
  result.plannedSessions.map((s) => ({
    'Task ID': s.taskId,
    'Bắt đầu': s.start.replace('T', ' ').replace('Z', ' UTC'),
    'Kết thúc': s.end.replace('T', ' ').replace('Z', ' UTC'),
    'Thời lượng': `${s.durationMinutes} phút`,
    'Khóa cố định': s.isLocked ? '🔒 CÓ' : 'KHÔNG',
  }))
);

if (result.unscheduledTasks.length > 0) {
  console.log('\n CÁC TASK KHÔNG THỂ XẾP HẾT:');
  console.table(result.unscheduledTasks);
}

if (result.warnings.length > 0) {
  console.log('\n CÁC CẢNH BÁO THÔNG MINH:');
  result.warnings.forEach((w) => console.log(` - [${w.code}] ${w.message}`));
}

console.log('\n Thuật toán hoạt động hoàn hảo và độc lập mà không cần Database!');
console.log('='.repeat(70));
