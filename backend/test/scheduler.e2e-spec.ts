/**
 * E2E cho SchedulerModule: POST /api/scheduler/auto-schedule, /reschedule và /api/work-sessions.
 * Chạy với engine thật của Thành viên B (packages/scheduling-engine) và PostgreSQL thật.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { expandEvents } from '../src/scheduler/recurrence';

const RUN = Date.now().toString(36);
const email = `e2e-sched-${RUN}@test.local`;
const otherEmail = `e2e-sched-other-${RUN}@test.local`;
const VN_OFFSET_MIN = 7 * 60;

interface Session {
  id: string;
  taskId: string;
  start: string;
  end: string;
  durationMinutes: number;
  locked: boolean;
}

/** Phút trong ngày và ngày (theo giờ Việt Nam) của một thời điểm UTC. */
const vnClock = (iso: string) => {
  const local = Date.parse(iso) + VN_OFFSET_MIN * 60_000;
  return { day: Math.floor(local / 86_400_000), minute: Math.floor((local % 86_400_000) / 60_000) };
};
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);

/**
 * INV-06 của Contract v2: phút đã xếp + phút chưa xếp được = remainingMinutes.
 * (Engine có thể để lại mẩu < minSessionMinutes tuỳ giờ chạy test, nên kiểm tra bất biến
 * thay vì so một con số cố định.)
 */
function expectAccounted(body: { plannedSessions: Session[]; unscheduledTasks: { taskId: string; missingMinutes: number }[] }, taskId: string, remaining: number) {
  const planned = body.plannedSessions.filter((s) => s.taskId === taskId).reduce((n, s) => n + s.durationMinutes, 0);
  const missing = body.unscheduledTasks.filter((u) => u.taskId === taskId).reduce((n, u) => n + u.missingMinutes, 0);
  expect(planned + missing).toBe(remaining);
  expect(planned).toBeGreaterThan(0);
}

