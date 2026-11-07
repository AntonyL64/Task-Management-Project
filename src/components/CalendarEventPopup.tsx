import { useId } from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import type { CalendarEvent } from '../types/domain';
import { formatDay, formatTimeRange, minutesBetween, formatMinutesShort } from '../lib/sessionTime';
import type { CalendarTimeZone } from '../lib/sessionTime';
import { useDialogA11y } from '../hooks/useDialogA11y';
import '../styles/dialog.css';

const SOURCE_LABEL: Partial<Record<NonNullable<CalendarEvent['source']>, string>> = {
  INTERNAL: 'Created in Tempo',
  GOOGLE: 'Google Calendar',
  ICS: 'Imported calendar (ICS)',
};

interface CalendarEventPopupProps {
  event: CalendarEvent;
  timeZone: CalendarTimeZone;
  onClose: () => void;
  getFallbackFocus?: () => HTMLElement | null;
}

/** Read-only details of a fixed event (meeting, imported calendar entry). */
export default function CalendarEventPopup({ event, timeZone, onClose, getFallbackFocus }: CalendarEventPopupProps) {
  const headingId = useId();
  const { dialogRef, handleKeyDown } = useDialogA11y({ onClose, getFallbackFocus });

  return (
    <div
      className="tempo-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="tempo-dialog-panel w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 outline-none"
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold text-text">
              {event.title}
            </h2>
            {event.source && (
              <span className="mt-1.5 inline-flex rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                {SOURCE_LABEL[event.source]}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 -mt-1 rounded-lg text-gray-400 hover:text-text hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center gap-2.5 text-sm text-muted-600">
            <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
            {formatDay(event.startAt, timeZone)}
          </div>
          <div className="flex items-center gap-2.5 text-sm font-medium text-text">
            <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
            {formatTimeRange(event.startAt, event.endAt, timeZone)} ({formatMinutesShort(minutesBetween(event.startAt, event.endAt))})
          </div>
          <p className="pt-2 text-xs text-muted-500">
            This is a fixed event, so it can’t be edited here. Tempo schedules your work around it.
          </p>
        </div>
      </div>
    </div>
  );
}
