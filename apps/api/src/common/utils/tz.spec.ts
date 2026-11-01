import { isWithinQuietHours } from './tz';

describe('isWithinQuietHours（免打扰时段，支持跨午夜）', () => {
  it('22:00–08:00：深夜与清晨在时段内', () => {
    expect(isWithinQuietHours('23:00', '22:00', '08:00')).toBe(true);
    expect(isWithinQuietHours('07:59', '22:00', '08:00')).toBe(true);
  });

  it('22:00–08:00：白天不在时段内', () => {
    expect(isWithinQuietHours('12:00', '22:00', '08:00')).toBe(false);
    expect(isWithinQuietHours('08:00', '22:00', '08:00')).toBe(false);
  });

  it('同时段（12:00–12:00）视为未启用', () => {
    expect(isWithinQuietHours('12:30', '12:00', '12:00')).toBe(false);
  });

  it('不跨午夜时段', () => {
    expect(isWithinQuietHours('13:00', '12:00', '14:00')).toBe(true);
    expect(isWithinQuietHours('15:00', '12:00', '14:00')).toBe(false);
  });
});
