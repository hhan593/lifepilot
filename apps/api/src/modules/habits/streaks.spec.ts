import { computeWeeklyStreak } from './streaks';

// 以固定「今天」测试，避免用例随时间漂移
const TODAY = '2026-11-02'; // 周一

describe('computeWeeklyStreak（宽容连击）', () => {
  it('无打卡 → 连击 0', () => {
    const r = computeWeeklyStreak([], 7, TODAY);
    expect(r.streakWeeks).toBe(0);
    expect(r.achievedThisWeek).toBe(false);
  });

  it('本周达标 → 连击 1', () => {
    const r = computeWeeklyStreak(['2026-11-02', '2026-11-03', '2026-11-04'], 3, TODAY);
    expect(r.achievedThisWeek).toBe(true);
    expect(r.streakWeeks).toBe(1);
  });

  it('本周未达标但从上周继续 → 漏一天不清零', () => {
    // 上周（10/26-11/01）打卡 4 次，本周刚开头还没打卡
    const r = computeWeeklyStreak(
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'],
      3,
      TODAY,
    );
    expect(r.achievedThisWeek).toBe(false);
    expect(r.streakWeeks).toBe(1);
  });

  it('连续三周达成（含本周）→ 连击 3', () => {
    const dates = [
      '2026-10-12', '2026-10-13', // 周1: 2 次
      '2026-10-19', '2026-10-20', '2026-10-21', // 周2: 3 次
      '2026-10-26', '2026-10-27', '2026-10-28', // 周3: 3 次
      '2026-11-01', '2026-11-02', // 本周: 2 次
    ];
    const r = computeWeeklyStreak(dates, 2, TODAY);
    expect(r.streakWeeks).toBe(3);
  });

  it('中间断了一周 → 连击从断点重计', () => {
    const dates = [
      '2026-10-12', '2026-10-13', // 两周前: 达成
      // 上周（10-26 ~ 11-01）完全没打卡
      '2026-11-02', '2026-11-03', // 本周: 达成
    ];
    const r = computeWeeklyStreak(dates, 2, TODAY);
    expect(r.streakWeeks).toBe(1);
  });
});
