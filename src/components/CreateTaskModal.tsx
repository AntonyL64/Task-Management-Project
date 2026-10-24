import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, ChevronDown, Flame, Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ISODateString, Priority, Project, TaskInput, TaskStatus } from '../types/domain';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** The minimum a task needs to be offered as a prerequisite. */
export type DependencyOption = Pick<TaskInput, 'id' | 'title' | 'status'>;

export interface CreateTaskModalProps {
  isOpen: boolean;
  /** Called for the X button, Escape, backdrop click, Cancel, and after a successful submit. */
  onClose: () => void;
  /**
   * Called once with a complete, valid TaskInput (status 'TODO',
   * remainingMinutes = estimatedMinutes). `projectId` is passed as a second
   * argument because projects are a UI concern and are not part of the
   * TaskInput contract; a handler that only takes `(task)` still type-checks.
   * The modal closes itself afterwards, so the handler should only store the task.
   */
  onSubmit: (newTask: TaskInput, projectId: string) => void;
  projects: readonly Project[];
  /** Existing tasks the user can pick as prerequisites (dependencyIds). */
  existingTasks: readonly DependencyOption[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;
const DEFAULT_MINUTES = 60;

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  PAUSED: 'Paused',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

interface PriorityOption {
  value: Priority;
  label: string;
  /** Tinted look while not selected. */
  idle: string;
  /** Solid look while selected. */
  active: string;
}

// Distinct colour per level (not colour alone: URGENT also gets a flame icon).
const PRIORITY_OPTIONS: readonly PriorityOption[] = [
  {
    value: 'LOW',
    label: 'Low',
    idle: 'bg-muted-50 text-muted-600 border-muted-100 hover:border-muted-500',
    active: 'bg-muted-500 text-white border-muted-500',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    idle: 'bg-warning-50 text-warning-700 border-warning-100 hover:border-warning-500',
    active: 'bg-warning-600 text-white border-warning-600',
  },
  {
    value: 'HIGH',
    label: 'High',
    idle: 'bg-danger-50 text-danger-700 border-danger-100 hover:border-danger-500',
    active: 'bg-danger-500 text-white border-danger-500',
  },
  {
    value: 'URGENT',
    label: 'Urgent',
    idle: 'bg-danger-100 text-danger-700 border-danger-100 hover:border-danger-700',
    active: 'bg-danger-700 text-white border-danger-700',
  },
];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const INPUT_BASE =
  'w-full px-3.5 py-2.5 border rounded-lg text-sm bg-white text-text placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow';

/* -------------------------------------------------------------------------- */
/* Form state + validation                                                    */
/* -------------------------------------------------------------------------- */

interface FormState {
  title: string;
  projectId: string;
  /** Kept as a string so the field can be emptied while typing. */
  estimatedMinutes: string;
  priority: Priority;
  /** `datetime-local` value, e.g. "2026-09-25T17:00" (local time, no offset). */
  deadline: string;
  earliestStart: string;
  dependencyIds: string[];
}

type FieldName = 'title' | 'estimatedMinutes' | 'deadline' | 'earliestStart';
type FieldErrors = Partial<Record<FieldName, string>>;

function createInitialForm(projects: readonly Project[]): FormState {
  return {
    title: '',
    projectId: projects[0]?.id ?? '',
    estimatedMinutes: String(DEFAULT_MINUTES),
    priority: 'MEDIUM',
    deadline: '',
    earliestStart: '',
    dependencyIds: [],
  };
}

/**
 * Converts a `datetime-local` value (local time) to an ISO 8601 UTC string,
 * e.g. "2026-09-25T17:00" -> "2026-09-25T10:00:00.000Z" in UTC+7.
 * Empty or unparsable input -> null.
 */
function toISO(localValue: string): ISODateString | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.title.trim() === '') {
    errors.title = 'Title is required.';
  }

  const minutes = Number(form.estimatedMinutes);
  if (form.estimatedMinutes.trim() === '' || !Number.isInteger(minutes) || minutes <= 0) {
    errors.estimatedMinutes = 'Enter a whole number of minutes greater than 0.';
  }

  const deadline = toISO(form.deadline);
  const earliestStart = toISO(form.earliestStart);
  if (deadline && earliestStart && new Date(earliestStart) >= new Date(deadline)) {
    errors.earliestStart = 'Earliest start must be before the deadline.';
  }

  return errors;
}

