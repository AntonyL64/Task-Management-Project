/**
 * Bung sự kiện lịch (thường, lặp RRULE, override) thành các khoảng bận cho Scheduler.
 *
 * Viết riêng ở backend thay vì dùng expandRecurringEvents() của adapter vì bản đó
 * (tính đến 08/11) bỏ qua COUNT/UNTIL/INTERVAL, sinh buổi trước ngày bắt đầu chuỗi,
 * và tính thứ trong tuần theo UTC (sự kiện 06:30 sáng thứ Hai giờ VN bị tính là thứ Ba).
 *
 * Hỗ trợ: FREQ=DAILY|WEEKLY, INTERVAL, BYDAY (WEEKLY), COUNT, UNTIL, excludedDates
 * và override. Thứ trong tuần và giờ trong ngày được tính theo múi giờ của sự kiện
 * (hoặc của người dùng), đúng như người dùng nhìn thấy trên lịch.
 */
import type { BusyInterval } from './engine';

export interface EventRow {
  id: string;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
  timezone: string | null;
  excludedDates: Date[];
  recurringEventId: string | null;
  originalStartAt: Date | null;
}

const DAY_MS = 86_400_000;
const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/** Chặn vòng lặp vô hạn với RRULE không có COUNT/UNTIL: tối đa ~10 năm. */
const MAX_DAYS_SCANNED = 3660;

// ------------------------------ múi giờ -------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Độ lệch (phút) của múi giờ so với UTC tại thời điểm `ms`. VD Asia/Ho_Chi_Minh → +420. */
export function tzOffsetMinutes(tz: string, ms: number): number {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** Giờ địa phương (ngày tính bằng "ngày kể từ epoch" + giây trong ngày) → thời điểm UTC. */
function localToUtc(localDay: number, secondOfDay: number, tz: string): number {
  const naive = localDay * DAY_MS + secondOfDay * 1000;
  let utc = naive - tzOffsetMinutes(tz, naive) * 60_000;
  // Lần hai để đúng cả khi ranh giới DST nằm giữa naive và utc.
  utc = naive - tzOffsetMinutes(tz, utc) * 60_000;
  return utc;
}

function utcToLocal(ms: number, tz: string): { day: number; secondOfDay: number } {
  const local = ms + tzOffsetMinutes(tz, ms) * 60_000;
  const day = Math.floor(local / DAY_MS);
  return { day, secondOfDay: Math.floor((local - day * DAY_MS) / 1000) };
}

/** 0 = Chủ nhật … 6 = Thứ bảy, cho "ngày kể từ epoch" (01/01/1970 là Thứ năm). */
const weekdayOf = (day: number) => (((day + 4) % 7) + 7) % 7;

// ------------------------------ RRULE ---------------------------------------

interface Rule {
  freq: 'DAILY' | 'WEEKLY';
  interval: number;
  byDay: number[] | null;
  count: number | null;
  untilMs: number | null;
}

/** null nếu RRULE dùng tính năng chưa hỗ trợ (MONTHLY, YEARLY, BYMONTHDAY…). */
export function parseRule(rrule: string): Rule | null {
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, '')
      .split(';')
      .filter(Boolean)
      .map((kv) => kv.split('=') as [string, string]),
  );
  if (parts.FREQ !== 'DAILY' && parts.FREQ !== 'WEEKLY') return null;
  const supported = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL', 'WKST']);
  if (Object.keys(parts).some((k) => !supported.has(k))) return null;

  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',').map((d) => WEEKDAYS[d.slice(-2)])
    : null;
  if (byDay?.some((d) => d === undefined)) return null;

  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(parts.UNTIL);
    if (!m) return null;
    untilMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 23), +(m[5] ?? 59), +(m[6] ?? 59));
  }

  return {
    freq: parts.FREQ,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    byDay,
    count: parts.COUNT ? Number(parts.COUNT) : null,
    untilMs,
  };
}

/** Giờ bắt đầu (UTC ms) của mọi buổi trong chuỗi, theo thứ tự, dừng khi vượt `toMs`. */
export function occurrenceStarts(
  seriesStart: Date,
  rule: Rule,
  tz: string,
  toMs: number,
): number[] {
  const { day: startDay, secondOfDay } = utcToLocal(seriesStart.getTime(), tz);
  const startWeekday = weekdayOf(startDay);
  const byDay = rule.byDay ?? [startWeekday];
  // Tuần bắt đầu thứ Hai (WKST=MO mặc định của RFC 5545).
  const startWeekMonday = startDay - ((startWeekday + 6) % 7);

  const out: number[] = [];
  let generated = 0;
  for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
    const day = startDay + i;
    const matches =
      rule.freq === 'DAILY'
        ? i % rule.interval === 0
        : Math.floor((day - startWeekMonday) / 7) % rule.interval === 0 && byDay.includes(weekdayOf(day));
    if (!matches) continue;

    const startMs = localToUtc(day, secondOfDay, tz);
    if (startMs < seriesStart.getTime()) continue; // buổi trước điểm bắt đầu chuỗi
    if (rule.untilMs !== null && startMs > rule.untilMs) break;
    if (rule.count !== null && generated >= rule.count) break;
    if (startMs >= toMs) break;
    generated++; // COUNT tính cả buổi bị huỷ (đúng RFC 5545)
    out.push(startMs);
  }
  return out;
}

// --------------------------- bung toàn bộ lịch ------------------------------

/**
 * Trả về khoảng bận giao với [fromMs, toMs).
 * id của buổi lặp: `${eventId}_${startMs}` (giống quy ước của adapter Thành viên B).
 */
export function expandEvents(
  events: EventRow[],
  userTz: string,
  fromMs: number,
  toMs: number,
): BusyInterval[] {
  const overlaps = (s: number, e: number) => e > fromMs && s < toMs;
  const busy: BusyInterval[] = [];

  // Buổi gốc đã bị override thay thế: `${parentId}_${originalStartMs}`
  const overridden = new Set(
    events
      .filter((e) => e.recurringEventId && e.originalStartAt)
      .map((e) => `${e.recurringEventId}_${e.originalStartAt!.getTime()}`),
  );

  for (const ev of events) {
    const s = ev.startAt.getTime();
    const e = ev.endAt.getTime();
    const rule = ev.recurrenceRule ? parseRule(ev.recurrenceRule) : null;

    if (!ev.recurrenceRule || !rule) {
      // Sự kiện thường, override, hoặc RRULE chưa hỗ trợ (coi như buổi đầu tiên).
      if (overlaps(s, e)) busy.push({ id: ev.id, start: iso(s), end: iso(e), type: 'CALENDAR_EVENT' });
      continue;
    }

    const duration = e - s;
    const excluded = new Set(ev.excludedDates.map((d) => d.getTime()));
    for (const occ of occurrenceStarts(ev.startAt, rule, ev.timezone ?? userTz, toMs)) {
      if (excluded.has(occ) || overridden.has(`${ev.id}_${occ}`)) continue;
      if (overlaps(occ, occ + duration)) {
        busy.push({ id: `${ev.id}_${occ}`, start: iso(occ), end: iso(occ + duration), type: 'CALENDAR_EVENT' });
      }
    }
  }

  return busy.sort((a, b) => a.start.localeCompare(b.start));
}

const iso = (ms: number) => new Date(ms).toISOString();
