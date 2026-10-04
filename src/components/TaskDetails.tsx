import { X, Calendar, Clock, Paperclip, MessageSquare, MoreHorizontal, CheckCircle2, Circle } from 'lucide-react';
import type { Task } from '../lib/mockData';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type TaskDetailsProps = {
  task: Task;
  onClose: () => void;
};

export default function TaskDetails({ task, onClose }: TaskDetailsProps) {
  return (
    <div className="w-[400px] border-l border-gray-200 bg-white h-[calc(100vh-5rem)] fixed right-0 top-20 overflow-y-auto shadow-xl z-20 flex flex-col transform transition-transform duration-300 translate-x-0">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          {task.isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-primary-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-500">Mark complete</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 flex-1">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">{task.name}</h2>

        <div className="space-y-6">
          <div className="grid grid-cols-3 items-center">
            <span className="text-sm text-gray-500 font-medium">Project</span>
            <div className="col-span-2">
              <span className={task.project.badgeClass}>
                {task.project.name}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center">
            <span className="text-sm text-gray-500 font-medium">Due date</span>
            <div className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4 text-gray-400" />
              {task.deadline}
            </div>
          </div>

          <div className="grid grid-cols-3 items-center">
            <span className="text-sm text-gray-500 font-medium">Priority</span>
            <div className="col-span-2">
              <span className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium inline-block",
                task.priority === 'High' && "bg-danger-100 text-danger-700",
                task.priority === 'Medium' && "bg-warning-100 text-warning-700",
                task.priority === 'Low' && "bg-gray-100 text-gray-700"
              )}>
                {task.priority}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center">
            <span className="text-sm text-gray-500 font-medium">Time tracking</span>
            <div className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400" />
              0h logged
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Description</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Add a more detailed description...
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-primary-600 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <Paperclip className="w-4 h-4" />
            <span>Add attachment</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600 hover:text-primary-600 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <MessageSquare className="w-4 h-4" />
            <span>Add comment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
