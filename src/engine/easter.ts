/**
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher) to compute Easter Sunday
 * for any Gregorian year. Returns { month (1-12), day (1-31) }.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Adds `offsetDays` to a calendar date (year, month 1-12, day 1-31) using UTC
 * to avoid any DST shifts.
 */
export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  offsetDays: number,
): { year: number; month: number; day: number; weekday: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
    weekday: dt.getUTCDay(),
  };
}
