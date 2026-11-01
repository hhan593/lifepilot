/**
 * 演示数据：demo@lifepilot.app / Demo1234!
 * 运行：pnpm db:seed
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient, DrinkType } from '@prisma/client';

const prisma = new PrismaClient();
const TZ = 'Asia/Shanghai';

function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE', { timeZone: TZ }); // sv-SE → YYYY-MM-DD
}

async function main() {
  const email = 'demo@lifepilot.app';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('demo 用户已存在，跳过 seed');
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hash('Demo1234!'),
      timezone: TZ,
      settings: {
        create: {
          weightKg: 65,
          activityLevel: 'LIGHT',
          waterGoalMl: 2400, // 65*33 + 250(轻度活动) ≈ 2395 → 取整 2400
          cupSizeMl: 250,
          waterReminderTimes: ['10:00', '12:30', '15:00', '18:00', '21:00'],
        },
      },
      cities: {
        create: { name: '北京', latitude: 39.9042, longitude: 116.4074, isPrimary: true },
      },
    },
  });

  // ---- 待办：本周已完成 4 条 + 今日待办 3 条 + 未来 1 条 ----
  await prisma.todo.createMany({
    data: [
      { userId: user.id, title: '整理本周迭代纪要', priority: 'MEDIUM', completedAt: new Date(Date.now() - 3 * 86_400_000) },
      { userId: user.id, title: '给 API 加上 Swagger 注解', priority: 'HIGH', completedAt: new Date(Date.now() - 2 * 86_400_000) },
      { userId: user.id, title: '回复合作邮件', priority: 'LOW', completedAt: new Date(Date.now() - 1 * 86_400_000) },
      { userId: user.id, title: '预约体检', priority: 'MEDIUM', completedAt: new Date() },
      { userId: user.id, title: '准备周一晨会提纲', priority: 'HIGH' },
      { userId: user.id, title: '买本周的菜', priority: 'LOW' },
      { userId: user.id, title: '给爸妈打电话', priority: 'MEDIUM' },
      { userId: user.id, title: '提交季度 OKR', priority: 'URGENT', dueAt: new Date(Date.now() + 3 * 86_400_000) },
    ],
  });

  // ---- 喝水：过去 7 天随机量 ----
  const drinkTypes: DrinkType[] = ['WATER', 'TEA', 'COFFEE', 'WATER', 'WATER'];
  const logs: { userId: string; amountMl: number; drinkType: DrinkType; loggedAt: Date }[] = [];
  for (let d = 7; d >= 0; d--) {
    const cups = 6 + Math.floor(Math.random() * 5); // 6~10 杯
    for (let c = 0; c < cups; c++) {
      const loggedAt = new Date(Date.now() - d * 86_400_000 + (9 + c) * 3_600_000);
      logs.push({
        userId: user.id,
        amountMl: 250,
        drinkType: drinkTypes[(d + c) % drinkTypes.length],
        loggedAt,
      });
    }
  }
  await prisma.waterLog.createMany({ data: logs });

  // ---- 习惯：读书（周目标5）+ 跑步（周目标3）----
  const reading = await prisma.habit.create({
    data: { userId: user.id, name: '睡前读书 30 分钟', icon: '📚', color: '#8b5cf6', targetPerWeek: 5 },
  });
  const running = await prisma.habit.create({
    data: { userId: user.id, name: '跑步 3 公里', icon: '🏃', color: '#10b981', targetPerWeek: 3 },
  });

  const readingDays: string[] = [];
  for (let w = 0; w < 3; w++) {
    for (const offset of [1, 2, 4, 5, 6]) {
      const date = localDate(-(w * 7 + offset));
      if (date >= localDate(0)) continue;
      readingDays.push(date);
    }
  }
  const runningDays: string[] = [];
  for (const offset of [1, 3, 5, 8, 10]) {
    const date = localDate(-offset);
    if (date < localDate(0)) runningDays.push(date);
  }

  await prisma.habitCheckIn.createMany({
    data: [
      ...readingDays.map((date) => ({ habitId: reading.id, date })),
      ...runningDays.map((date) => ({ habitId: running.id, date })),
    ],
    skipDuplicates: true,
  });

  console.log(`seed 完成：${email} / Demo1234!（待办 8、喝水 ${logs.length} 条、习惯 2 个）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
