import type { ISODateString } from '../types/domain';

/** Same meaning as the Calendar's `timeZone` prop. */
export type CalendarTimeZone = 'UTC' | 'local';

const zoneOptions = (timeZone: CalendarTimeZone): Intl.DateTimeFormatOptions =>
  timeZone === 'UTC' ? { timeZone: 'UTC' } : {};

/** Length of a session in whole minutes. */
export function minutesBetween(start: ISODateString, end: ISODateString): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

/** "09:00" (24-hour). */
function formatClock(iso: ISODateString, timeZone: CalendarTimeZone): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...zoneOptions(timeZone),
  }).format(new Date(iso));
}

/** "UTC", or the browser zone's short name ("GMT+7", "EDT"). */
function formatZone(iso: ISODateString, timeZone: CalendarTimeZone): string {
  if (timeZone === 'UTC') return 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date(iso));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'local time';
}

/** "09:00 – 10:15 UTC" */
export function formatTimeRange(start: ISODateString, end: ISODateString, timeZone: CalendarTimeZone): string {
  return `${formatClock(start, timeZone)} – ${formatClock(end, timeZone)} ${formatZone(start, timeZone)}`;
}

/** "Tue, Sep 22, 2026" */
export function formatDay(iso: ISODateString, timeZone: CalendarTimeZone): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...zoneOptions(timeZone),
  }).format(new Date(iso));
}

/** 75 -> "75m" */
export function formatMinutesShort(minutes: number): string {
  return `${minutes}m`;
}