describe('Scheduler (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let t1: string;
  let t2: string;
  let sessions: Session[];

  const http = () => request(app.getHttpServer());
  const as = (r: request.Test, t = token) => r.set('Authorization', `Bearer ${t}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    token = (await http().post('/api/auth/register').send({ email, password: 'MatKhau@123', displayName: 'Sched' }).expect(201)).body.accessToken;
    otherToken = (await http().post('/api/auth/register').send({ email: otherEmail, password: 'MatKhau@123', displayName: 'Other' }).expect(201)).body.accessToken;

    // Làm việc 08:00–17:00 giờ VN cả 7 ngày, để test không phụ thuộc hôm nay là thứ mấy.
    await as(http().put('/api/users/working-hours'))
      .send({ workingHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '17:00' })) })
      .expect(200);

    const deadline = new Date(Date.now() + 5 * 86_400_000).toISOString();
    t1 = (await as(http().post('/api/tasks')).send({ title: 'Viết báo cáo', estimatedMinutes: 180, priority: 'HIGH', deadline }).expect(201)).body.id;
    t2 = (await as(http().post('/api/tasks')).send({ title: 'Nộp báo cáo', estimatedMinutes: 60, dependencyIds: [t1] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await app.close();
  });

  it('auto-schedule: xếp đủ số phút, trong giờ làm (giờ VN), đúng thứ tự phụ thuộc, lưu vào DB', async () => {
    const res = await as(http().post('/api/scheduler/auto-schedule')).send({ planningHorizonDays: 7 }).expect(200);
    sessions = res.body.plannedSessions;

    expect(res.body.runId).toBeDefined();
    expectAccounted(res.body, t1, 180);
    expectAccounted(res.body, t2, 60);

    for (const s of sessions) {
      const a = vnClock(s.start);
      const b = vnClock(s.end);
      expect(a.minute).toBeGreaterThanOrEqual(8 * 60); // không còn lệch 7 tiếng
      expect(b.day === a.day ? b.minute : b.minute + 1440).toBeLessThanOrEqual(17 * 60);
      expect(s.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(s.durationMinutes).toBeLessThanOrEqual(120);
    }
    const lastT1End = Math.max(...sessions.filter((s) => s.taskId === t1).map((s) => Date.parse(s.end)));
    for (const s of sessions.filter((x) => x.taskId === t2)) expect(Date.parse(s.start)).toBeGreaterThanOrEqual(lastT1End);

    const db = await prisma.workSession.findMany({ where: { user: { email } } });
    expect(db.map((s) => s.id).sort()).toEqual(sessions.map((s) => s.id).sort());
    expect(db.every((s) => s.schedulerRunId === res.body.runId && s.status === 'PLANNED')).toBe(true);
    const run = await prisma.schedulerRun.findUniqueOrThrow({ where: { id: res.body.runId } });
    expect(run).toMatchObject({ status: 'APPLIED', trigger: 'MANUAL', contractVersion: 2 });
  });

  it('auto-schedule chạy lại: thay phiên cũ, không nhân đôi', async () => {
    const res = await as(http().post('/api/scheduler/auto-schedule')).send({ planningHorizonDays: 7 }).expect(200);
    sessions = res.body.plannedSessions;
    const count = await prisma.workSession.count({ where: { user: { email }, status: 'PLANNED' } });
    expect(count).toBe(sessions.length);
  });

  it('GET /api/work-sessions trả phiên kèm taskTitle; PATCH khoá phiên', async () => {
    const list = await as(http().get('/api/work-sessions')).expect(200);
    expect(list.body).toHaveLength(sessions.length);
    expect(list.body[0]).toMatchObject({ taskTitle: expect.any(String), status: 'PLANNED', locked: false });

    const locked = await as(http().patch(`/api/work-sessions/${sessions[0].id}`)).send({ isLocked: true }).expect(200);
    expect(locked.body.locked).toBe(true);
    await as(http().patch(`/api/work-sessions/${sessions[0].id}`), otherToken).send({ isLocked: false }).expect(404);
  });

  it('auto-schedule giữ nguyên phiên đã khoá (cùng id, cùng giờ)', async () => {
    const pinned = sessions[0];
    const res = await as(http().post('/api/scheduler/auto-schedule')).send({ planningHorizonDays: 7 }).expect(200);
    sessions = res.body.plannedSessions;
    const still = sessions.find((s) => s.id === pinned.id);
    expect(still).toMatchObject({ start: pinned.start, end: pinned.end, locked: true });
    expectAccounted(res.body, pinned.taskId, pinned.taskId === t1 ? 180 : 60);
  });

  it('reschedule với sự kiện bận mới: chỉ dời phiên bị va chạm, phiên khác giữ nguyên id', async () => {
    const victim = sessions.find((s) => !s.locked)!;
    const others = sessions.filter((s) => s.id !== victim.id && !overlaps(s, victim));
    const ev = await as(http().post('/api/calendar/events'))
      .send({ title: 'Họp đột xuất', startAt: victim.start, endAt: victim.end })
      .expect(201);

    const res = await as(http().post('/api/scheduler/reschedule')).send({ newBusyEventId: ev.body.id }).expect(200);
    const after: Session[] = res.body.plannedSessions;

    expect(res.body.summary.moved).toBeGreaterThanOrEqual(1);
    expect(after.some((s) => s.id === victim.id)).toBe(false);
    for (const s of after) expect(overlaps(s, { start: victim.start, end: victim.end })).toBe(false);
    // Phiên không bị ảnh hưởng vẫn còn nguyên (Minimum Disruption)
    const afterIds = new Set(after.map((s) => s.id));
    const keptStable = others.filter((s) => afterIds.has(s.id)).length;
    expect(keptStable).toBeGreaterThanOrEqual(Math.max(0, others.length - 1));
    expectAccounted(res.body, t1, 180);

    const run = await prisma.schedulerRun.findUniqueOrThrow({ where: { id: res.body.runId } });
    expect(run.trigger).toBe('EVENT_CHANGED');
    sessions = after;
  });

  it('reschedule khi task xong: huỷ các phiên tương lai của task đó', async () => {
    await as(http().patch(`/api/tasks/${t2}`)).send({ status: 'DONE' }).expect(200);
    const res = await as(http().post('/api/scheduler/reschedule')).send({ completedTaskId: t2 }).expect(200);
    expect(res.body.plannedSessions.filter((s: Session) => s.taskId === t2)).toEqual([]);
    const left = await prisma.workSession.count({ where: { taskId: t2, status: 'PLANNED' } });
    expect(left).toBe(0);
  });

  it('lỗi đầu vào: 400 / 404 / 401', async () => {
    await as(http().post('/api/scheduler/auto-schedule')).send({ minSessionMinutes: 90, maxSessionMinutes: 60 }).expect(400);
    await as(http().post('/api/scheduler/auto-schedule')).send({ planningHorizonDays: 0 }).expect(400);
    await as(http().post('/api/scheduler/auto-schedule')).send({ tasks: [] }).expect(400); // client không tự gửi input
    const rec = await as(http().post('/api/calendar/events'))
      .send({ title: 'Lặp', startAt: '2026-11-02T01:00:00Z', endAt: '2026-11-02T02:00:00Z', recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' })
      .expect(201);
    await as(http().post('/api/scheduler/reschedule')).send({ newBusyEventId: rec.body.id }).expect(400);
    await as(http().post('/api/scheduler/reschedule'), otherToken).send({ newBusyEventId: rec.body.id }).expect(404);
    await as(http().post('/api/scheduler/reschedule'), otherToken).send({ completedTaskId: t1 }).expect(404);
    await http().post('/api/scheduler/auto-schedule').send({}).expect(401);
  });

  it('người dùng khác chạy auto-schedule không đụng tới phiên của người này', async () => {
    const before = await prisma.workSession.count({ where: { user: { email } } });
    const res = await as(http().post('/api/scheduler/auto-schedule'), otherToken).send({}).expect(200);
    expect(res.body.plannedSessions).toEqual([]); // chưa có task, chưa có giờ làm
    expect(await prisma.workSession.count({ where: { user: { email } } })).toBe(before);
  });
});

describe('Bung sự kiện lặp (recurrence.ts)', () => {
  const base = { timezone: null, excludedDates: [] as Date[], recurringEventId: null, originalStartAt: null };
  const from = Date.parse('2026-11-08T17:00:00Z'); // 00:00 Thứ Hai 09/11 giờ VN

  it('tôn trọng COUNT và ngày bắt đầu chuỗi', () => {
    const out = expandEvents(
      [{ ...base, id: 'e', startAt: new Date('2026-11-19T08:00:00Z'), endAt: new Date('2026-11-19T09:00:00Z'), recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH;COUNT=2' }],
      'Asia/Ho_Chi_Minh', from, from + 60 * 86_400_000,
    );
    expect(out.map((b) => b.start)).toEqual(['2026-11-19T08:00:00.000Z', '2026-11-26T08:00:00.000Z']);
  });

  it('tính thứ theo giờ địa phương: 06:30 Thứ Hai VN vẫn là Thứ Hai', () => {
    const out = expandEvents(
      [{ ...base, id: 'g', startAt: new Date('2026-11-08T23:30:00Z'), endAt: new Date('2026-11-09T00:30:00Z'), recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }],
      'Asia/Ho_Chi_Minh', from, from + 8 * 86_400_000,
    );
    expect(out.map((b) => b.start)).toEqual(['2026-11-08T23:30:00.000Z', '2026-11-15T23:30:00.000Z']);
  });

  it('INTERVAL=2, excludedDates và override', () => {
    const out = expandEvents(
      [
        { ...base, id: 'lop', startAt: new Date('2026-11-02T00:30:00Z'), endAt: new Date('2026-11-02T02:30:00Z'), recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', excludedDates: [new Date('2026-11-18T00:30:00Z')] },
        { ...base, id: 'doi', startAt: new Date('2026-11-16T06:00:00Z'), endAt: new Date('2026-11-16T08:00:00Z'), recurrenceRule: null, recurringEventId: 'lop', originalStartAt: new Date('2026-11-16T00:30:00Z') },
      ],
      'Asia/Ho_Chi_Minh', from, from + 21 * 86_400_000,
    );
    expect(out.map((b) => b.id)).toEqual(['doi']);
  });
});
