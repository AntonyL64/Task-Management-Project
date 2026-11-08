import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput, EventMountArg, FormatterInput } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, CheckCircle2, CircleDashed, Loader2, Lock, Sparkles, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CalendarEvent, ISODateString, WorkSession } from '../types/domain';
import { PLANNED_PROGRESS, SESSION_STATUS_LABEL, isSessionStatus } from '../types/sessionProgress';
import type { SessionProgress, SessionStatus } from '../types/sessionProgress';
import type { CalendarTimeZone } from '../lib/sessionTime';
import { getMockProjectForTask, mockCalendarEvents, mockCalendarSessions, mockTaskConstraints } from '../lib/mockCalendar';
import {
  DEFAULT_HORIZON_DAYS,
  DEFAULT_WORKING_HOURS,
  checkRescheduleResult,
  mockRunScheduler,
  sortByStart,
} from '../lib/mockScheduler';
import apiClient from '../services/apiClient';
import { calendarService } from '../services/calendarService';
import { schedulerService } from '../services/schedulerService';
import type { TaskConstraint } from '../lib/mockScheduler';
import SessionDetailModal from '../components/SessionDetailModal';
import CalendarEventPopup from '../components/CalendarEventPopup';
import '../styles/calendar.css';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const SCENARIO_DATE = '2026-09-22';
const SCENARIO_NOW = '2026-09-22T08:00:00Z';

const VIEW_OPTIONS = [
  { type: 'timeGridWeek', label: 'Week', unit: 'week' },
  { type: 'timeGridDay', label: 'Day', unit: 'day' },
  { type: 'dayGridMonth', label: 'Month', unit: 'month' },
] as const;

type ViewType = (typeof VIEW_OPTIONS)[number]['type'];

function isViewType(value: string): value is ViewType {
  return VIEW_OPTIONS.some((option) => option.type === value);
}

const BUSINESS_HOURS = DEFAULT_WORKING_HOURS;

