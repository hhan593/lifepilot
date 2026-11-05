import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { WaterReminderDedupe } from './water-reminder-dedupe';

describe('WaterReminderDedupe（喝水提醒跨实例去重）', () => {
  const set = jest.fn();
  const quit = jest.fn().mockResolvedValue('OK');
  const redis = { set, quit } as unknown as Redis;
  let dedupe: WaterReminderDedupe;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    dedupe = new WaterReminderDedupe(redis);
  });

  afterEach(() => jest.restoreAllMocks());

  it('首次占位放行，并以 SET NX EX 86400 写入带前缀的键', async () => {
    set.mockResolvedValue('OK');

    await expect(dedupe.claim('user-1', '2026-11-05', '09:30')).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith(
      'water:reminder:user-1|2026-11-05|09:30',
      '1',
      'EX',
      86_400,
      'NX',
    );
  });

  it('键已存在时返回 false（多实例 / 重启后不会重复推送）', async () => {
    set.mockResolvedValue(null);

    await expect(dedupe.claim('user-1', '2026-11-05', '09:30')).resolves.toBe(false);
  });

  it('不同用户 / 日期 / 时刻各自独立', async () => {
    set.mockResolvedValue('OK');

    await dedupe.claim('user-1', '2026-11-05', '09:30');
    await dedupe.claim('user-2', '2026-11-05', '09:30');
    await dedupe.claim('user-1', '2026-11-06', '09:30');
    await dedupe.claim('user-1', '2026-11-05', '10:30');

    expect(set.mock.calls.map((call) => call[0])).toEqual([
      'water:reminder:user-1|2026-11-05|09:30',
      'water:reminder:user-2|2026-11-05|09:30',
      'water:reminder:user-1|2026-11-06|09:30',
      'water:reminder:user-1|2026-11-05|10:30',
    ]);
  });

  it('Redis 故障时返回 false 而非抛异常，避免所有实例同时放开去重', async () => {
    set.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(dedupe.claim('user-1', '2026-11-05', '09:30')).resolves.toBe(false);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('模块销毁时关闭独立 Redis 连接', async () => {
    await dedupe.onModuleDestroy();
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
