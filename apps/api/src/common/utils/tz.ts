import { DateTime } from 'luxon';

export function localNow(tz: string): DateTime {
  return DateTime.now().setZone(tz);
}

/** 时区必须是可用 IANA 名：坏值会让 luxon 全线产出 Invalid DateTime，该用户所有接口瘫痪 */
export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}

/** 用户本地时区的今天，格式 YYYY-MM-DD */
export function todayISO(tz: string): string {
  return localNow(tz).toFormat('yyyy-MM-dd');
}

/** 某个本地日期的 [start, end) UTC 边界 */
export function dayRange(tz: string, date: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(date, { zone: tz }).startOf('day');
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

/** 今天（用户时区）的 [start, end) UTC 边界 */
export function todayRange(tz: string): { start: Date; end: Date } {
  const start = localNow(tz).startOf('day');
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

/** 校验 HH:MM 格式 */
export function isHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** 判断当前时刻是否处于免打扰时段（支持跨午夜，如 22:00–08:00） */
export function isWithinQuietHours(nowHHMM: string, quietStart: string, quietEnd: string): boolean {
  const toMinutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const now = toMinutes(nowHHMM);
  const start = toMinutes(quietStart);
  const end = toMinutes(quietEnd);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
