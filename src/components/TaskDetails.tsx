import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Clock3, Link2, Trash2, X, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import type { MockTask } from '../lib/mockData';
import type { Project, ScheduleWarning, TaskStatus } from '../types/domain';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type TaskDetailsProps = {
  task: MockTask;
  tasks: MockTask[];
  project?: Project;
  warning?: ScheduleWarning;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress', PAUSED: 'Paused', DONE: 'Done', CANCELLED: 'Cancelled',
};

function formatDate(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TaskDetails({ task, tasks, project, warning, onClose, onStatusChange, onDelete }: TaskDetailsProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const nextStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
  const missingMinutes = warning?.metadata.missingMinutes ?? Math.max(0, task.remainingMinutes - (warning?.metadata.scheduledMinutes ?? 0));

  return (
    <>
      <button aria-label="Close task details" onClick={onClose} className={cn('fixed inset-0 z-30 bg-black/20 transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} />
      <aside role="dialog" aria-modal="true" aria-labelledby="task-details-title" className={cn('fixed right-0 top-20 z-40 flex h-[calc(100vh-5rem)] w-full max-w-[420px] flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-5">
          <div className="flex min-w-0 items-center gap-2">
            {task.status === 'DONE' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-gray-400" />}
            <span className="truncate text-sm font-medium text-gray-600">{STATUS_LABEL[task.status]}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 p-6">
          <h2 id="task-details-title" className="mb-5 text-xl font-semibold leading-snug text-gray-900">{task.title}</h2>
          {warning?.code === 'DEADLINE_RISK' && (
            <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div><p className="text-sm font-semibold">Deadline at risk</p><p className="mt-1 text-sm">Insufficient free slots before deadline (Missing {missingMinutes} minutes)</p></div>
            </div>
          )}

          <dl className="space-y-5">
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="text-sm text-gray-500">Project</dt><dd>{project ? <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: project.color, backgroundColor: `${project.color}1A` }}>{project.name}</span> : <span className="text-sm text-gray-500">No project</span>}</dd></div>
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="text-sm text-gray-500">Priority</dt><dd className="text-sm font-medium text-gray-800">{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</dd></div>
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="flex items-start gap-2 text-sm text-gray-500"><Clock3 className="h-4 w-4" />Estimated time</dt><dd className="text-sm text-gray-800">{task.estimatedMinutes} min</dd></div>
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="flex items-start gap-2 text-sm text-gray-500"><Clock3 className="h-4 w-4" />Remaining time</dt><dd className="text-sm text-gray-800">{task.remainingMinutes} min</dd></div>
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="flex items-start gap-2 text-sm text-gray-500"><Calendar className="h-4 w-4" />Earliest start</dt><dd className="text-sm text-gray-800">{formatDate(task.earliestStart)}</dd></div>
            <div className="grid grid-cols-[125px_1fr] gap-3"><dt className="flex items-start gap-2 text-sm text-gray-500"><Calendar className="h-4 w-4" />Deadline</dt><dd className="text-sm text-gray-800">{formatDate(task.deadline)}</dd></div>
          </dl>

          {task.dependencyIds.length > 0 && <section className="mt-8"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><Link2 className="h-4 w-4" />Prerequisite Tasks</h3><ul className="space-y-2">{task.dependencyIds.map((id) => { const prerequisite = tasks.find((candidate) => candidate.id === id); return <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5"><span className="text-sm text-gray-700">{prerequisite?.title ?? `Task ${id}`}</span><span className={cn('shrink-0 rounded-full px-2 py-1 text-xs', prerequisite?.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{prerequisite ? STATUS_LABEL[prerequisite.status] : 'Unavailable'}</span></li>; })}</ul></section>}
        </div>

        <footer className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white p-5">
          <button type="button" onClick={() => onStatusChange(task.id, nextStatus)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700">{task.status === 'DONE' ? <PlayCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{task.status === 'DONE' ? 'Reopen task' : 'Mark done'}</button>
          <button type="button" onClick={() => { if (window.confirm(`Delete “${task.title}”?`)) onDelete(task.id); }} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Delete</span></button>
        </footer>
      </aside>
    </>
  );
}