function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `task-${crypto.randomUUID()}`;
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-text mb-1.5">
      {children}
      {optional && <span className="ml-1.5 text-xs font-normal text-muted-500">(optional)</span>}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-danger-600">
      {message}
    </p>
  );
}

interface DependencyPickerProps {
  options: readonly DependencyOption[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}

/**
 * Multi-select for prerequisites. A new task can never create a dependency
 * cycle (nothing depends on it yet), so every listed task is a valid choice.
 */
function DependencyPicker({ options, selectedIds, onChange }: DependencyPickerProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? options : options.filter((o) => o.title.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div>
      {selectedIds.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2" aria-label="Selected prerequisites">
          {selectedIds.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1.5 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
            >
              <span className="truncate">{byId.get(id)?.title ?? id}</span>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove prerequisite ${byId.get(id)?.title ?? id}`}
                className="p-0.5 rounded-full hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="relative border-b border-gray-100">
          <label htmlFor={searchId} className="sr-only">
            Search tasks
          </label>
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={searchId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50/50 focus:outline-none focus:bg-white placeholder:text-gray-400"
          />
        </div>

        {options.length === 0 ? (
          <p className="px-3.5 py-3 text-sm text-muted-500">No existing tasks to depend on yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3.5 py-3 text-sm text-muted-500">No tasks match “{query}”.</p>
        ) : (
          <ul className="max-h-40 overflow-y-auto divide-y divide-gray-50">
            {filtered.map((option) => {
              const checked = selectedSet.has(option.id);
              return (
                <li key={option.id}>
                  <label
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2 text-sm cursor-pointer hover:bg-gray-50',
                      'has-[:focus-visible]:bg-primary-50',
                      checked && 'bg-primary-50/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300 bg-white'
                      )}
                    >
                      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className={cn('flex-1 truncate', option.status === 'DONE' && 'text-gray-400')}>
                      {option.title}
                    </span>
                    {option.status !== 'TODO' && (
                      <span className="text-xs text-muted-500 flex-shrink-0">{STATUS_LABEL[option.status]}</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders nothing while closed. The form lives in an inner component that is
 * mounted only while open, so every opening starts from a clean form.
 */
export default function CreateTaskModal(props: CreateTaskModalProps) {
  if (!props.isOpen) return null;
  return <CreateTaskModalContent {...props} />;
}

function CreateTaskModalContent({ onClose, onSubmit, projects, existingTasks }: CreateTaskModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialForm(projects));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [attempted, setAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  const uid = useId();
  const ids = {
    heading: `${uid}-heading`,
    title: `${uid}-title`,
    project: `${uid}-project`,
    minutes: `${uid}-minutes`,
    deadline: `${uid}-deadline`,
    earliest: `${uid}-earliest`,
    titleError: `${uid}-title-error`,
    minutesError: `${uid}-minutes-error`,
    earliestError: `${uid}-earliest-error`,
  };

  // Offer every task except cancelled ones as a possible prerequisite.
  const dependencyOptions = useMemo(
    () => existingTasks.filter((t) => t.status !== 'CANCELLED'),
    [existingTasks]
  );

  const errors = validate(form);
  const visibleError = (field: FieldName): string | undefined =>
    attempted || touched[field] ? errors[field] : undefined;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const markTouched = (field: FieldName) => setTouched((prev) => ({ ...prev, [field]: true }));

  // Escape closes the modal wherever focus is.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Lock page scroll, focus the title, and give focus back on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  // Keep Tab / Shift+Tab inside the dialog.
  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const resetForm = () => {
    setForm(createInitialForm(projects));
    setTouched({});
    setAttempted(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      if (found.title) titleRef.current?.focus();
      else if (found.estimatedMinutes) minutesRef.current?.focus();
      return;
    }

    const minutes = Number(form.estimatedMinutes);
    const newTask: TaskInput = {
      id: generateTaskId(),
      title: form.title.trim(),
      estimatedMinutes: minutes,
      remainingMinutes: minutes, // nothing done yet
      deadline: toISO(form.deadline),
      earliestStart: toISO(form.earliestStart),
      priority: form.priority,
      status: 'TODO',
      dependencyIds: [...form.dependencyIds],
      createdAt: new Date().toISOString(),
    };

    onSubmit(newTask, form.projectId);
    resetForm();
    onClose();
  };

  const minutesValue = Number(form.estimatedMinutes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      // mousedown (not click) so dragging a text selection out of the dialog doesn't dismiss it
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.heading}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 id={ids.heading} className="text-xl font-semibold text-text">
              New task
            </h2>
            <p className="text-sm text-muted-500 mt-0.5">Tempo will find a slot for it on your calendar.</p>
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

        <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Title */}
            <div>
              <FieldLabel htmlFor={ids.title}>Title</FieldLabel>
              <input
                ref={titleRef}
                id={ids.title}
                type="text"
                value={form.title}
                maxLength={120}
                onChange={(e) => update('title', e.target.value)}
                onBlur={() => markTouched('title')}
                placeholder="e.g. Prepare weekly review"
                aria-required="true"
                aria-invalid={Boolean(visibleError('title'))}
                aria-describedby={visibleError('title') ? ids.titleError : undefined}
                className={cn(INPUT_BASE, visibleError('title') ? 'border-danger-500' : 'border-gray-200')}
              />
              <FieldError id={ids.titleError} message={visibleError('title')} />
            </div>

            {/* Project */}
            <div>
              <FieldLabel htmlFor={ids.project}>Project</FieldLabel>
              <div className="relative">
                <select
                  id={ids.project}
                  value={form.projectId}
                  onChange={(e) => update('projectId', e.target.value)}
                  className={cn(INPUT_BASE, 'appearance-none pr-10 border-gray-200')}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Estimated minutes */}
            <div>
              <FieldLabel htmlFor={ids.minutes}>Estimated duration</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-32">
                  <input
                    ref={minutesRef}
                    id={ids.minutes}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={form.estimatedMinutes}
                    onChange={(e) => update('estimatedMinutes', e.target.value)}
                    onBlur={() => markTouched('estimatedMinutes')}
                    aria-required="true"
                    aria-invalid={Boolean(visibleError('estimatedMinutes'))}
                    aria-describedby={visibleError('estimatedMinutes') ? ids.minutesError : undefined}
                    className={cn(
                      INPUT_BASE,
                      'pr-12',
                      visibleError('estimatedMinutes') ? 'border-danger-500' : 'border-gray-200'
                    )}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-500 pointer-events-none">
                    min
                  </span>
                </div>
                {DURATION_PRESETS.map((preset) => {
                  const selected = minutesValue === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        update('estimatedMinutes', String(preset));
                        markTouched('estimatedMinutes');
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                        selected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'bg-white border-gray-200 text-muted-600 hover:border-primary-500 hover:text-primary-600'
                      )}
                    >
                      {preset}m
                    </button>
                  );
                })}
              </div>
              <FieldError id={ids.minutesError} message={visibleError('estimatedMinutes')} />
            </div>

            {/* Priority */}
            <fieldset>
              <legend className="block text-sm font-medium text-text mb-1.5">Priority</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map((option) => {
                  const selected = form.priority === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 has-[:focus-visible]:ring-offset-1',
                        selected ? option.active : option.idle
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-priority`}
                        value={option.value}
                        checked={selected}
                        onChange={() => update('priority', option.value)}
                        className="sr-only"
                      />
                      {option.value === 'URGENT' && <Flame className="w-3.5 h-3.5" aria-hidden="true" />}
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Deadline + earliest start */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor={ids.deadline} optional>
                  Deadline
                </FieldLabel>
                <input
                  id={ids.deadline}
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => update('deadline', e.target.value)}
                  className={cn(INPUT_BASE, 'border-gray-200')}
                />
              </div>
              <div>
                <FieldLabel htmlFor={ids.earliest} optional>
                  Earliest start
                </FieldLabel>
                <input
                  id={ids.earliest}
                  type="datetime-local"
                  value={form.earliestStart}
                  onChange={(e) => update('earliestStart', e.target.value)}
                  aria-invalid={Boolean(visibleError('earliestStart'))}
                  aria-describedby={visibleError('earliestStart') ? ids.earliestError : undefined}
                  className={cn(INPUT_BASE, visibleError('earliestStart') ? 'border-danger-500' : 'border-gray-200')}
                />
                <FieldError id={ids.earliestError} message={visibleError('earliestStart')} />
              </div>
            </div>

            {/* Dependencies */}
            <div>
              <span className="block text-sm font-medium text-text mb-1.5">
                Prerequisites
                <span className="ml-1.5 text-xs font-normal text-muted-500">(optional)</span>
              </span>
              <DependencyPicker
                options={dependencyOptions}
                selectedIds={form.dependencyIds}
                onChange={(next) => update('dependencyIds', next)}
              />
              <p className="mt-1.5 text-xs text-muted-500">This task can only be scheduled after the selected tasks.</p>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-muted-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create task
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
