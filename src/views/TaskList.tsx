import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Link2, Plus, Search, Sparkles, X } from 'lucide-react';
import { mockTasks, mockWarnings, projects } from '../lib/mockData';
import { mockRunScheduler, type ScheduleResult } from '../lib/mockScheduler';
import type { MockTask } from '../lib/mockData';
import type { ISODateString, Priority, Project, TaskInput, TaskStatus } from '../types/domain';
import TaskDetails from '../components/TaskDetails';
import CreateTaskModal from '../components/CreateTaskModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) { return twMerge(clsx(inputs)); }
const projectList: Project[] = Object.values(projects);
const projectById = new Map<string, Project>(projectList.map((project) => [project.id, project]));
const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700',
  MEDIUM: 'inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800',
  HIGH: 'inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800',
  URGENT: 'inline-flex rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white',
};
const STATUS_LABEL: Record<TaskStatus, string> = { TODO: 'To Do', IN_PROGRESS: 'In Progress', PAUSED: 'Paused', DONE: 'Done', CANCELLED: 'Cancelled' };
const STATUS_BADGE: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700', IN_PROGRESS: 'bg-blue-100 text-blue-700', PAUSED: 'bg-amber-100 text-amber-800', DONE: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-gray-100 text-gray-600',
};
type Filter = 'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE';
function formatDeadline(deadline: ISODateString | null): string {
  if (!deadline) return 'No deadline';
  const date = new Date(deadline);
  return Number.isNaN(date.getTime()) ? deadline : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function progressFor(task: TaskInput): number {
  if (task.status === 'DONE') return 100;
  if (task.estimatedMinutes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((task.estimatedMinutes - task.remainingMinutes) / task.estimatedMinutes) * 100)));
}

