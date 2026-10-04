import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type BlockType = 'event' | 'session' | 'locked';

type CalendarBlock = {
  id: string;
  day: number; // 0 = Mon ... 6 = Sun, matches weekDays index
  startHour: number; // 24h, may include .5 for half hours
  endHour: number;
  title: string;
  meta: string;
  type: BlockType;
};

const weekDays = [
  { label: 'MON', date: 21 },
  { label: 'TUE', date: 22 },
  { label: 'WED', date: 23 },
  { label: 'THU', date: 24 },
  { label: 'FRI', date: 25 },
  { label: 'SAT', date: 26 },
  { label: 'SUN', date: 27 },
];

const TODAY_INDEX = 1; // Tuesday, for this mock week
const CURRENT_TIME_HOUR = 13.5; // 1:30 PM

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 64; // px per hour row

const weekBlocks: CalendarBlock[] = [
  { id: 'b1', day: 0, startHour: 8.5, endHour: 9.5, title: 'Team Meeting', meta: '8:30–9:30 AM', type: 'event' },
  { id: 'b2', day: 0, startHour: 10.25, endHour: 11.75, title: 'Write Report — Session 1/3', meta: '10:15–11:45 AM', type: 'session' },
  { id: 'b3', day: 1, startHour: 9, endHour: 10, title: 'Project Sync', meta: '9:00–10:00 AM', type: 'event' },
  { id: 'b4', day: 1, startHour: 11.5, endHour: 13, title: 'Write Report — Session 2/3', meta: '11:30 AM–1:00 PM', type: 'session' },
  { id: 'b5', day: 1, startHour: 14.5, endHour: 15.5, title: 'Design Review', meta: '2:30–3:30 PM', type: 'event' },
  { id: 'b6', day: 2, startHour: 9.5, endHour: 11, title: 'Research competitors — Session 1/2', meta: '9:30–11:00 AM', type: 'locked' },
  { id: 'b7', day: 2, startHour: 13.5, endHour: 14.5, title: 'Client Check-in', meta: '1:30–2:30 PM', type: 'event' },
  { id: 'b8', day: 2, startHour: 16, endHour: 17.5, title: 'Write Report — Session 3/3', meta: '4:00–5:30 PM', type: 'session' },
];

const blockStyles: Record<BlockType, string> = {
  event: 'bg-success-100 border border-success-500/40 text-success-700',
  session: 'bg-primary-50 border border-primary-200 text-primary-700',
  locked: 'bg-primary-50 border border-primary-200 text-primary-700',
};

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-500">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-success-500" /> Event
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm border border-primary-500 bg-primary-50" /> Work Session
      </span>
      {/* <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm border border-warning-500" /> Locked
      </span> */}
    </div>
  );
}

