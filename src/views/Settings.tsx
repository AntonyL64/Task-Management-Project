import { Globe, Trash2, Calendar as CalendarIcon, CalendarPlus, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Settings() {
  const days = [
    { id: 'mon', name: 'Monday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
    { id: 'tue', name: 'Tuesday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
    { id: 'wed', name: 'Wednesday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
    { id: 'thu', name: 'Thursday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
    { id: 'fri', name: 'Friday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
    { id: 'sat', name: 'Saturday', enabled: false, start: '9:00 AM', end: '5:00 PM' },
    { id: 'sun', name: 'Sunday', enabled: false, start: '9:00 AM', end: '5:00 PM' },
  ];

  return (
    <div className="max-w-5xl mx-auto h-full pb-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Working hours & availability</h2>
          <p className="text-gray-500 mt-1">Set when Tempo can schedule work, and block out time away.</p>
        </div>
        <button className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm">
          Save changes
        </button>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Timezone</h3>
                <p className="text-xs text-gray-500 mt-0.5">Used for your schedule and exception dates.</p>
              </div>
              <div className="relative w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="w-4 h-4 text-gray-400" />
                </div>
                <select className="block w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 appearance-none">
                  <option>(GMT-05:00) Eastern Time</option>
                  <option>(GMT-08:00) Pacific Time</option>
                  <option>(GMT+00:00) London</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Weekly working hours</h3>
              <p className="text-xs text-gray-500 mt-0.5">Choose the days and times you're available for focused work.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {days.map((day) => (
                <div key={day.id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4 w-40">
                    <button 
                      className={cn(
                        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        day.enabled ? 'bg-primary-500' : 'bg-gray-200'
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        day.enabled ? 'translate-x-4' : 'translate-x-0'
                      )} />
                    </button>
                    <span className={cn("text-sm font-medium", day.enabled ? "text-gray-900" : "text-gray-400")}>
                      {day.name}
                    </span>
                  </div>
                  
                  {day.enabled ? (
                    <div className="flex items-center gap-3">
                      <select className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-28">
                        <option>{day.start}</option>
                        <option>10:00 AM</option>
                      </select>
                      <span className="text-gray-400 text-sm">to</span>
                      <select className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-28">
                        <option>{day.end}</option>
                        <option>6:00 PM</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center justify-start flex-1 ml-4 text-sm text-gray-400 font-medium">
                      Unavailable
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30">
              <h3 className="text-sm font-semibold text-gray-900">Day-off / Exceptions</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">Dates when you're unavailable, regardless of your weekly schedule.</p>
            </div>
            
            <div className="divide-y divide-gray-100">
              <div className="p-4 flex items-center justify-between group">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 text-primary-600 mt-0.5">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Oct 12, 2026</div>
                    <div className="text-xs text-gray-500 mt-0.5">Personal day</div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex items-center justify-between group">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 text-primary-600 mt-0.5">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Dec 24–Jan 1</div>
                    <div className="text-xs text-gray-500 mt-0.5">Winter break</div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50/30">
              <button className="w-full py-2.5 border border-primary-200 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors flex items-center justify-center gap-2">
                <CalendarPlus className="w-4 h-4" />
                Add exception
              </button>
              <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>Select a single date or date range.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Scheduling preferences</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">Control how Tempo allocates time and buffers between sessions.</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Default work session length</span>
                <select className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-24">
                  <option>45 min</option>
                  <option>60 min</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Buffer time between sessions</span>
                <select className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-24">
                  <option>15 min</option>
                  <option>30 min</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">Max focus hours per day</span>
                <select className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-24">
                  <option>6 hrs</option>
                  <option>8 hrs</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