export default function TaskList() {
  const [tasks, setTasks] = useState<MockTask[]>(mockTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isWarningsOpen, setIsWarningsOpen] = useState(false);
  const navigate = useNavigate();
  const titleById = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const warningByTaskId = useMemo(() => new Map(mockWarnings.map((warning) => [warning.taskId, warning])), []);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const completedCount = tasks.filter((task) => task.status === 'DONE').length;
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    const matchesStatus = filter === 'ALL' || task.status === filter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTask = (newTask: TaskInput, projectId: string) => setTasks((previous) => [{ ...newTask, projectId }, ...previous]);

  const handleAutoSchedule = async () => {
    if (isScheduling) return;
    setIsScheduling(true);
    setScheduleResult(null);
    try {
      // Simulate the network/engine round-trip until the real API is connected.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
      setScheduleResult(mockRunScheduler(tasks));
    } finally {
      setIsScheduling(false);
    }
  };
  const updateStatus = (taskId: string, status: TaskStatus) => {
    setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, status, remainingMinutes: status === 'DONE' ? 0 : task.remainingMinutes } : task));
  };
  const deleteTask = (taskId: string) => {
    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    setSelectedTaskId(null);
  };
  const headerCell = 'px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500';
  const filters: { id: Filter; label: string }[] = [{ id: 'ALL', label: 'All' }, { id: 'TODO', label: 'To Do' }, { id: 'IN_PROGRESS', label: 'In Progress' }, { id: 'DONE', label: 'Done' }];

  return <div className="relative flex h-full min-w-0">
    <div className={cn('min-w-0 flex-1 transition-[margin] duration-300', selectedTask ? 'mr-0 xl:mr-[420px]' : '')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"><Plus className="h-4 w-4" />New Task</button>
          <button type="button" onClick={handleAutoSchedule} disabled={isScheduling || tasks.length === 0} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60">
            {isScheduling ? <CalendarClock className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
            {isScheduling ? 'Scheduling…' : 'Auto Schedule'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block"><span className="sr-only">Search tasks by title</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search tasks..." className="w-56 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100" /></label>
          <button type="button" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">All projects<ChevronDown className="h-4 w-4 text-gray-400" /></button>
        </div>
      </div>

      {scheduleResult && <section role="status" aria-live="polite" className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-emerald-950">Schedule preview ready</p>
            <p className="mt-1 text-sm text-emerald-800">Successfully scheduled {scheduleResult.plannedSessions.length} work sessions. {scheduleResult.warnings.filter((warning) => warning.code === 'DEADLINE_RISK').length} deadline risk warnings detected.</p>
            <p className="mt-1 text-xs text-emerald-700">Mock preview only — no calendar events have been saved.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/calendar')} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">View on Calendar</button>
          <button type="button" onClick={() => setIsWarningsOpen(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">View Warnings ({scheduleResult.warnings.length})</button>
          <button type="button" aria-label="Dismiss schedule result" onClick={() => setScheduleResult(null)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"><X className="h-4 w-4" /></button>
        </div>
      </section>}

      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200" role="tablist" aria-label="Filter tasks by status">
        {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={cn('border-b-2 px-4 py-3 text-sm font-medium transition-colors', filter === item.id ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>{item.label}<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{item.id === 'ALL' ? tasks.length : tasks.filter((task) => task.status === item.id).length}</span></button>)}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[980px] divide-y divide-gray-200">
          <thead className="bg-gray-50/80"><tr>
            <th scope="col" className={cn(headerCell, 'w-12')}>Done</th><th scope="col" className={headerCell}>Task title</th><th scope="col" className={headerCell}>Project</th><th scope="col" className={headerCell}>Priority</th><th scope="col" className={headerCell}>Duration</th><th scope="col" className={headerCell}>Deadline</th><th scope="col" className={headerCell}>Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.map((task) => {
              const project = projectById.get(task.projectId);
              const warning = warningByTaskId.get(task.id);
              const atRisk = warning?.code === 'DEADLINE_RISK' && task.status !== 'DONE' && task.status !== 'CANCELLED';
              const progress = progressFor(task);
              const prerequisiteNames = task.dependencyIds.map((id) => titleById.get(id) ?? id);
              return <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className={cn('group cursor-pointer transition-colors hover:bg-gray-50', selectedTaskId === task.id && 'bg-primary-50/40')}>
                <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={task.status === 'DONE' ? `Reopen ${task.title}` : `Mark ${task.title} done`} onClick={() => updateStatus(task.id, task.status === 'DONE' ? 'TODO' : 'DONE')} className={cn('flex h-5 w-5 items-center justify-center rounded border transition-colors', task.status === 'DONE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-transparent hover:border-primary-500')} >{task.status === 'DONE' && <Check className="h-3.5 w-3.5" />}</button></td>
                <td className="px-4 py-4"><div className="flex items-center gap-2"><span className={cn('text-sm font-medium', task.status === 'DONE' || task.status === 'CANCELLED' ? 'text-gray-400 line-through' : 'text-gray-900')}>{task.title}</span>{atRisk && <span title="Deadline risk" className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><AlertTriangle className="h-3 w-3" />Risk</span>}{prerequisiteNames.length > 0 && <span title={`Prerequisites: ${prerequisiteNames.join(', ')}`} className="text-gray-400"><Link2 className="h-3.5 w-3.5" /></span>}</div></td>
                <td className="px-4 py-4 whitespace-nowrap">{project ? <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: project.color, backgroundColor: `${project.color}1A` }}>{project.name}</span> : <span className="text-sm text-gray-400">—</span>}</td>
                <td className="px-4 py-4 whitespace-nowrap"><span className={PRIORITY_BADGE[task.priority]}>{PRIORITY_LABEL[task.priority]}</span></td>
                <td className="px-4 py-4 whitespace-nowrap"><div className="flex items-center gap-3"><span className="w-28 text-xs font-medium tabular-nums text-gray-700">{task.remainingMinutes} / {task.estimatedMinutes} min</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100"><div className={cn('h-full rounded-full', atRisk ? 'bg-red-500' : task.status === 'DONE' ? 'bg-emerald-500' : 'bg-primary-500')} style={{ width: `${progress}%` }} /></div></div></td>
                <td className={cn('whitespace-nowrap px-4 py-4 text-sm', atRisk ? 'font-medium text-red-600' : 'text-gray-600')} title={task.deadline ?? undefined}>{formatDeadline(task.deadline)}</td>
                <td className="px-4 py-4 whitespace-nowrap"><span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_BADGE[task.status])}><span className="h-1.5 w-1.5 rounded-full bg-current" />{STATUS_LABEL[task.status]}</span></td>
              </tr>;
            })}
            {filteredTasks.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">No tasks match your search and status filter.</td></tr>}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 text-xs text-gray-500"><span>{filteredTasks.length} shown · {tasks.length} tasks · {completedCount} completed</span><span><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />Task list</span></div>
      </div>
    </div>

    {selectedTask && <TaskDetails task={selectedTask} tasks={tasks} project={projectById.get(selectedTask.projectId)} warning={warningByTaskId.get(selectedTask.id)} onClose={() => setSelectedTaskId(null)} onStatusChange={updateStatus} onDelete={deleteTask} />}
    {isWarningsOpen && scheduleResult && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsWarningsOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="schedule-warnings-title" className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div><h2 id="schedule-warnings-title" className="text-base font-semibold text-gray-900">Scheduling warnings</h2><p className="mt-1 text-sm text-gray-500">Reasons the mock engine could not place all remaining work.</p></div>
          <button type="button" onClick={() => setIsWarningsOpen(false)} aria-label="Close warnings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
          {scheduleResult.warnings.length === 0 ? <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">No warnings detected by the mock scheduler.</p> : scheduleResult.warnings.map((warning, index) => {
            const task = tasks.find((item) => item.id === warning.taskId);
            const missingMinutes = warning.metadata.missingMinutes;
            const reason = warning.code === 'DEADLINE_RISK'
              ? `Insufficient free slots before deadline${missingMinutes == null ? '' : ` (Missing ${missingMinutes} minutes)`}.`
              : warning.code === 'PARTIALLY_SCHEDULED'
                ? `Only part of the remaining work could be scheduled${missingMinutes == null ? '' : `; ${missingMinutes} minutes remain unscheduled`}.`
                : warning.code === 'DEPENDENCY_BLOCKED'
                  ? `Blocked by prerequisite task${warning.metadata.dependencyIds?.length === 1 ? '' : 's'}: ${(warning.metadata.dependencyIds ?? []).map((id) => titleById.get(id) ?? id).join(', ')}.`
                  : warning.code === 'NO_AVAILABLE_SLOT'
                    ? 'No available slot in the mock planning horizon.'
                    : warning.code === 'OUTSIDE_PLANNING_HORIZON'
                      ? 'The task dates fall outside the planning horizon.'
                      : 'The task data needs validation.';
            return <article key={`${warning.taskId}-${warning.code}-${index}`} className="rounded-xl border border-red-100 bg-red-50/70 p-4">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /><div className="min-w-0"><p className="text-sm font-semibold text-red-900">{task?.title ?? warning.taskId}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-red-700">{warning.code.replaceAll('_', ' ')}</p><p className="mt-2 text-sm text-red-800">{reason}</p></div></div>
            </article>;
          })}
          {scheduleResult.unscheduledTasks.length > 0 && <div className="pt-1"><h3 className="mb-2 text-sm font-semibold text-gray-800">Unscheduled work</h3><ul className="space-y-2">{scheduleResult.unscheduledTasks.map((item) => <li key={item.taskId} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"><span className="text-gray-700">{item.taskTitle}</span><span className="shrink-0 font-medium tabular-nums text-gray-600">{item.remainingMinutes} min left</span></li>)}</ul></div>}
        </div>
        <footer className="flex justify-end border-t border-gray-100 px-5 py-4"><button type="button" onClick={() => setIsWarningsOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button></footer>
      </section>
    </div>}

    <CreateTaskModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreateTask} projects={projectList} existingTasks={tasks} />
  </div>;
}