function HourGutter() {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  return (
    <div className="flex flex-col text-right pr-3" style={{ paddingTop: HOUR_HEIGHT / 2 }}>
      {hours.map((h) => (
        <div key={h} style={{ height: HOUR_HEIGHT }} className="text-xs text-muted-500 -mt-2">
          {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
        </div>
      ))}
    </div>
  );
}

function Block({ block }: { block: CalendarBlock }) {
  const top = (block.startHour - HOUR_START) * HOUR_HEIGHT;
  const height = (block.endHour - block.startHour) * HOUR_HEIGHT;
  return (
    <div
      className={cn('absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden text-xs leading-tight', blockStyles[block.type])}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1 font-medium truncate">
        {block.type === 'locked' && <span aria-hidden="true">🔒</span>}
        <span className="truncate">{block.title}</span>
      </div>
      <div className="text-[11px] opacity-80 truncate">{block.meta}</div>
    </div>
  );
}

function WeekGrid() {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const nowTop = (CURRENT_TIME_HOUR - HOUR_START) * HOUR_HEIGHT;

  return (
    <div className="flex">
      <div className="w-16 flex-shrink-0">
        <div className="h-10" />
        <HourGutter />
      </div>
      <div className="flex-1 grid grid-cols-7 border-l border-gray-200">
        {weekDays.map((day, dayIdx) => {
          const isToday = dayIdx === TODAY_INDEX;
          const isWeekend = dayIdx >= 5;
          return (
            <div
              key={day.label}
              className={cn(
                'relative border-r border-gray-200',
                isToday ? 'bg-primary-50/40' : isWeekend ? 'bg-gray-50/60' : 'bg-white'
              )}
            >
              <div className={cn('h-10 flex flex-col items-center justify-center border-b border-gray-200', isToday && 'bg-primary-50')}>
                <span className="text-[11px] text-muted-500 tracking-wide">{day.label}</span>
                <span className={cn('text-sm', isToday ? 'font-semibold text-primary-700' : 'text-text')}>{day.date}</span>
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div key={h} className="border-b border-gray-100" style={{ height: HOUR_HEIGHT, position: 'absolute', top: i * HOUR_HEIGHT, left: 0, right: 0 }} />
                ))}
                {isToday && (
                  <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: nowTop }}>
                    <span className="w-2 h-2 rounded-full bg-danger-500 -ml-1" />
                    <span className="flex-1 h-px bg-danger-500" />
                  </div>
                )}
                {weekBlocks.filter((b) => b.day === dayIdx).map((b) => (
                  <Block key={b.id} block={b} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const dayBlocks: CalendarBlock[] = [
  { id: 'd1', day: 0, startHour: 8.5, endHour: 9.25, title: 'Team stand-up', meta: '8:30–9:15 AM · Product team', type: 'event' },
  { id: 'd2', day: 0, startHour: 9.5, endHour: 11, title: 'Finalize Q4 planning notes — Part 1 of 2', meta: '9:30–11:00 AM · Focused work', type: 'session' },
  { id: 'd3', day: 0, startHour: 11.5, endHour: 12.5, title: 'Quarterly roadmap deep work', meta: '11:30 AM–12:30 PM · Protected session', type: 'locked' },
  { id: 'd4', day: 0, startHour: 14, endHour: 15, title: 'Client check-in', meta: '2:00–3:00 PM · Northstar account', type: 'event' },
  { id: 'd5', day: 0, startHour: 15.5, endHour: 17, title: 'Finalize Q4 planning notes — Part 2 of 2', meta: '3:30–5:00 PM · Focused work', type: 'session' },
];

function DayGrid() {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const nowTop = (CURRENT_TIME_HOUR - HOUR_START) * HOUR_HEIGHT;

  return (
    <div className="flex">
      <div className="w-16 flex-shrink-0">
        <div className="h-10" />
        <HourGutter />
      </div>
      <div className="flex-1 border-l border-gray-200">
        <div className="h-10 flex items-center px-3 border-b border-gray-200 bg-primary-50/40">
          <span className="text-sm font-semibold text-primary-700">FRIDAY · SEPTEMBER 25</span>
        </div>
        <div className="relative bg-primary-50/10" style={{ height: gridHeight }}>
          {hours.map((h, i) => (
            <div key={h} className="border-b border-gray-100" style={{ height: HOUR_HEIGHT, position: 'absolute', top: i * HOUR_HEIGHT, left: 0, right: 0 }} />
          ))}
          <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: nowTop }}>
            <span className="w-2 h-2 rounded-full bg-danger-500 -ml-1" />
            <span className="flex-1 h-px bg-danger-500" />
            <span className="text-[11px] bg-danger-500 text-white px-1.5 py-0.5 rounded -mt-2 mr-2">1:32 PM</span>
          </div>
          {dayBlocks.map((b) => (
            <Block key={b.id} block={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [view, setView] = useState<'day' | 'week'>('week');

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setView('day')}
            className={cn('px-3 py-1.5 text-sm font-medium rounded-md transition-colors', view === 'day' ? 'bg-white text-text shadow-sm' : 'text-muted-500 hover:text-text')}
          >
            Day
          </button>
          <button
            onClick={() => setView('week')}
            className={cn('px-3 py-1.5 text-sm font-medium rounded-md transition-colors', view === 'week' ? 'bg-white text-text shadow-sm' : 'text-muted-500 hover:text-text')}
          >
            Week
          </button>
        </div>
        <Legend />
      </div>

      <div className="flex-1 overflow-auto">{view === 'week' ? <WeekGrid /> : <DayGrid />}</div>
    </div>
  );
}
