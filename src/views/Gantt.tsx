import { mockTasks, getProjectById } from '../lib/mockData';
import type { TaskStatus } from '../types/domain';
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

const taskSchedule: Record<string, { startOffset: number; duration: number }> = {
  t1: { startOffset: 1, duration: 4 },
  t2: { startOffset: 5, duration: 2 },
  t3: { startOffset: 6, duration: 3 },
  t4: { startOffset: 2, duration: 5 },
  t5: { startOffset: 6, duration: 4 },
  t6: { startOffset: 9, duration: 3 },
  t7: { startOffset: 10, duration: 3 },
  t8: { startOffset: 8, duration: 4 },
};

const statusBarClass: Record<TaskStatus, string> = {
  DONE: 'bg-emerald-500',
  IN_PROGRESS: 'bg-indigo-500',
  TODO: 'bg-gray-400',
  PAUSED: 'bg-amber-500',
  CANCELLED: 'bg-rose-500',
};

export default function Gantt() {
  const days = getChartDays();

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Timeline & Dependencies</h2>
          <p className="text-xs text-muted-500 mt-0.5">Finish-to-Start dependency mapping across a 14-day window</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[260px] flex-shrink-0 border-r border-gray-200 bg-white z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
          <div className="h-12 border-b border-gray-200 flex items-center px-4 bg-gray-50/80">
            <span className="text-xs font-semibold text-muted-500 uppercase tracking-wider">Task</span>
          </div>
          <div className="flex flex-col">
            {mockTasks.map((task) => {
              const project = getProjectById(task.projectId);
              return (
                <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-gray-100 flex items-center px-4 hover:bg-gray-50">
                  <div className="flex flex-col gap-1 w-full overflow-hidden">
                    <span className={cn('text-sm font-medium truncate', task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-text')}>
                      {task.title}
                    </span>
                    {project && (
                      <span className="text-[10px] font-medium w-fit px-1.5 py-0.5 rounded" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                        {project.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
                const schedule = taskSchedule[task.id] || { startOffset: 0, duration: 2 };
                const left = schedule.startOffset * DAY_WIDTH;
                const width = schedule.duration * DAY_WIDTH;
                const depId = task.dependencyIds?.[0];
                const depSchedule = depId ? taskSchedule[depId] : undefined;
                const progress = task.estimatedMinutes > 0 ? Math.round(((task.estimatedMinutes - task.remainingMinutes) / task.estimatedMinutes) * 100) : 0;

                return (
                  <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-gray-100 flex items-center relative group">
                    {depId && depSchedule && (
                      <svg
                        className="absolute pointer-events-none"
                        style={{
                          left: (depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4,
                          top: -ROW_HEIGHT / 2,
                          width: Math.max(10, left - ((depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4) + 4),
                          height: ROW_HEIGHT,
                        }}
                      >
                        <path
                          d={`M 0 4 L 4 4 L ${Math.max(4, left - ((depSchedule.startOffset + depSchedule.duration) * DAY_WIDTH - 4))} ${ROW_HEIGHT / 2 + 4}`}
                          fill="none"
                          stroke="var(--color-muted-500, #9ca3af)"
                          strokeWidth="1.5"
                          markerEnd="url(#arrow)"
                        />
                        <defs>
                          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-muted-500, #9ca3af)" />
                          </marker>
                        </defs>
                      </svg>
                    )}
                    <div
                      title={depId ? `Depends on: ${depId}` : undefined}
                      className={cn(
                        'absolute h-6 rounded-full flex items-center px-3 cursor-pointer hover:brightness-110 transition-all',
                        statusBarClass[task.status] || 'bg-gray-400',
                        task.status === 'DONE' && 'opacity-60'
                      )}
                      style={{ left, width }}
                    >
                      <span className="text-white text-[10px] font-medium truncate relative z-10">
                        {progress > 0 ? `${progress}%` : ''}
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
