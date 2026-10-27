import { Play, SkipForward, Pause, RefreshCcw, Settings as SettingsIcon } from 'lucide-react';
import { mockTasks, getProjectById } from '../lib/mockData';

export default function Focus() {
  const currentTask = mockTasks[0];
  const currentProject = getProjectById(currentTask.projectId);
  const upNextTasks = mockTasks.slice(1, 4);

  return (
    <div className="flex gap-8 h-full max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute top-0 right-0 p-4">
          <button className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm border border-gray-100 hover:shadow transition-all">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="w-[400px] h-[400px] rounded-full border-8 border-gray-100 flex items-center justify-center relative shadow-inner bg-white">
          <div className="absolute inset-0 rounded-full border-8 border-indigo-500" style={{ clipPath: 'polygon(50% 0%, 100% 0, 100% 100%, 50% 100%)' }}></div>
          <div className="flex flex-col items-center z-10">
            <span className="text-7xl font-light text-gray-900 tracking-tight">24:59</span>
            <span className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Focus Session</span>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-12">
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 shadow-sm transition-all">
            <RefreshCcw className="w-5 h-5" />
          </button>
          <button className="w-20 h-20 flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:scale-105 transition-all">
            <Pause className="w-8 h-8 fill-current" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 shadow-sm transition-all">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-[400px] flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Current Task</h3>
            {currentProject && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${currentProject.color}20`, color: currentProject.color }}>
                {currentProject.name}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 leading-tight">{currentTask.title}</h2>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              High Priority
            </div>
            <div className="w-px h-4 bg-gray-200"></div>
            <div>Due Today</div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Notes / Scratchpad</h4>
            <textarea 
              className="w-full bg-transparent border-none resize-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400 p-0"
              rows={4}
              placeholder="Jot down quick thoughts here..."
            ></textarea>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex-1">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Up Next</h3>
          <div className="space-y-3">
            {upNextTasks.map(task => {
              const project = getProjectById(task.projectId);
              return (
                <div key={task.id} className="p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer">
                  <div className="flex flex-col gap-1 overflow-hidden pr-4">
                    <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
                    {project && (
                      <span className="text-xs font-medium w-fit px-1.5 py-0.5 rounded" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                        {project.name}
                      </span>
                    )}
                  </div>
                  <button className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-indigo-600 group-hover:border-indigo-200 shadow-sm transition-all flex-shrink-0">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
