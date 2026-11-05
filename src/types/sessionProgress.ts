/**
 * UI-side progress of a work session (module M5: session lifecycle).
 *
 * Deliberately NOT part of `WorkSession` in domain.ts: that type is Member B's
 * contract with the scheduler, and it has no notion of "done / partial / missed"
 * yet. Until the contract grows these fields, the Calendar keeps this next to
 * the sessions, keyed by session id.
 */

export type SessionStatus = 'PLANNED' | 'COMPLETED' | 'PARTIAL' | 'MISSED';

export interface SessionProgress {
  status: SessionStatus;
  /**
   * Minutes actually worked. `null` while PLANNED; the planned length when
   * COMPLETED; 1..planned-1 when PARTIAL; 0 when MISSED.
   */
  actualMinutes: number | null;
}

export const PLANNED_PROGRESS: SessionProgress = { status: 'PLANNED', actualMinutes: null };

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  PLANNED: 'Planned',
  COMPLETED: 'Completed',
  PARTIAL: 'Partially done',
  MISSED: 'Missed',
};

export function isSessionStatus(value: unknown): value is SessionStatus {
  return value === 'PLANNED' || value === 'COMPLETED' || value === 'PARTIAL' || value === 'MISSED';
}
