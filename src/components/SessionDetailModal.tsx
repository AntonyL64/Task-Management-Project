import { useId, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Lock, Trash2, Unlock, X, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Project, WorkSession } from '../types/domain';
import { SESSION_STATUS_LABEL } from '../types/sessionProgress';
import type { SessionProgress, SessionStatus } from '../types/sessionProgress';
import { formatDay, formatMinutesShort, formatTimeRange, minutesBetween } from '../lib/sessionTime';
import type { CalendarTimeZone } from '../lib/sessionTime';
import { useDialogA11y } from '../hooks/useDialogA11y';
import '../styles/dialog.css';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface SessionDetailModalProps {
  /** The session to show. Controlled: the lock switch always reflects `session.isLocked`. */
  session: WorkSession;
  /** Project of the session's task (for the badge). */
  project?: Project;
  /** Last saved progress of this session. */
  progress: SessionProgress;
  timeZone: CalendarTimeZone;
  onClose: () => void;
  /** Called immediately when the lock switch is toggled. */
  onLockChange: (sessionId: string, isLocked: boolean) => void;
  /** Called by "Update Session" with the validated progress. The modal then closes itself. */
  onProgressSave: (sessionId: string, progress: SessionProgress) => void;
  /** Called after the delete confirmation. The modal then closes itself. */
  onDelete: (sessionId: string) => void;
  /** Where focus goes on close if the session's calendar event no longer exists (after a delete). */
  getFallbackFocus?: () => HTMLElement | null;
}

/* -------------------------------------------------------------------------- */
/* Progress draft                                                             */
/* -------------------------------------------------------------------------- */

/** What the user has picked so far; nothing is saved until "Update Session". */
interface Draft {
  status: SessionStatus;
  /** Text of the partial-minutes input (kept as text so it can be empty / mid-typing). */
  partialText: string;
}

function draftFromProgress(progress: SessionProgress): Draft {
  return {
    status: progress.status,
    partialText: progress.status === 'PARTIAL' && progress.actualMinutes !== null ? String(progress.actualMinutes) : '',
  };
}

interface ResolvedDraft {
  progress: SessionProgress | null;
  error: string | null;
}

/** Turns the draft into a SessionProgress, or explains why it can't be saved. */
function resolveDraft(draft: Draft, plannedMinutes: number): ResolvedDraft {
  switch (draft.status) {
    case 'PLANNED':
      return { progress: { status: 'PLANNED', actualMinutes: null }, error: null };
    case 'COMPLETED':
      return { progress: { status: 'COMPLETED', actualMinutes: plannedMinutes }, error: null };
    case 'MISSED':
      return { progress: { status: 'MISSED', actualMinutes: 0 }, error: null };
    case 'PARTIAL': {
      const minutes = Number(draft.partialText);
      const max = plannedMinutes - 1;
      if (draft.partialText.trim() === '' || !Number.isInteger(minutes) || minutes < 1 || minutes > max) {
        return {
          progress: null,
          error: `Enter a whole number from 1 to ${max}. For a full session use “Mark as Done”.`,
        };
      }
      return { progress: { status: 'PARTIAL', actualMinutes: minutes }, error: null };
    }
  }
}

function describeProgress(progress: SessionProgress, plannedMinutes: number): string {
  switch (progress.status) {
    case 'PLANNED':
      return 'No progress recorded yet.';
    case 'COMPLETED':
      return `Will record ${plannedMinutes} of ${plannedMinutes} min as completed.`;
    case 'PARTIAL':
      return `Will record ${progress.actualMinutes ?? 0} of ${plannedMinutes} min as partially done.`;
    case 'MISSED':
      return 'Will record this session as missed (0 min worked).';
  }
}

