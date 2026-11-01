import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('LifePilot API（e2e）', () => {
  let app: INestApplication;
  let token: string;
  const email = `e2e-${Date.now()}@lifepilot.app`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('未登录访问受保护资源 → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('注册 → 拿到 accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Abcd1234' })
      .expect(201);
    expect(res.body.accessToken).toBeTruthy();
    token = res.body.accessToken;
  });

  it('重复注册 → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Abcd1234' })
      .expect(409);
  });

  it('GET /users/me → 当前用户', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body.settings.waterGoalMl).toBeGreaterThan(0);
  });

  it('待办：创建 → 今日可见 → 完成', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/todos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '写周报', priority: 'HIGH' })
      .expect(201);
    expect(created.body.completedAt).toBeNull();

    const today = await request(app.getHttpServer())
      .get('/api/v1/todos?view=today')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(today.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const done = await request(app.getHttpServer())
      .patch(`/api/v1/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true })
      .expect(200);
    expect(done.body.completedAt).toBeTruthy();
  });

  it('喝水：一键记录 → 汇总百分比增加', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/water/quick')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.summary.percent).toBeGreaterThan(0);
    expect(res.body.summary.hydrationMl).toBeGreaterThan(0);
  });

  it('习惯：创建 → 打卡 → 宽容连击数据', async () => {
    const habit = await request(app.getHttpServer())
      .post('/api/v1/habits')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '每天读书', targetPerWeek: 5 })
      .expect(201);

    const checkin = await request(app.getHttpServer())
      .post(`/api/v1/habits/${habit.body.id}/check-ins`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(checkin.body.checked).toBe(true);
    expect(checkin.body.streak).toHaveProperty('streakWeeks');
  });

  it('周报：手动生成 → 包含各模块数据', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/reports/weekly/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(res.body.todos).toHaveProperty('completionRate');
    expect(res.body.water).toHaveProperty('dailyMl');
    expect(res.body.markdown).toContain('周报');
  });

  it('刷新令牌旋转：refresh 后旧 cookie 作废', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Abcd1234' })
      .expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    expect(cookie?.length).toBeGreaterThan(0);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // 旧 refresh token 已被旋转作废
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });
});
