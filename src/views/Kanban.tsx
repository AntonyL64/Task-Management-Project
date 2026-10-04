import { Plus, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { mockTasks } from '../lib/mockData';
import type { Task, Status } from '../lib/mockData';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const columns: { id: Status; title: string; dot: string }[] = [
  { id: 'To Do', title: 'To Do', dot: 'dot-muted' },
  { id: 'In Progress', title: 'In Progress', dot: 'dot-primary' },
  { id: 'Done', title: 'Done', dot: 'dot-success' },
  { id: 'At Risk', title: 'At Risk', dot: 'dot-danger' },
];

function getTasksByStatus(statusId: Status) {
  return mockTasks.filter((t) => t.status === statusId);
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'High': return 'badge badge-danger';
    case 'Medium': return 'badge badge-warning';
    case 'Low': return 'badge badge-muted';
    default: return 'badge badge-muted';
  }
}

export default function Kanban() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-text">My work</h2>
          <p className="text-sm text-muted-500 mt-0.5">{mockTasks.length} tasks across four stages</p>
        </div>
        <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Create task
        </button>
      </div>

      <div className="flex gap-6 flex-1 overflow-x-auto pb-4">
        {columns.map((column) => {
          const tasks = getTasksByStatus(column.id);
          return (
            <div key={column.id} className="flex-shrink-0 w-[300px] flex flex-col bg-gray-50/50 rounded-xl p-4 border border-gray-200/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn('badge-dot', column.dot)} />
                  <h3 className="font-semibold text-text text-sm">{column.title}</h3>
                  <span className="bg-gray-200 text-muted-600 text-xs font-medium px-2 py-0.5 rounded-full">{tasks.length}</span>
                </div>
                <button className="text-gray-400 hover:text-muted-600">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto">
                {tasks.map((task: Task) => (
                  <div key={task.id} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-grab">
                    <div className="flex items-start justify-between mb-3">
                      <span className={task.project.badgeClass}>{task.project.name}</span>
                      <button className="text-gray-400 hover:text-muted-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className={cn('text-sm font-medium text-text mb-3', task.isCompleted && 'line-through text-gray-400')}>
                      {task.name}
                    </h4>

                    {task.status === 'At Risk' && (
                      <div className="mb-3">
                        <span className="badge badge-danger">Needs attention</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-muted-500">{task.deadline}</span>
                      <div className="flex items-center gap-2">
                        <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                        {task.isCompleted && <CheckCircle2 className="w-4 h-4 text-success-500" />}
                      </div>
                    </div>
                  </div>
                ))}

                <button className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-muted-500 hover:text-text hover:border-gray-300 hover:bg-gray-50 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