const STATUS_CHIP: Record<SessionStatus, string> = {
  PLANNED: 'bg-muted-50 text-muted-600',
  COMPLETED: 'bg-success-50 text-success-700',
  PARTIAL: 'bg-warning-50 text-warning-700',
  MISSED: 'bg-danger-50 text-danger-700',
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Render it only while a session is selected (`{selected && <SessionDetailModal … />}`):
 * mounting gives it a fresh draft each time.
 */
export default function SessionDetailModal({
  session,
  project,
  progress,
  timeZone,
  onClose,
  onLockChange,
  onProgressSave,
  onDelete,
  getFallbackFocus,
}: SessionDetailModalProps) {
  const uid = useId();
  const ids = {
    heading: `${uid}-heading`,
    lockLabel: `${uid}-lock-label`,
    lockHint: `${uid}-lock-hint`,
    partial: `${uid}-partial`,
    partialError: `${uid}-partial-error`,
    deleteHint: `${uid}-delete-hint`,
  };

  const { dialogRef, handleKeyDown } = useDialogA11y({ onClose, getFallbackFocus });

  const [draft, setDraft] = useState<Draft>(() => draftFromProgress(progress));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // const plannedMinutes = useMemo(() => minutesBetween(session.startAt, session.endAt), [session.startAt, session.endAt]);
  const startIso = session.startAt ?? (session as unknown as { start?: string }).start ?? '';
  const endIso = session.endAt ?? (session as unknown as { end?: string }).end ?? '';
  const plannedMinutes = useMemo(() => minutesBetween(startIso, endIso), [startIso, endIso]);

  const resolved = resolveDraft(draft, plannedMinutes);
  const isDirty =
    resolved.progress !== null &&
    (resolved.progress.status !== progress.status || resolved.progress.actualMinutes !== progress.actualMinutes);
  const canSave = resolved.progress !== null && isDirty;
  const canDelete = !session.isLocked;

  const toggleStatus = (status: 'COMPLETED' | 'MISSED') =>
    setDraft((prev) => ({ status: prev.status === status ? 'PLANNED' : status, partialText: '' }));

  const changePartial = (text: string) =>
    setDraft((prev) => ({
      partialText: text,
      // typing selects "partial"; emptying the box leaves it
      status: text.trim() !== '' ? 'PARTIAL' : prev.status === 'PARTIAL' ? 'PLANNED' : prev.status,
    }));

  const handleUpdate = () => {
    if (!resolved.progress || !canSave) return;
    onProgressSave(session.id, resolved.progress);
    onClose();
  };

  const handleDelete = () => {
    onDelete(session.id);
    onClose();
  };

  const outcomeButton = (active: boolean, tone: 'success' | 'danger') =>
    cn(
      'inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      active
        ? tone === 'success'
          ? 'bg-success-600 border-success-600 text-white'
          : 'bg-danger-600 border-danger-600 text-white'
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
    );

  const partialShown = draft.status === 'PARTIAL';
  const showPartialError = partialShown && resolved.error !== null;

  return (
    <div
      className="tempo-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      // mousedown (not click): dragging a text selection out of the dialog must not dismiss it
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="tempo-dialog-panel w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 outline-none"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 id={ids.heading} className="text-xl font-semibold text-text truncate" title={session.taskTitle}>
              {session.taskTitle}
            </h2>
            {project && (
              <span
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ color: project.color, backgroundColor: `${project.color}1A` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
                {project.name}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 -mt-1 rounded-lg text-gray-400 hover:text-text hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Metadata */}
          <section aria-label="Session time" className="space-y-2">
            <div className="flex items-center gap-2.5 text-sm text-muted-600">
              <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
              {formatDay(startIso, timeZone)}
            </div>
            <div className="flex items-center gap-2.5 text-sm font-medium text-text">
              <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
              <span>
                {formatTimeRange(startIso, endIso, timeZone)} ({formatMinutesShort(plannedMinutes)})
              </span>
            </div>
          </section>

          {/* Lock switch */}
          <section className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className={cn(
                  'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                  session.isLocked ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                )}
                aria-hidden="true"
              >
                {session.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </span>
              <div>
                <p id={ids.lockLabel} className="text-sm font-medium text-text">
                  {session.isLocked ? 'Locked' : 'Unlocked'}
                </p>
                <p id={ids.lockHint} className="text-xs text-muted-500 mt-0.5">
                  A locked session keeps its time when the schedule is recalculated. Changes apply immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={session.isLocked}
              aria-labelledby={ids.lockLabel}
              aria-describedby={ids.lockHint}
              onClick={() => onLockChange(session.id, !session.isLocked)}
              className={cn(
                'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                session.isLocked ? 'bg-primary-500' : 'bg-gray-300'
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform',
                  session.isLocked ? 'translate-x-5' : 'translate-x-0'
                )}
                aria-hidden="true"
              >
                {session.isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-primary-600" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-gray-500" />
                )}
              </span>
            </button>
          </section>

          {/* Progress (M5) */}
          <section aria-labelledby={`${uid}-progress-heading`}>
            <div className="flex items-center justify-between mb-3">
              <h3 id={`${uid}-progress-heading`} className="text-sm font-semibold text-text">
                Session progress
              </h3>
              <span
                className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CHIP[progress.status])}
                aria-label={`Saved status: ${SESSION_STATUS_LABEL[progress.status]}`}
              >
                {SESSION_STATUS_LABEL[progress.status]}
                {progress.actualMinutes !== null && progress.status !== 'PLANNED' && ` · ${progress.actualMinutes}/${plannedMinutes}m`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={draft.status === 'COMPLETED'}
                onClick={() => toggleStatus('COMPLETED')}
                className={outcomeButton(draft.status === 'COMPLETED', 'success')}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Mark as Done
              </button>
              <button
                type="button"
                aria-pressed={draft.status === 'MISSED'}
                onClick={() => toggleStatus('MISSED')}
                className={outcomeButton(draft.status === 'MISSED', 'danger')}
              >
                <XCircle className="w-4 h-4" aria-hidden="true" />
                Missed Session
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor={ids.partial} className="block text-sm font-medium text-text mb-1.5">
                Partial completion
              </label>
              <div className="flex items-center gap-2.5">
                <div className="relative w-32">
                  <input
                    id={ids.partial}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(1, plannedMinutes - 1)}
                    step={1}
                    value={draft.partialText}
                    onChange={(event) => changePartial(event.target.value)}
                    placeholder="e.g. 30"
                    aria-invalid={showPartialError}
                    aria-describedby={showPartialError ? ids.partialError : undefined}
                    className={cn(
                      'w-full px-3.5 py-2.5 pr-12 border rounded-lg text-sm bg-white text-text placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                      showPartialError ? 'border-danger-500' : 'border-gray-200'
                    )}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-500 pointer-events-none">
                    min
                  </span>
                </div>
                <span className="text-sm text-muted-500">of {plannedMinutes} min actually worked</span>
              </div>
              {showPartialError && (
                <p id={ids.partialError} role="alert" className="mt-1.5 text-xs text-danger-600">
                  {resolved.error}
                </p>
              )}
            </div>

            {resolved.progress && isDirty && (
              <p className="mt-3 text-xs text-muted-600" aria-live="polite">
                {describeProgress(resolved.progress, plannedMinutes)}
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          {confirmingDelete ? (
            <div>
              <p className="text-sm text-text mb-3">
                Delete this session?
                <span className="block text-xs text-muted-500 mt-0.5">
                  The task keeps its remaining time, so it can be scheduled again.
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-muted-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Keep session
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-danger-600 hover:bg-danger-700 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  disabled={!canDelete}
                  aria-describedby={canDelete ? undefined : ids.deleteHint}
                  onClick={() => setConfirmingDelete(true)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
                    canDelete
                      ? 'border-danger-100 bg-white text-danger-600 hover:bg-danger-50'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Delete session
                </button>
                {!canDelete && (
                  <p id={ids.deleteHint} className="mt-1 text-xs text-muted-500">
                    Unlock the session to delete it.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!canSave}
                onClick={handleUpdate}
                className={cn(
                  'px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  canSave ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                )}
              >
                Update Session
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
