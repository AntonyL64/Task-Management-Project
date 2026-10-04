import { NavLink } from 'react-router-dom';
import { 
  CheckSquare, 
  Calendar, 
  KanbanSquare, 
  BarChartHorizontal, 
  Target, 
  TrendingUp, 
  Settings 
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const navItems = [
    { name: 'Task List', path: '/tasks', icon: CheckSquare },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Kanban', path: '/kanban', icon: KanbanSquare },
    { name: 'Gantt / Timeline', path: '/gantt', icon: BarChartHorizontal },
    { name: 'Focus', path: '/focus', icon: Target },
    { name: 'Progress', path: '/progress', icon: TrendingUp },
  ];

  return (
    <aside className="w-64 bg-[var(--color-sidebar)] text-white flex flex-col h-screen fixed top-0 left-0">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-wide">Tempo</span>
        </div>
        <button className="text-gray-400 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-4">
        <h3 className="text-xs font-semibold text-gray-400 tracking-wider mb-4 uppercase">Workspace</h3>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive 
                      ? 'bg-primary-600 text-white font-medium' 
                      : 'text-gray-300 hover:bg-white/10'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-6 py-6">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive 
                ? 'bg-primary-600 text-white font-medium' 
                : 'text-gray-300 hover:bg-white/10'
            )
          }
        >
          <Settings className="w-5 h-5" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