interface Notice {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

const NOTICE_CLASS: Record<Notice['tone'], string> = {
  success: 'text-success-700',
  warning: 'text-warning-700',
  error: 'text-danger-600',
};

const NOTICE_VISIBLE_MS = 8000;

type FormatterFn = Extract<FormatterInput, (...args: never[]) => string>;
type FormatterArg = Parameters<FormatterFn>[0];

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LONG_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

type Clock = FormatterArg['date'];

function formatClock(time: Pick<Clock, 'hour' | 'minute'>, alwaysMinutes: boolean, withMeridiem: boolean): string {
  const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
  const minutes = time.minute === 0 && !alwaysMinutes ? '' : `:${String(time.minute).padStart(2, '0')}`;
  return `${hour12}${minutes}${withMeridiem ? (time.hour < 12 ? ' AM' : ' PM') : ''}`;
}

// const formatWeekHeader: FormatterFn = (arg) => `${SHORT_WEEKDAYS[arg.date.marker.getUTCDay()]} ${arg.date.day}`;
// const formatDayHeader: FormatterFn = (arg) => `${LONG_WEEKDAYS[arg.date.marker.getUTCDay()]} ${arg.date.day}`;
const formatWeekHeader: FormatterFn = (arg) => `${SHORT_WEEKDAYS[arg.date.marker.getDay()]} ${arg.date.day}`;
const formatDayHeader: FormatterFn = (arg) => `${LONG_WEEKDAYS[arg.date.marker.getDay()]} ${arg.date.day}`;
const formatSlotLabel: FormatterFn = (arg) => formatClock(arg.date, false, true);

const formatEventTime: FormatterFn = (arg) => {
  if (!arg.end) return formatClock(arg.start, true, true);
  const sameHalfOfDay = (arg.start.hour < 12) === (arg.end.hour < 12);
  return `${formatClock(arg.start, true, !sameHalfOfDay)}–${formatClock(arg.end, true, true)}`;
};

/* -------------------------------------------------------------------------- */
/* Domain -> FullCalendar                                                     */
/* -------------------------------------------------------------------------- */

interface TempoEventProps {
  kind: 'session' | 'event';
  isLocked: boolean;
  recordId: string | null;
  status: SessionStatus;
}

function readEventProps(extended: Readonly<Record<string, unknown>>): TempoEventProps {
  return {
    kind: extended.kind === 'session' ? 'session' : 'event',
    isLocked: extended.isLocked === true,
    recordId: typeof extended.recordId === 'string' ? extended.recordId : null,
    status: isSessionStatus(extended.status) ? extended.status : 'PLANNED',
  };
}

const STATUS_CLASS: Record<SessionStatus, string | null> = {
  PLANNED: null,
  COMPLETED: 'tempo-event--completed',
  PARTIAL: 'tempo-event--partial',
  MISSED: 'tempo-event--missed',
};

function toEventInputs(
  sessions: readonly WorkSession[],
  events: readonly CalendarEvent[],
  progressById: Readonly<Record<string, SessionProgress>>
): EventInput[] {
  const sessionInputs = sessions.map((session): EventInput => {
    const status = progressById[session.id]?.status ?? PLANNED_PROGRESS.status;
    const statusClass = STATUS_CLASS[status];
    return {
      id: `session-${session.id}`,
      title: session.taskTitle,
      start: session.startAt ?? (session as unknown as { start?: string }).start,
      end: session.endAt ?? (session as unknown as { end?: string }).end,
      classNames: [
        'tempo-event--session',
        ...(session.isLocked ? ['tempo-event--locked'] : []),
        ...(statusClass ? [statusClass] : []),
      ],
      extendedProps: { kind: 'session', isLocked: session.isLocked, recordId: session.id, status, taskId: session.taskId },
    };
  });

  const eventInputs = events.map(
    (event): EventInput => ({
      id: `event-${event.id}`,
      title: event.title,
      start: event.startAt ?? (event as unknown as { start?: string }).start,
      end: event.endAt ?? (event as unknown as { end?: string }).end,
      classNames: ['tempo-event--event'],
      extendedProps: { kind: 'event', isLocked: false, recordId: event.id, status: 'PLANNED' },
    })
  );

  return [...eventInputs, ...sessionInputs];
}

function LockIcon() {
  return <Lock className="w-3 h-3 flex-shrink-0" role="img" aria-label="Locked" />;
}

function StatusIcon({ status }: { status: SessionStatus }) {
  const label = SESSION_STATUS_LABEL[status];
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-3 h-3 flex-shrink-0" role="img" aria-label={label} />;
    case 'PARTIAL':
      return <CircleDashed className="w-3 h-3 flex-shrink-0" role="img" aria-label={label} />;
    case 'MISSED':
      return <XCircle className="w-3 h-3 flex-shrink-0" role="img" aria-label={label} />;
    case 'PLANNED':
      return null;
  }
}

function renderEventContent(arg: EventContentArg) {
  const { isLocked, status } = readEventProps(arg.event.extendedProps);
  const titleClass = status === 'MISSED' ? 'line-through' : '';

  if (arg.view.type === 'dayGridMonth') {
    return (
      <div className="flex items-center gap-1 min-w-0 px-1.5 text-xs">
        {isLocked && <LockIcon />}
        <StatusIcon status={status} />
        {arg.timeText && <span className="opacity-70 flex-shrink-0">{arg.timeText}</span>}
        <span className={`font-medium truncate ${titleClass}`}>{arg.event.title}</span>
      </div>
    );
  }

  return (
    <div className="px-1.5 py-0.5 leading-tight overflow-hidden">
      <div className="flex items-center gap-1 text-xs font-semibold">
        {isLocked && <LockIcon />}
        <StatusIcon status={status} />
        <span className={`truncate ${titleClass}`}>{arg.event.title}</span>
      </div>
      {arg.timeText && <div className="text-[11px] opacity-80 truncate">{arg.timeText}</div>}
    </div>
  );
}

