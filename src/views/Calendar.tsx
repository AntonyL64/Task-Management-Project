import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Sparkles, RotateCcw, AlertTriangle, CalendarClock, X } from 'lucide-react';
import { mockTasks } from '../lib/mockData';
import {
  mockRunScheduler,
  getStoredScheduleResult,
  setStoredScheduleResult,
  subscribeScheduleChanges,
  type ScheduleResult,
} from '../lib/mockScheduler';
import type { WorkSession } from '../types/domain';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type BlockType = 'event' | 'session' | 'locked';

type CalendarBlock = {
  id: string;
  day: number; // 0 = Mon ... 6 = Sun, matches weekDays index
  startHour: number; // 24h, may include .5 for half hours
  endHour: number;
  title: string;
  meta: string;
  type: BlockType;
};

const weekDays = [
  { label: 'MON', date: 21 },
  { label: 'TUE', date: 22 },
  { label: 'WED', date: 23 },
  { label: 'THU', date: 24 },
  { label: 'FRI', date: 25 },
  { label: 'SAT', date: 26 },
  { label: 'SUN', date: 27 },
];

const TODAY_INDEX = 1; // Tuesday (Sep 22, 2026)
const CURRENT_TIME_HOUR = 8.0; // 8:00 AM (matches mockNow)

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_HEIGHT = 64; // px per hour row

// Fixed baseline calendar events
const BASELINE_FIXED_EVENTS: CalendarBlock[] = [
  { id: 'b1', day: 0, startHour: 8.5, endHour: 9.5, title: 'Team Meeting', meta: '8:30–9:30 AM', type: 'event' },
  { id: 'b3', day: 1, startHour: 9, endHour: 10, title: 'Project Sync', meta: '9:00–10:00 AM', type: 'event' },
  { id: 'b5', day: 1, startHour: 14.5, endHour: 15.5, title: 'Design Review', meta: '2:30–3:30 PM', type: 'event' },
  { id: 'b7', day: 2, startHour: 13.5, endHour: 14.5, title: 'Client Check-in', meta: '1:30–2:30 PM', type: 'event' },
  { id: 'b6', day: 2, startHour: 9.5, endHour: 11, title: 'Review landing page copy (Locked)', meta: '9:30–11:00 AM', type: 'locked' },
];

function sessionToBlock(s: WorkSession, baseMonday = '2026-09-21'): CalendarBlock | null {
  const startDate = new Date(s.start);
  const endDate = new Date(s.end);
  const baseDate = new Date(`${baseMonday}T00:00:00Z`);

  const day = Math.floor((startDate.getTime() - baseDate.getTime()) / (24 * 3600 * 1000));
  if (day < 0 || day > 6) return null;

  const startHour = startDate.getUTCHours() + startDate.getUTCMinutes() / 60;
  const endHour = endDate.getUTCHours() + endDate.getUTCMinutes() / 60;

  const fmt = (d: Date) => {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return {
    id: s.id,
    day,
    startHour,
    endHour,
    title: s.taskTitle,
    meta: `${fmt(startDate)}–${fmt(endDate)}`,
    type: s.isLocked ? 'locked' : 'session',
  };
}

const blockStyles: Record<BlockType, string> = {
  event: 'bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-sm',
  session: 'bg-indigo-50 border border-indigo-200 text-indigo-800 shadow-sm',
  locked: 'bg-amber-50 border border-amber-300 text-amber-900 shadow-sm',
};

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Fixed Event
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Planned Session
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Locked Session
      </span>
    </div>
  );
}

