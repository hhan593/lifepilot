import { DateTime } from 'luxon';

export interface WeekBucket {
  /** 该周的周一，YYYY-MM-DD */
  weekStart: string;
  count: number;
  achieved: boolean;
}

export interface HabitStreak {
  /** 宽容型连击：连续达成的周数（当前周未达成时从上周起算，漏一天不清零） */
  streakWeeks: number;
  thisWeekCount: number;
  achievedThisWeek: boolean;
  weeks: WeekBucket[];
}

/**
 * Loop 式宽容连击：按「每周目标次数」计，一周内打卡 ≥ target 即为达成周。
 * 当前周还没达成不影响连击（从上一周继续数）。
 */
export function computeWeeklyStreak(
  dates: string[],
  targetPerWeek: number,
  todayISO: string,
  weeksBack = 6,
): HabitStreak {
  const target = Math.max(1, Math.min(7, targetPerWeek));
  const monday = DateTime.fromISO(todayISO, { zone: 'utc' }).startOf('week');
  const dateSet = new Set(dates);

  const weeks: WeekBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const ws = monday.minus({ weeks: i });
    let count = 0;
    for (let d = 0; d < 7; d++) {
      if (dateSet.has(ws.plus({ days: d }).toISODate() ?? '')) count++;
    }
    weeks.push({ weekStart: ws.toISODate() ?? '', count, achieved: count >= target });
  }

  const thisWeek = weeks[weeks.length - 1];
  const achievedThisWeek = thisWeek.achieved;

  let streakWeeks = 0;
  const startIndex = achievedThisWeek ? weeks.length - 1 : weeks.length - 2;
  for (let i = startIndex; i >= 0; i--) {
    if (weeks[i].achieved) streakWeeks++;
    else break;
  }

  return { streakWeeks, thisWeekCount: thisWeek.count, achievedThisWeek, weeks };
}
