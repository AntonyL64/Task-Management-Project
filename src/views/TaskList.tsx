import { useState } from 'react';
import { Plus, Search, ChevronDown, Link2, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { mockTasks, getTaskById } from '../lib/mockData';
import type { Task } from '../lib/mockData';
import TaskDetails from '../components/TaskDetails';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function TaskList() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High': return 'badge badge-danger';
      case 'Medium': return 'badge badge-warning';
      case 'Low': return 'badge badge-muted';
      default: return 'badge badge-muted';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Done': return 'badge badge-success';
      case 'In Progress': return 'badge badge-primary';
      case 'At Risk': return 'badge badge-danger';
      default: return 'badge badge-muted';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Done': return 'dot-success';
      case 'In Progress': return 'dot-primary';
      case 'At Risk': return 'dot-danger';
      default: return 'dot-muted';
    }
  };

  // Render parents first, each immediately followed by its own subtasks,
  // so hierarchy is visible in row order rather than relying on sort order
  // from the data file.
  const topLevelTasks = mockTasks.filter((t) => !t.parentId);
  const orderedRows: Task[] = [];
  topLevelTasks.forEach((parent) => {
    orderedRows.push(parent);
    mockTasks.filter((t) => t.parentId === parent.id).forEach((child) => orderedRows.push(child));
  });

  const completedCount = mockTasks.filter((t) => t.isCompleted).length;

  return (
    <div className="flex h-full relative">
      <div className={cn('flex-1 transition-all duration-300', selectedTask ? 'mr-[400px]' : '')}>
        <div className="flex items-center justify-between mb-8">
          <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            New Task
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64 bg-white"
                placeholder="Search tasks..."
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50">
              All projects
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider w-8" />
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Task Name
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Project
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Priority
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Progress
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {orderedRows.map((task) => {
                const isSubtask = Boolean(task.parentId);
                const dependency = task.dependsOn ? getTaskById(task.dependsOn) : undefined;

                return (
                  <tr
                    key={task.id}
                    className={cn(
                      'hover:bg-gray-50 cursor-pointer transition-colors group',
                      selectedTask?.id === task.id ? 'bg-primary-50/30' : ''
                    )}
                    onClick={() => setSelectedTask(task)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-primary-600" />
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-gray-300 group-hover:border-primary-400 transition-colors" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: isSubtask ? 24 : 0 }}
                      >
                        {isSubtask && (
                          <CornerDownRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" aria-hidden="true" />
                        )}
                        <span
                          className={cn(
                            'text-sm font-medium',
                            task.isCompleted ? 'text-gray-400 line-through' : 'text-text'
                          )}
                        >
                          {task.name}
                        </span>
                        {dependency && (
                          <span
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                            title={`Depends on: ${dependency.name}`}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={task.project.badgeClass}>{task.project.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getPriorityBadge(task.priority)}>{task.priority}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-500">{task.deadline}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              'h-1.5 rounded-full',
                              task.isCompleted ? 'bg-success-500' : task.status === 'At Risk' ? 'bg-danger-500' : 'bg-primary-500'
                            )}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-500 font-medium w-8">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(task.status)}>
                        <span className={cn('badge-dot', getStatusDot(task.status))} />
                        {task.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-muted-500">
            <span>{mockTasks.length} tasks · {completedCount} completed</span>
            <span>Updated just now</span>
          </div>
        </div>
      </div>

      {selectedTask && <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
