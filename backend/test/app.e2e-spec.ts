/**
 * E2E test cho API tuần 8 của Thành viên A, chạy trên PostgreSQL thật (DATABASE_URL trong .env).
 * Test tự tạo người dùng riêng với email ngẫu nhiên và xoá đi khi chạy xong,
 * nên không đụng vào dữ liệu seed. Cần chạy migrate + seed trước.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const RUN = Date.now().toString(36);
const emailA = `e2e-a-${RUN}@test.local`;
const emailB = `e2e-b-${RUN}@test.local`;
const PASSWORD = 'MatKhau@123';

describe('API tuần 8 — Thành viên A (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;

  const http = () => request(app.getHttpServer());
  const asA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const asB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  // ============================== AUTH ====================================
  describe('Auth', () => {
    it('register: tạo user, trả JWT, không lộ passwordHash', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: `  ${emailA.toUpperCase()} `, password: PASSWORD, displayName: 'Người A' })
        .expect(201);
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.accessToken.split('.')).toHaveLength(3);
      expect(res.body.user.email).toBe(emailA); // đã trim + lowercase
      expect(res.body.user.passwordHash).toBeUndefined();
      tokenA = res.body.accessToken;
      userAId = res.body.user.id;

      const b = await http()
        .post('/api/auth/register')
        .send({ email: emailB, password: PASSWORD, displayName: 'Người B' })
        .expect(201);
      tokenB = b.body.accessToken;
    });

    it('register: mật khẩu được băm bcrypt >= 10 rounds, có sẵn scheduler settings', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: emailA },
        include: { schedulerSetting: true },
      });
      expect(user.passwordHash).not.toContain(PASSWORD);
      expect(bcrypt.getRounds(user.passwordHash)).toBeGreaterThanOrEqual(10);
      expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);
      expect(user.schedulerSetting).not.toBeNull();
    });

    it('register: email trùng → 409; dữ liệu sai → 400; trường lạ → 400', async () => {
      await http().post('/api/auth/register').send({ email: emailA, password: PASSWORD, displayName: 'x' }).expect(409);
      await http().post('/api/auth/register').send({ email: 'khong-phai-email', password: PASSWORD, displayName: 'x' }).expect(400);
      await http().post('/api/auth/register').send({ email: `s-${RUN}@t.local`, password: 'ngan', displayName: 'x' }).expect(400);
      await http().post('/api/auth/register').send({ email: `t-${RUN}@t.local`, password: PASSWORD, displayName: 'x', timezone: 'Sao/Hoa' }).expect(400);
      await http().post('/api/auth/register').send({ email: `u-${RUN}@t.local`, password: PASSWORD, displayName: 'x', isAdmin: true }).expect(400);
    });

    it('login: đúng → 200 + token; sai mật khẩu hoặc email lạ → 401 cùng thông báo', async () => {
      const ok = await http().post('/api/auth/login').send({ email: emailA, password: PASSWORD }).expect(200);
      expect(ok.body.accessToken).toBeDefined();

      const wrongPass = await http().post('/api/auth/login').send({ email: emailA, password: 'SaiMatKhau1' }).expect(401);
      const noUser = await http().post('/api/auth/login').send({ email: `none-${RUN}@t.local`, password: PASSWORD }).expect(401);
      expect(wrongPass.body.message).toBe(noUser.body.message);
    });

    it('login: tài khoản seed demo@example.com / Demo@12345', async () => {
      await http().post('/api/auth/login').send({ email: 'demo@example.com', password: 'Demo@12345' }).expect(200);
    });

    it('me: có token → thông tin user; không token / token sai → 401', async () => {
      const me = await asA(http().get('/api/auth/me')).expect(200);
      expect(me.body).toMatchObject({ id: userAId, email: emailA, displayName: 'Người A' });
      expect(me.body.passwordHash).toBeUndefined();

      await http().get('/api/auth/me').expect(401);
      await http().get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
      await http().get('/api/tasks').expect(401); // JwtAuthGuard bảo vệ mọi route
    });
  });

  // ============================== TASKS ===================================
  describe('Tasks CRUD', () => {
    let t1: string;
    let t2: string;
    let t3: string;

    it('POST: tạo task, remainingMinutes mặc định = estimatedMinutes, trả về ISO UTC', async () => {
      const res = await asA(http().post('/api/tasks'))
        .send({ title: '  Viết báo cáo  ', estimatedMinutes: 120, priority: 'HIGH', deadline: '2026-11-10T17:00:00+07:00' })
        .expect(201);
      expect(res.body).toMatchObject({
        title: 'Viết báo cáo',
        status: 'TODO',
        priority: 'HIGH',
        estimatedMinutes: 120,
        remainingMinutes: 120,
        deadline: '2026-11-10T10:00:00.000Z', // RSK-02: lưu và trả UTC
        dependencyIds: [],
        completedAt: null,
      });
      t1 = res.body.id;
    });

    it('POST: có dependencyIds', async () => {
      t2 = (await asA(http().post('/api/tasks')).send({ title: 'Task 2', estimatedMinutes: 60, dependencyIds: [t1] }).expect(201)).body.id;
      const r3 = await asA(http().post('/api/tasks')).send({ title: 'Task 3', estimatedMinutes: 30, dependencyIds: [t2] }).expect(201);
      t3 = r3.body.id;
      expect(r3.body.dependencyIds).toEqual([t2]);
    });

    it('POST: dữ liệu sai → 400', async () => {
      await asA(http().post('/api/tasks')).send({ title: 'x' }).expect(400); // thiếu estimatedMinutes
      await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 0 }).expect(400);
      await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, priority: 'SIEU_CAO' }).expect(400);
      // Thiếu múi giờ → mơ hồ, bị từ chối (RSK-02)
      await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, deadline: '2026-11-10T17:00:00' }).expect(400);
      await asA(http().post('/api/tasks'))
        .send({ title: 'x', estimatedMinutes: 10, earliestStart: '2026-11-10T00:00:00Z', deadline: '2026-11-09T00:00:00Z' })
        .expect(400);
      await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, dependencyIds: ['00000000-0000-4000-8000-000000000000'] }).expect(400);
      await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, projectId: '00000000-0000-4000-8000-000000000000' }).expect(400);
    });

    it('GET: danh sách, lọc theo status', async () => {
      const all = await asA(http().get('/api/tasks')).expect(200);
      expect(all.body.map((t: { id: string }) => t.id)).toEqual(expect.arrayContaining([t1, t2, t3]));

      await asA(http().patch(`/api/tasks/${t3}`)).send({ status: 'IN_PROGRESS' }).expect(200);
      const filtered = await asA(http().get('/api/tasks?status=IN_PROGRESS,PAUSED')).expect(200);
      expect(filtered.body.map((t: { id: string }) => t.id)).toEqual([t3]);
      await asA(http().get('/api/tasks?status=SAI')).expect(400);
    });

    it('PATCH status = DONE → remainingMinutes = 0, completedAt được đặt (DoD)', async () => {
      await asA(http().patch(`/api/tasks/${t1}`)).send({ remainingMinutes: 45 }).expect(200);
      const res = await asA(http().patch(`/api/tasks/${t1}`)).send({ status: 'DONE', remainingMinutes: 999 }).expect(200);
      expect(res.body.status).toBe('DONE');
      expect(res.body.remainingMinutes).toBe(0);
      expect(res.body.completedAt).not.toBeNull();

      const inDb = await prisma.task.findUniqueOrThrow({ where: { id: t1 } });
      expect(inDb.remainingMinutes).toBe(0);
    });

    it('PATCH mở lại task DONE → completedAt = null, remaining về estimatedMinutes (hoặc giá trị gửi lên)', async () => {
      const reopened = await asA(http().patch(`/api/tasks/${t1}`)).send({ status: 'TODO' }).expect(200);
      expect(reopened.body).toMatchObject({ status: 'TODO', remainingMinutes: 120, completedAt: null });

      await asA(http().patch(`/api/tasks/${t1}`)).send({ status: 'DONE' }).expect(200);
      const custom = await asA(http().patch(`/api/tasks/${t1}`)).send({ status: 'IN_PROGRESS', remainingMinutes: 15 }).expect(200);
      expect(custom.body.remainingMinutes).toBe(15);
    });

    it('POST status = DONE ngay khi tạo → remainingMinutes = 0', async () => {
      const res = await asA(http().post('/api/tasks')).send({ title: 'Xong rồi', estimatedMinutes: 50, status: 'DONE' }).expect(201);
      expect(res.body.remainingMinutes).toBe(0);
      await asA(http().delete(`/api/tasks/${res.body.id}`)).expect(204);
    });

    it('PATCH: không cho sửa estimatedMinutes; earliestStart mới phải trước deadline cũ', async () => {
      await asA(http().patch(`/api/tasks/${t1}`)).send({ estimatedMinutes: 10 }).expect(400);
      await asA(http().patch(`/api/tasks/${t1}`)).send({ earliestStart: '2026-12-01T00:00:00Z' }).expect(400);
    });

    it('PATCH dependencyIds: chặn vòng lặp và tự phụ thuộc', async () => {
      // t1 → t2 → t3. Cho t1 chờ t3 sẽ tạo vòng.
      await asA(http().patch(`/api/tasks/${t1}`)).send({ dependencyIds: [t3] }).expect(400);
      await asA(http().patch(`/api/tasks/${t1}`)).send({ dependencyIds: [t1] }).expect(400);
      // Thay thế danh sách: t3 chờ t1 thay vì t2 — hợp lệ.
      const ok = await asA(http().patch(`/api/tasks/${t3}`)).send({ dependencyIds: [t1] }).expect(200);
      expect(ok.body.dependencyIds).toEqual([t1]);
      // Bây giờ t2 chờ t3 là hợp lệ (t1 → t3 → t2), không còn vòng.
      await asA(http().patch(`/api/tasks/${t2}`)).send({ dependencyIds: [t1, t3] }).expect(200);
      // [] xoá hết phụ thuộc
      const cleared = await asA(http().patch(`/api/tasks/${t2}`)).send({ dependencyIds: [] }).expect(200);
      expect(cleared.body.dependencyIds).toEqual([]);
    });

    it('Người khác không đọc / sửa / xoá / phụ thuộc được task của A (404 hoặc 400)', async () => {
      await asB(http().get(`/api/tasks/${t1}`)).expect(404);
      await asB(http().patch(`/api/tasks/${t1}`)).send({ title: 'hack' }).expect(404);
      await asB(http().delete(`/api/tasks/${t1}`)).expect(404);
      await asB(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, dependencyIds: [t1] }).expect(400);
      const listB = await asB(http().get('/api/tasks')).expect(200);
      expect(listB.body).toEqual([]);

      // Project của seed user khác cũng không gắn được
      const seedProject = await prisma.project.findFirst({ where: { user: { email: 'demo@example.com' } } });
      if (seedProject) {
        await asA(http().post('/api/tasks')).send({ title: 'x', estimatedMinutes: 10, projectId: seedProject.id }).expect(400);
      }
    });

    it('DELETE: 204, sau đó 404; id không phải UUID → 400', async () => {
      await asA(http().delete(`/api/tasks/${t3}`)).expect(204);
      await asA(http().get(`/api/tasks/${t3}`)).expect(404);
      await asA(http().delete(`/api/tasks/${t3}`)).expect(404);
      await asA(http().get('/api/tasks/khong-phai-uuid')).expect(400);
    });
  });

  // ========================= WORKING HOURS ================================
  describe('Working hours', () => {
    it('GET khi chưa có → [] kèm timezone', async () => {
      const res = await asA(http().get('/api/users/working-hours')).expect(200);
      expect(res.body).toEqual({ timezone: 'Asia/Ho_Chi_Minh', workingHours: [] });
    });

    it('PUT thay toàn bộ, nhiều khung một ngày, trả đúng dạng Contract v2', async () => {
      const body = {
        workingHours: [
          { dayOfWeek: 1, startTime: '13:30', endTime: '17:00' },
          { dayOfWeek: 1, startTime: '08:00', endTime: '11:30' },
          { dayOfWeek: 6, startTime: '20:00', endTime: '24:00' },
        ],
      };
      const res = await asA(http().put('/api/users/working-hours')).send(body).expect(200);
      expect(res.body.workingHours.map(({ id, ...s }: { id: string }) => s)).toEqual([
        { dayOfWeek: 1, startTime: '08:00', endTime: '11:30' },
        { dayOfWeek: 1, startTime: '13:30', endTime: '17:00' },
        { dayOfWeek: 6, startTime: '20:00', endTime: '24:00' },
      ]);
      const rows = await prisma.workingHours.findMany({ where: { userId: userAId }, orderBy: { startMinute: 'asc' } });
      expect(rows.map((r) => [r.weekday, r.startMinute, r.endMinute])).toEqual([
        [1, 480, 690],
        [1, 810, 1020],
        [6, 1200, 1440],
      ]);

      // PUT lần 2 thay thế, không cộng dồn
      const again = await asA(http().put('/api/users/working-hours'))
        .send({ workingHours: [{ dayOfWeek: 0, startTime: '09:00', endTime: '10:00' }] })
        .expect(200);
      expect(again.body.workingHours).toHaveLength(1);
    });

    it('PUT dữ liệu sai → 400 và giữ nguyên dữ liệu cũ', async () => {
      const bad = [
        [{ dayOfWeek: 7, startTime: '08:00', endTime: '09:00' }],
        [{ dayOfWeek: 1, startTime: '8:00', endTime: '09:00' }],
        [{ dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }],
        [{ dayOfWeek: 1, startTime: '25:00', endTime: '26:00' }],
        [
          { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' },
          { dayOfWeek: 2, startTime: '11:00', endTime: '13:00' },
        ],
      ];
      for (const workingHours of bad) {
        await asA(http().put('/api/users/working-hours')).send({ workingHours }).expect(400);
      }
      const res = await asA(http().get('/api/users/working-hours')).expect(200);
      expect(res.body.workingHours).toHaveLength(1);
    });

    it('Mỗi người chỉ thấy giờ làm của mình', async () => {
      const res = await asB(http().get('/api/users/working-hours')).expect(200);
      expect(res.body.workingHours).toEqual([]);
    });
  });

  // ========================= CALENDAR EVENTS ==============================
  describe('Calendar events', () => {
    let weekly: string;

    it('POST sự kiện thường, lưu UTC', async () => {
      const res = await asA(http().post('/api/calendar/events'))
        .send({ title: 'Họp nhóm', startAt: '2026-11-02T20:00:00+07:00', endAt: '2026-11-02T21:00:00+07:00' })
        .expect(201);
      expect(res.body).toMatchObject({
        title: 'Họp nhóm',
        startAt: '2026-11-02T13:00:00.000Z',
        endAt: '2026-11-02T14:00:00.000Z',
        source: 'INTERNAL',
        recurrenceRule: null,
      });
    });

    it('POST sự kiện lặp + override dời một buổi', async () => {
      const r = await asA(http().post('/api/calendar/events'))
        .send({
          title: 'Lớp CO3005',
          startAt: '2026-10-05T00:30:00Z',
          endAt: '2026-10-05T02:30:00Z',
          recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE',
          timezone: 'Asia/Ho_Chi_Minh',
          excludedDates: ['2026-11-04T00:30:00Z'],
        })
        .expect(201);
      weekly = r.body.id;
      expect(r.body.excludedDates).toEqual(['2026-11-04T00:30:00.000Z']);

      await asA(http().post('/api/calendar/events'))
        .send({
          title: 'Lớp CO3005 (dời)',
          startAt: '2026-11-09T06:30:00Z',
          endAt: '2026-11-09T08:30:00Z',
          recurringEventId: weekly,
          originalStartAt: '2026-11-09T00:30:00Z',
        })
        .expect(201);
    });

    it('POST dữ liệu sai → 400', async () => {
      const base = { title: 'x', startAt: '2026-11-02T10:00:00Z', endAt: '2026-11-02T11:00:00Z' };
      await asA(http().post('/api/calendar/events')).send({ ...base, endAt: base.startAt }).expect(400);
      await asA(http().post('/api/calendar/events')).send({ ...base, startAt: '2026-11-02 10:00' }).expect(400);
      await asA(http().post('/api/calendar/events')).send({ ...base, recurrenceRule: 'mỗi thứ hai' }).expect(400);
      await asA(http().post('/api/calendar/events')).send({ ...base, recurringEventId: weekly }).expect(400); // thiếu originalStartAt
      await asA(http().post('/api/calendar/events')).send({ ...base, source: 'GOOGLE' }).expect(400);
      // B không override được sự kiện của A
      await asB(http().post('/api/calendar/events'))
        .send({ ...base, recurringEventId: weekly, originalStartAt: '2026-11-11T00:30:00Z' })
        .expect(400);
    });

    it('GET lọc theo khoảng: lấy sự kiện giao khoảng + mọi sự kiện lặp bắt đầu trước "to"', async () => {
      const res = await asA(http().get('/api/calendar/events?from=2026-11-02T00:00:00Z&to=2026-11-03T00:00:00Z')).expect(200);
      const titles = res.body.map((e: { title: string }) => e.title);
      expect(titles).toEqual(expect.arrayContaining(['Họp nhóm', 'Lớp CO3005']));
      expect(titles).not.toContain('Lớp CO3005 (dời)'); // 09/11, ngoài khoảng

      const early = await asA(http().get('/api/calendar/events?to=2026-10-01T00:00:00Z')).expect(200);
      expect(early.body).toEqual([]);
      await asA(http().get('/api/calendar/events?from=2026-11-03T00:00:00Z&to=2026-11-02T00:00:00Z')).expect(400);

      const all = await asA(http().get('/api/calendar/events')).expect(200);
      expect(all.body).toHaveLength(3);
      const other = await asB(http().get('/api/calendar/events')).expect(200);
      expect(other.body).toEqual([]);
    });

    it('PATCH / DELETE: xoá sự kiện lặp gốc thì override bị xoá theo', async () => {
      const upd = await asA(http().patch(`/api/calendar/events/${weekly}`)).send({ title: 'Lớp PPL' }).expect(200);
      expect(upd.body.title).toBe('Lớp PPL');
      await asB(http().delete(`/api/calendar/events/${weekly}`)).expect(404);
      await asA(http().delete(`/api/calendar/events/${weekly}`)).expect(204);
      const all = await asA(http().get('/api/calendar/events')).expect(200);
      expect(all.body.map((e: { title: string }) => e.title)).toEqual(['Họp nhóm']);
    });
  });
});
