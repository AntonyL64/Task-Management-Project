import { mockTasks, getTaskById } from '../lib/mockData';
import type { Status } from '../lib/mockData';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const ROW_HEIGHT = 56;
const DAY_WIDTH = 60;
const CHART_START_DATE = new Date(2026, 8, 20); // Sep 20, 2026 (month is 0-indexed)
const TOTAL_DAYS = 14;

function getChartDays() {
  return Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const date = new Date(CHART_START_DATE);
    date.setDate(date.getDate() + i);
    return date;
  });
}

// Mock start offset (days from CHART_START_DAY) + duration per task, so the
// chart and the dependency arrow are derived from one source of truth
// instead of per-task hardcoded pixel positions.
const taskSchedule: Record<string, { startOffset: number; duration: number }> = {
  t1: { startOffset: 1, duration: 4 },
  t2: { startOffset: 5, duration: 2 },
  t3: { startOffset: 6, duration: 3 },
  t4: { startOffset: 2, duration: 5 },
  t5: { startOffset: 6, duration: 4 }, // depends on t1
  t6: { startOffset: 9, duration: 3 },
  t7: { startOffset: 10, duration: 3 },
  t8: { startOffset: 8, duration: 4 },
};

const statusBarClass: Record<Status, string> = {
  Done: 'bg-success-500',
  'In Progress': 'bg-primary-500',
  'At Risk': 'bg-warning-500',
  'To Do': 'bg-gray-300',
};

function Legend() {
  const items: { label: string; swatch: string }[] = [
    { label: 'Done', swatch: 'bg-success-500' },
    { label: 'In Progress', swatch: 'bg-primary-500' },
    { label: 'At Risk', swatch: 'bg-warning-500' },
    { label: 'Not Started', swatch: 'bg-gray-300' },
  ];
  return (
    <div className="flex flex-col gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
      <span className="text-[10px] font-semibold text-muted-500 uppercase tracking-wider">Status</span>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2 text-xs text-muted-600">
          <span className={cn('w-2 h-2 rounded-full', item.swatch)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function Gantt() {
  const days = getChartDays();

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div>
          <h2 className="text-lg font-semibold text-text">Product launch plan</h2>
          <p className="text-xs text-muted-500 mt-0.5">September 20 – October 3, 2026</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button className="px-3 py-1.5 text-sm font-medium rounded-md text-muted-600 hover:text-text">Today</button>
            <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-text shadow-sm">Weeks</button>
          </div>
          <Legend />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex">
        <div className="w-[260px] flex-shrink-0 border-r border-gray-200 bg-white z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
          <div className="h-12 border-b border-gray-200 flex items-center px-4 bg-gray-50/80">
            <span className="text-xs font-semibold text-muted-500 uppercase tracking-wider">Task</span>
          </div>
          <div className="flex flex-col">
            {mockTasks.map((task) => (
              <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-gray-100 flex items-center px-4 hover:bg-gray-50">
                <div className="flex flex-col gap-1 w-full">
                  <span className={cn('text-sm font-medium truncate', task.isCompleted ? 'text-gray-400 line-through' : 'text-text')}>
                    {task.name}
                  </span>
                  <span className={task.project.badgeClass + ' w-max'}>{task.project.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[800px] overflow-x-auto relative">
          <div className="h-12 border-b border-gray-200 flex bg-gray-50/80 sticky top-0 z-10 w-max min-w-full">
            {days.map((date) => (
              <div key={date.toISOString()} style={{ width: DAY_WIDTH }} className="flex-shrink-0 border-r border-gray-200 flex flex-col items-center justify-center">
                <span className="text-[10px] text-muted-500 font-medium uppercase">
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </span>
                <span className="text-xs font-semibold text-text">{date.getDate()}</span>
              </div>
            ))}
          </div>

          <div className="relative w-max min-w-full">
            <div className="absolute inset-0 flex pointer-events-none">
              {days.map((date) => (
                <div key={date.toISOString()} style={{ width: DAY_WIDTH }} className="flex-shrink-0 border-r border-gray-100/70 h-full" />
              ))}
            </div>

            <div className="flex flex-col relative z-10">
              {mockTasks.map((task) => {
                const schedule = taskSchedule[task.id];
                const left = schedule.startOffset * DAY_WIDTH;
                const width = schedule.duration * DAY_WIDTH;
                const dependency = task.dependsOn ? getTaskById(task.dependsOn) : undefined;
                const depSchedule = task.dependsOn ? taskSchedule[task.dependsOn] : undefined;

                return (
                  <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-gray-100 flex items-center relative group">
                    {dependency && depSchedule && (
                      <svg
                        className="absolute pointer-events-none"
                        style={{
                          left: (depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4,
                          top: -ROW_HEIGHT / 2,
                          width: left - ((depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4) + 4,
                          height: ROW_HEIGHT,
                        }}
                      >
                        <path
                          d={`M 0 4 L 4 4 L ${Math.max(4, left - ((depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4))} ${ROW_HEIGHT / 2 + 4}`}
                          fill="none"
                          stroke="var(--color-muted-500)"
                          strokeWidth="1.5"
                          markerEnd="url(#arrow)"
                        />
                        <defs>
                          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-muted-500)" />
                          </marker>
                        </defs>
                      </svg>
                    )}
                    <div
                      title={dependency ? `Depends on: ${dependency.name}` : undefined}
                      className={cn(
                        'absolute h-6 rounded-full flex items-center px-3 cursor-pointer hover:brightness-110 transition-all',
                        statusBarClass[task.status],
                        task.isCompleted && 'opacity-60'
                      )}
                      style={{ left, width }}
                    >
                      <span className="text-white text-[10px] font-medium truncate relative z-10">
                        {task.progress > 0 ? `${task.progress}%` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