function HourGutter() {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  return (
    <div className="flex flex-col text-right pr-3" style={{ paddingTop: HOUR_HEIGHT / 2 }}>
      {hours.map((h) => (
        <div key={h} style={{ height: HOUR_HEIGHT }} className="text-xs text-gray-400 -mt-2 font-mono">
          {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
        </div>
      ))}
    </div>
  );
}

function Block({ block }: { block: CalendarBlock }) {
  const top = (block.startHour - HOUR_START) * HOUR_HEIGHT;
  const height = (block.endHour - block.startHour) * HOUR_HEIGHT;
  return (
    <div
      className={cn('absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden text-xs leading-tight transition-all hover:ring-2 hover:ring-indigo-400 z-10', blockStyles[block.type])}
      style={{ top, height }}
      title={`${block.title} (${block.meta})`}
    >
      <div className="flex items-center gap-1 font-semibold truncate">
        {block.type === 'locked' && <span aria-hidden="true">🔒</span>}
        <span className="truncate">{block.title}</span>
      </div>
      <div className="text-[11px] opacity-90 truncate font-mono mt-0.5">{block.meta}</div>
    </div>
  );
}

function WeekGrid({ blocks }: { blocks: CalendarBlock[] }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const nowTop = (CURRENT_TIME_HOUR - HOUR_START) * HOUR_HEIGHT;

  return (
    <div className="flex">
      <div className="w-16 flex-shrink-0">
        <div className="h-10" />
        <HourGutter />
      </div>
      <div className="flex-1 grid grid-cols-7 border-l border-gray-200">
        {weekDays.map((day, dayIdx) => {
          const isToday = dayIdx === TODAY_INDEX;
          const isWeekend = dayIdx >= 5;
          return (
            <div
              key={day.label}
              className={cn(
                'relative border-r border-gray-200',
                isToday ? 'bg-indigo-50/20' : isWeekend ? 'bg-gray-50/50' : 'bg-white'
              )}
            >
              <div className={cn('h-10 flex flex-col items-center justify-center border-b border-gray-200', isToday && 'bg-indigo-50/60 font-semibold')}>
                <span className="text-[11px] text-gray-500 tracking-wide">{day.label}</span>
                <span className={cn('text-sm', isToday ? 'font-bold text-indigo-700' : 'text-gray-800')}>{day.date}</span>
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div key={h} className="border-b border-gray-100" style={{ height: HOUR_HEIGHT, position: 'absolute', top: i * HOUR_HEIGHT, left: 0, right: 0 }} />
                ))}
                {isToday && (
                  <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none" style={{ top: nowTop }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow" />
                    <span className="flex-1 h-0.5 bg-rose-500" />
                  </div>
                )}
                {blocks.filter((b) => b.day === dayIdx).map((b) => (
                  <Block key={b.id} block={b} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar() {
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(getStoredScheduleResult());
  const [isScheduling, setIsScheduling] = useState(false);
  const [isWarningsModalOpen, setIsWarningsModalOpen] = useState(false);

  useEffect(() => {
    return subscribeScheduleChanges(() => {
      setScheduleResult(getStoredScheduleResult());
    });
  }, []);

  const handleRunAutoSchedule = async () => {
    setIsScheduling(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Call Member B's real scheduling engine with mockTasks
      const result = mockRunScheduler(mockTasks);
      setScheduleResult(result);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleResetSchedule = () => {
    setStoredScheduleResult(null);
    setScheduleResult(null);
  };

  // Compute active calendar blocks
  const activeBlocks: CalendarBlock[] = [...BASELINE_FIXED_EVENTS];

  if (scheduleResult && scheduleResult.plannedSessions.length > 0) {
    for (const session of scheduleResult.plannedSessions) {
      const blk = sessionToBlock(session);
      if (blk) {
        // avoid duplicating the locked block already in baseline
        if (!activeBlocks.some((b) => b.id === blk.id)) {
          activeBlocks.push(blk);
        }
      }
    }
  }

  const plannedCount = scheduleResult ? scheduleResult.plannedSessions.length : 0;
  const warningCount = scheduleResult ? scheduleResult.warnings.length : 0;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Calendar Header with Auto Schedule Button */}
      <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAutoSchedule}
              disabled={isScheduling}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isScheduling ? <CalendarClock className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isScheduling ? 'Scheduling...' : 'Auto Schedule'}
            </button>
            {scheduleResult && (
              <button
                onClick={handleResetSchedule}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                title="Reset to default fixed events"
              >
                <RotateCcw className="h-4 w-4 text-gray-500" />
                Reset
              </button>
            )}
          </div>

          {scheduleResult && (
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              <span>✅ {plannedCount} sessions planned by Engine</span>
              {warningCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsWarningsModalOpen(true)}
                  className="flex items-center gap-1.5 text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-colors shadow-xs ml-1"
                  title="Nhấn để xem chi tiết lý do cảnh báo"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                  <span>{warningCount} warnings</span>
                  <span className="text-[11px] underline text-amber-700 font-medium">(Chi tiết)</span>
                </button>
              )}
            </div>
          )}
        </div>

        <Legend />
      </div>

      <div className="flex-1 overflow-auto">
        <WeekGrid blocks={activeBlocks} />
      </div>

      {/* Warnings Detail Modal */}
      {isWarningsModalOpen && scheduleResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsWarningsModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-warnings-title"
            className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
          >
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="calendar-warnings-title" className="text-base font-bold text-gray-900">
                    Chi tiết Cảnh báo Lập lịch (Schedule Warnings)
                  </h2>
                  <p className="text-xs text-gray-600">
                    Lý do thuật toán phát hiện rủi ro hoặc không xếp hết toàn bộ thời gian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWarningsModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="max-h-[60vh] space-y-3.5 overflow-y-auto p-5">
              {scheduleResult.warnings.map((warning, index) => {
                const missingMinutes = warning.metadata?.missingMinutes;
                const requiredMinutes = warning.metadata?.requiredMinutes;
                const scheduledMinutes = warning.metadata?.scheduledMinutes;

                return (
                  <article
                    key={`${warning.taskId}-${warning.code}-${index}`}
                    className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        📌 {warning.taskTitle || warning.taskId}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900">
                        {warning.code.replaceAll('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed font-medium">
                      {warning.message || (
                        warning.code === 'DEADLINE_RISK'
                          ? `Không đủ thời gian trống trước hạn chót. Cần ${requiredMinutes ?? 0}m, nhưng chỉ xếp được ${scheduledMinutes ?? 0}m (Thiếu ${missingMinutes ?? 0} phút).`
                          : warning.code === 'PARTIALLY_SCHEDULED'
                          ? `Task chỉ được xếp một phần thời lượng, còn lại ${missingMinutes ?? 0} phút chưa xếp được.`
                          : warning.code === 'DEPENDENCY_BLOCKED'
                          ? `Bị chặn vì task tiên quyết chưa hoàn thành.`
                          : 'Cần kiểm tra lại các ràng buộc của task.'
                      )}
                    </p>

                    <div className="rounded-lg bg-white/90 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-1.5">
                      <span className="font-bold shrink-0">💡 Gợi ý xử lý:</span>
                      <span>
                        {warning.code === 'DEADLINE_RISK'
                          ? 'Hãy dời hạn chót (deadline) của task này sang ngày hôm sau, hoặc giải phóng bớt các cuộc họp cố định để mở thêm khung giờ trống.'
                          : warning.code === 'PARTIALLY_SCHEDULED'
                          ? 'Tăng giờ làm việc tối đa trong ngày (dailyMaxMinutes) hoặc mở rộng thời gian lập lịch.'
                          : 'Hoàn thành các task tiên quyết trước khi lập lịch cho task này.'}
                      </span>
                    </div>
                  </article>
                );
              })}

              {scheduleResult.unscheduledTasks.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-700">
                    Phần công việc chưa thể xếp ({scheduleResult.unscheduledTasks.length} task)
                  </h3>
                  <div className="space-y-1.5">
                    {scheduleResult.unscheduledTasks.map((item) => (
                      <div
                        key={item.taskId}
                        className="flex items-center justify-between text-xs rounded-lg bg-gray-50 border border-gray-200 px-3 py-2"
                      >
                        <span className="font-medium text-gray-800">{item.taskTitle}</span>
                        <span className="font-semibold text-rose-600 tabular-nums">
                          Còn thiếu: {item.remainingMinutes} phút
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="flex justify-end border-t border-gray-100 px-5 py-3.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setIsWarningsModalOpen(false)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
