import { CheckCircle2, Clock, Target, TrendingUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Progress() {
  const stats = [
    { title: 'Tasks Completed', value: '24', trend: '+12%', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: 'Focus Hours', value: '18.5', trend: '+4%', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { title: 'Goal Completion', value: '85%', trend: '+2%', icon: Target, color: 'text-rose-600', bg: 'bg-rose-100' },
    { title: 'Productivity Score', value: '92', trend: '+8%', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  return (
    <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Your Progress</h2>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
          Last 7 Days
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{stat.trend}</span>
              </div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
              <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-semibold text-gray-900">Productivity Trends</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                <span className="text-gray-600">Tasks Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-200"></span>
                <span className="text-gray-600">Focus Hours</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex items-end justify-between gap-2 mt-4 px-4 relative">
            {/* Mock Chart */}
            <div className="absolute left-0 top-0 bottom-0 w-full flex flex-col justify-between text-xs text-gray-400 pointer-events-none">
              <div className="border-b border-gray-100 w-full relative"><span className="absolute -left-6 -top-2">20</span></div>
              <div className="border-b border-gray-100 w-full relative"><span className="absolute -left-6 -top-2">15</span></div>
              <div className="border-b border-gray-100 w-full relative"><span className="absolute -left-6 -top-2">10</span></div>
              <div className="border-b border-gray-100 w-full relative"><span className="absolute -left-6 -top-2">5</span></div>
              <div className="w-full relative"><span className="absolute -left-6 -top-2">0</span></div>
            </div>
            
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
              const h1 = 50;
              const h2 = 30;
              return (
                <div key={day} className="flex flex-col items-center gap-2 z-10 w-12">
                  <div className="w-full flex items-end justify-center gap-1 h-48">
                    <div className="w-4 bg-indigo-500 rounded-t-sm transition-all hover:brightness-110" style={{ height: `${h1}%` }}></div>
                    <div className="w-4 bg-indigo-200 rounded-t-sm transition-all hover:brightness-90" style={{ height: `${h2}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Tasks by Project</h3>
          
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="relative w-40 h-40 mx-auto">
              {/* Mock Donut Chart using SVG */}
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f3f4f6" strokeWidth="20" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#8b5cf6" strokeWidth="20" strokeDasharray="251.2" strokeDashoffset="62.8" className="transition-all duration-1000" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#3b82f6" strokeWidth="20" strokeDasharray="251.2" strokeDashoffset="188.4" className="transition-all duration-1000" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="20" strokeDasharray="251.2" strokeDashoffset="213.5" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-gray-900">42</span>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Total</span>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <span className="text-gray-700 font-medium">Marketing</span>
                </div>
                <span className="text-gray-900 font-semibold">45%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-gray-700 font-medium">Discovery</span>
                </div>
                <span className="text-gray-900 font-semibold">30%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-gray-700 font-medium">Product</span>
                </div>
                <span className="text-gray-900 font-semibold">25%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
