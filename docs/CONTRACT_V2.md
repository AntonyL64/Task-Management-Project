# Giao ước Dữ liệu (Scheduler Contract v2)

Tài liệu này dùng để thống nhất giữa **Thành viên A** (Backend/Database) và **Thành viên B** (Thuật toán Scheduler).

## 1. DTO Đầu vào: `ScheduleInput`
```typescript
interface ScheduleInput {
  now: string; // ISO 8601 (VD: "2026-10-19T07:00:00Z")
  settings: {
    planningHorizonDays: number; // Số ngày lập lịch (VD: 7 hoặc 14)
    minSessionMinutes: number;   // Độ dài phiên nhỏ nhất (VD: 30)
    maxSessionMinutes: number;   // Độ dài phiên lớn nhất (VD: 120)
    bufferMinutes: number;       // Thời gian đệm trước/sau sự kiện cố định (VD: 15)
    dailyMaxMinutes?: number;    // Giới hạn số phút làm việc tối đa trong ngày (VD: 480)
  };
  workingHours: Array<{
    dayOfWeek: number; // 0: Chủ nhật, 1: Thứ 2, ..., 6: Thứ 7
    startTime: string; // "HH:mm" (VD: "08:00")
    endTime: string;   // "HH:mm" (VD: "17:00")
  }>;
  busyIntervals: Array<{
    id: string;
    start: string; // ISO 8601
    end: string;   // ISO 8601
    type: 'CALENDAR_EVENT' | 'EXTERNAL_EVENT' | 'OTHER';
  }>;
  lockedSessions: Array<{
    id: string;
    taskId: string;
    start: string; // ISO 8601
    end: string;   // ISO 8601
  }>;
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    remainingMinutes: number; // Scheduler luôn dùng số này để xếp
    deadline: string | null;  // ISO 8601 hoặc null
    earliestStart?: string | null;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';
    dependencyIds: string[];  // Danh sách ID các task phải làm xong trước
    createdAt: string;        // ISO 8601 dùng làm tie-break
  }>;
}
```

## 2. DTO Đầu ra: `ScheduleResult`
```typescript
interface ScheduleResult {
  plannedSessions: Array<{
    id: string;
    taskId: string;
    start: string; // ISO 8601
    end: string;   // ISO 8601
    durationMinutes: number;
    locked: boolean;
  }>;
  unscheduledTasks: Array<{
    taskId: string;
    remainingMinutes: number;
    missingMinutes: number;
    reason: 'NO_AVAILABLE_SLOT' | 'DEADLINE_INFEASIBLE' | 'DEPENDENCY_NOT_READY' | 'OUTSIDE_PLANNING_HORIZON';
  }>;
  warnings: Array<{
    code: 'PARTIALLY_SCHEDULED' | 'DEADLINE_RISK' | 'DEPENDENCY_BLOCKED' | 'INVALID_TASK' | 'LOCKED_SESSION_CONFLICT';
    taskId?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
}
```