function tagSessionElement(arg: EventMountArg) {
  const { kind, recordId } = readEventProps(arg.event.extendedProps);
  if (kind === 'session' && recordId) arg.el.dataset.sessionId = recordId;
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

export interface CalendarProps {
  initialSessions?: readonly WorkSession[];
  events?: readonly CalendarEvent[];
  initialDate?: ISODateString | null;
  now?: ISODateString | null;
  timeZone?: CalendarTimeZone;
  taskConstraints?: Readonly<Record<string, TaskConstraint>>;
}

type Selection = { kind: 'session'; id: string } | { kind: 'event'; id: string } | null;

export default function Calendar({
  initialSessions = mockCalendarSessions,
  events = mockCalendarEvents,
  initialDate = null,
  now = null,
  timeZone = 'local', // 'local' | 'UTC' | 'browser' | 'auto' | string (time zone name)
  taskConstraints = mockTaskConstraints,
}: CalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [viewType, setViewType] = useState<ViewType>('timeGridWeek');

  const [sessions, setSessions] = useState<WorkSession[]>(() => [...initialSessions]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => [...events]);
  const [progressById, setProgressById] = useState<Record<string, SessionProgress>>({});
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    async function syncCalendarData() {
      // 1. Tải sự kiện cố định từ backend
      try {
        const fetchedEvents = await calendarService.getEvents();
        if (Array.isArray(fetchedEvents)) {
          setCalendarEvents(fetchedEvents);
        }
      } catch (err) {
        console.warn('Dùng dữ liệu sự kiện lịch dự phòng:', err);
      }

      // 2. Tải các phiên làm việc đã được lập lịch từ backend
      try {
        const sessionsRes = await apiClient.get('/work-sessions');
        if (Array.isArray(sessionsRes.data)) {
          const mappedSessions: WorkSession[] = (sessionsRes.data as Array<Record<string, unknown>>).map((s) => ({
            id: String(s.id),
            taskId: String(s.taskId),
            taskTitle: String((s.task as { title?: string } | undefined)?.title ?? s.taskTitle ?? 'Work Session'),
            startAt: String(s.startAt ?? s.start),
            endAt: String(s.endAt ?? s.end),
            isLocked: Boolean(s.isLocked),
          }));
          setSessions(mappedSessions);

          // Nếu có phiên làm việc thật, tự động chuyển lịch đến tuần chứa phiên làm việc
          if (mappedSessions.length > 0 && calendarRef.current) {
            calendarRef.current.getApi().gotoDate(mappedSessions[0].startAt);
          }
        }
      } catch (err) {
        console.warn('Dùng dữ liệu phiên làm việc dự phòng:', err);
      }
    }

    void syncCalendarData();
  }, []);

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const runIdRef = useRef(0);

  useEffect(
    () => () => {
      runIdRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const isFixed = (session: WorkSession) => session.isLocked || progressById[session.id] !== undefined;
  const fixedSessions = sessions.filter(isFixed);
  const freeSessions = sessions.filter((session) => !isFixed(session));
  const lockedCount = sessions.filter((session) => session.isLocked).length;
  const statusText = `${sessions.length} Total Session${sessions.length === 1 ? '' : 's'} (${lockedCount} Locked)`;

  const eventInputs = useMemo(
    () => toEventInputs(sessions, calendarEvents, progressById),
    [sessions, calendarEvents, progressById]
  );
  const currentUnit = VIEW_OPTIONS.find((option) => option.type === viewType)?.unit ?? 'week';

  const selectedSession = selection?.kind === 'session' ? sessions.find((s) => s.id === selection.id) : undefined;
  const selectedEvent = selection?.kind === 'event' ? calendarEvents.find((e) => e.id === selection.id) : undefined;

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    if (isViewType(arg.view.type)) setViewType(arg.view.type);
  };

  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    if (isRescheduling) return;
    const { kind, recordId } = readEventProps(arg.event.extendedProps);
    if (!recordId) return;
    setSelection({ kind, id: recordId });
  };

  /* ------------------------------ session edits ------------------------------ */

  const handleLockChange = async (sessionId: string, isLocked: boolean) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, isLocked } : s)));
    try {
      await apiClient.patch(`/work-sessions/${sessionId}`, { isLocked });
    } catch (err) {
      console.warn('Lỗi cập nhật trạng thái khóa phiên lên backend:', err);
    }
  };

  const handleProgressSave = async (sessionId: string, progress: SessionProgress) => {
    setProgressById((prev) =>
      progress.status === 'PLANNED' ? withoutKey(prev, sessionId) : { ...prev, [sessionId]: progress }
    );
    try {
      await apiClient.patch(`/work-sessions/${sessionId}`, { status: progress.status });
    } catch (err) {
      console.warn('Lỗi cập nhật tiến độ phiên làm việc:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setProgressById((prev) => withoutKey(prev, sessionId));
    try {
      await apiClient.delete(`/work-sessions/${sessionId}`);
    } catch (err) {
      console.warn('Lỗi xóa phiên làm việc trên backend:', err);
    }
  };

  const closeDialog = () => setSelection(null);

  /* ------------------------------- reschedule ------------------------------- */

  const handleReschedule = async () => {
    if (isRescheduling || freeSessions.length === 0) return;

    const fixed = fixedSessions;
    const free = freeSessions;
    const runId = ++runIdRef.current;
    setIsRescheduling(true);
    setNotice(null);

    try {
      let result: any = null;

      try {
        // 1. Gọi API reschedule của NestJS backend
        const response = await schedulerService.reschedule({
          newBusyEventId: undefined,
          completedTaskId: undefined,
        } as unknown as Parameters<typeof schedulerService.reschedule>[0]);

        if (response && Array.isArray((response as any).plannedSessions)) {
          // Chuẩn hóa dữ liệu trả về từ backend về format của frontend
          result = {
            ...response,
            plannedSessions: (response as any).plannedSessions.map((s: any) => ({
              ...s,
              startAt: s.startAt || s.start,
              endAt: s.endAt || s.end,
              isLocked: s.isLocked ?? s.locked ?? false,
              taskTitle: s.taskTitle || s.task?.title || 'Work Session',
            })),
            unscheduledSessions: (response as any).unscheduledSessions || (response as any).unscheduledTasks || [],
          };
        }
      } catch (apiErr) {
        console.warn('API lập lịch backend chưa phản hồi, kích hoạt mock engine cục bộ:', apiErr);
      }

      // 2. Dự phòng bằng mock scheduler nếu backend không trả về kết quả
      if (!result) {
        result = await mockRunScheduler({
          now: now ?? new Date().toISOString(),
          sessions: free,
          lockedSessions: fixed,
          busyEvents: calendarEvents,
          workingHours: BUSINESS_HOURS,
          taskConstraints,
        });
      }

      if (runId !== runIdRef.current) return;

      // 3. Chuẩn hóa danh sách plannedSessions để tính toán vị trí
      const planned: WorkSession[] = (result.plannedSessions || []).map((s: any) => ({
        id: String(s.id),
        taskId: String(s.taskId),
        taskTitle: String(s.taskTitle || s.task?.title || 'Work Session'),
        startAt: String(s.startAt || s.start),
        endAt: String(s.endAt || s.end),
        isLocked: Boolean(s.isLocked ?? s.locked),
      }));

      // Các session đã khóa luôn được giữ nguyên từ fixedSessions
      const fixedIds = new Set(fixed.map((session) => session.id));
      const placed = planned.filter((session) => !fixedIds.has(session.id));
      setSessions(sortByStart([...fixed, ...placed]));

      // 4. Tính toán số phiên đã dời và số phiên chưa xếp được
      const before = new Map(free.map((session) => [session.id, session]));
      const moved = placed.filter((session) => {
        const original = before.get(session.id);
        return original !== undefined && Date.parse(original.startAt) !== Date.parse(session.startAt);
      }).length;

      const unplacedList = result.unscheduledSessions || result.unscheduledTasks || [];
      const unplaced = unplacedList.length;
      const plural = free.length === 1 ? '' : 's';

      setNotice({
        tone: unplaced > 0 ? 'warning' : 'success',
        text:
          `${moved} of ${free.length} free session${plural} moved · ${lockedCount} locked kept in place` +
          (unplaced > 0 ? ` · ${unplaced} could not be placed in horizon` : ''),
      });
    } catch (err) {
      console.error('Lỗi chi tiết khi Reschedule:', err);
      if (runId === runIdRef.current) {
        setNotice({ tone: 'error', text: 'Rescheduling failed. Your calendar was not changed.' });
      }
    } finally {
      if (runId === runIdRef.current) setIsRescheduling(false);
    }
  };

  const navButton =
    'p-1.5 rounded-lg border border-gray-200 bg-white text-muted-600 hover:bg-gray-50 hover:text-text transition-colors ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text min-w-[12rem]" aria-live="polite">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().prev()}
              aria-label={`Previous ${currentUnit}`}
              className={navButton}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => calendarRef.current?.getApi().next()}
              aria-label={`Next ${currentUnit}`}
              className={navButton}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().today()}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-muted-600 hover:bg-gray-50 hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Today
          </button>
        </div>

        <div role="group" aria-label="Calendar view" className="inline-flex items-center bg-gray-100 p-1 rounded-lg">
          {VIEW_OPTIONS.map((option) => {
            const active = viewType === option.type;
            return (
              <button
                key={option.type}
                type="button"
                aria-pressed={active}
                onClick={() => calendarRef.current?.getApi().changeView(option.type)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  active ? 'bg-white text-text shadow-sm' : 'text-muted-500 hover:text-text'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-text">
            <Lock className="w-4 h-4 text-primary-600" aria-hidden="true" />
            {statusText}
          </p>
          <div aria-live="polite" className="min-w-0">
            {notice && <p className={cn('text-xs', NOTICE_CLASS[notice.tone])}>{notice.text}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleReschedule}
          disabled={isRescheduling || freeSessions.length === 0}
          aria-busy={isRescheduling}
          title={
            freeSessions.length === 0
              ? 'Every session is locked or already has an outcome'
              : 'Re-plan all unlocked sessions around the locked ones'
          }
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium shadow-sm transition-colors',
            'hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-600'
          )}
        >
          {isRescheduling ? (
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          {isRescheduling ? 'Rescheduling...' : 'Reschedule Free Sessions'}
        </button>
      </div>

      <div
        ref={regionRef}
        role="region"
        aria-label="Calendar"
        aria-busy={isRescheduling}
        tabIndex={-1}
        className={cn(
          'tempo-calendar flex-1 min-h-0 outline-none transition-opacity',
          isRescheduling && 'pointer-events-none opacity-60'
        )}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={initialDate ?? undefined}
          now={now ?? undefined}
          timeZone={timeZone}
          headerToolbar={false}
          titleFormat={{ year: 'numeric', month: 'long' }}
          firstDay={1}
          height="100%"
          expandRows
          slotDuration="00:30:00"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          scrollTime="08:00:00"
          slotLabelFormat={formatSlotLabel}
          eventTimeFormat={formatEventTime}
          nowIndicator
          allDaySlot={false}
          businessHours={BUSINESS_HOURS}
          fixedWeekCount={false}
          dayMaxEvents={3}
          navLinks
          views={{
            timeGridWeek: { dayHeaderFormat: formatWeekHeader },
            timeGridDay: { dayHeaderFormat: formatDayHeader },
            dayGridMonth: { dayHeaderFormat: { weekday: 'short' }, eventDisplay: 'block' },
          }}
          events={eventInputs}
          eventContent={renderEventContent}
          eventMinHeight={22}
          eventInteractive
          eventClick={handleEventClick}
          eventDidMount={tagSessionElement}
          datesSet={handleDatesSet}
        />
      </div>

      <div className="px-4 py-2.5 border-t border-gray-200 flex items-center gap-4 text-xs text-muted-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-success-500" aria-hidden="true" /> Event
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-primary-500 bg-primary-50" aria-hidden="true" /> Work Session
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-primary-600" aria-hidden="true" /> Locked
        </span>
      </div>

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          project={getMockProjectForTask(selectedSession.taskId)}
          progress={progressById[selectedSession.id] ?? PLANNED_PROGRESS}
          timeZone={timeZone}
          onClose={closeDialog}
          onLockChange={handleLockChange}
          onProgressSave={handleProgressSave}
          onDelete={handleDeleteSession}
          getFallbackFocus={() => regionRef.current}
        />
      )}

      {selectedEvent && (
        <CalendarEventPopup
          event={selectedEvent}
          timeZone={timeZone}
          onClose={closeDialog}
          getFallbackFocus={() => regionRef.current}
        />
      )}
    </div>
  );
}