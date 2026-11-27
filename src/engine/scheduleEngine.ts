import type {
  City,
  HolidayInfo,
  NextStateChange,
  ParkingZone,
  SeasonalRule,
  SpainTimezone,
  TimeRange,
  WeeklySchedule,
  ZoneStatus,
} from '../types/parking';
import { addCalendarDays } from './easter';
import { getHolidayForDate } from './holidays';

export interface LocalDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number; // 0-23
  minute: number; // 0-59
}

const WEEKDAY_NAMES_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/**
 * Extracts local wall-clock date parts for a given Date in a Spanish timezone.
 */
export function getLocalDateParts(
  date: Date,
  timezone: SpainTimezone,
): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '0';

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
    hour,
    minute: Number(get('minute')),
  };
}

/**
 * Parses "HH:MM" into minutes since midnight (0 - 1440).
 */
export function parseTimeToMinutes(time: string): number {
  const [hStr, mStr] = time.split(':');
  return Number(hStr) * 60 + Number(mStr);
}

/**
 * Formats minutes since midnight into "HH:MM".
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = totalMinutes === 1440 ? 0 : ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks if a (month, day) falls within a seasonal rule's inclusive range.
 * Supports ranges that cross year boundaries (e.g., Dec 15 - Jan 15).
 */
export function isDateInSeason(
  month: number,
  day: number,
  rule: SeasonalRule,
): boolean {
  const current = month * 100 + day;
  const start = rule.startMonth * 100 + rule.startDay;
  const end = rule.endMonth * 100 + rule.endDay;

  if (start <= end) {
    return current >= start && current <= end;
  }
  // Wraps around New Year
  return current >= start || current <= end;
}

function getScheduleRangesForDay(
  schedule: WeeklySchedule,
  weekday: number,
): TimeRange[] {
  if (weekday === 0) return schedule.sunday;
  if (weekday === 6) return schedule.saturday;
  return schedule.weekdays;
}

interface DayEvaluation {
  ranges: TimeRange[];
  holiday?: HolidayInfo;
  seasonRule?: SeasonalRule;
  isHolidayFree: boolean;
}

function evaluateDay(
  city: City,
  zone: ParkingZone,
  year: number,
  month: number,
  day: number,
  weekday: number,
): DayEvaluation {
  const seasonRule = zone.seasonalRules?.find((r) =>
    isDateInSeason(month, day, r),
  );
  const effectiveSchedule = seasonRule ? seasonRule.schedule : zone.schedule;
  const holidaysFree =
    seasonRule?.holidaysFree !== undefined
      ? seasonRule.holidaysFree
      : zone.holidaysFree;

  const holiday = getHolidayForDate(city, year, month, day);
  if (holiday && holidaysFree) {
    return {
      ranges: [],
      holiday,
      seasonRule,
      isHolidayFree: true,
    };
  }

  return {
    ranges: getScheduleRangesForDay(effectiveSchedule, weekday),
    holiday,
    seasonRule,
    isHolidayFree: false,
  };
}

function getDayLabel(dayOffset: number, weekday: number): string {
  if (dayOffset === 0) return 'hoy';
  if (dayOffset === 1) return 'mañana';
  return `el ${WEEKDAY_NAMES_ES[weekday]}`;
}

function formatHolidayScope(scope: HolidayInfo['scope']): string {
  switch (scope) {
    case 'national':
      return 'Festivo nacional';
    case 'regional':
      return 'Festivo autonómico';
    case 'local':
      return 'Festivo local';
  }
}

/**
 * Evaluates the current parking zone status at `now` for a given city & zone.
 */
export function evaluateZoneStatus(
  city: City,
  zone: ParkingZone,
  now: Date = new Date(),
): ZoneStatus {
  const local = getLocalDateParts(now, city.timezone);
  const nowMinutes = local.hour * 60 + local.minute;

  const todayEval = evaluateDay(
    city,
    zone,
    local.year,
    local.month,
    local.day,
    local.weekday,
  );

  // Check if current minute is inside any active range today
  const activeRange = todayEval.ranges.find((r) => {
    const start = parseTimeToMinutes(r.start);
    const end = parseTimeToMinutes(r.end);
    return nowMinutes >= start && nowMinutes < end;
  });

  const isActive = Boolean(activeRange);

  let nextChange: NextStateChange | null = null;

  if (isActive && activeRange) {
    // Find when the active period actually ends (handle contiguous ranges, e.g. 09:00-14:00 + 14:00-20:00)
    let endMinutes = parseTimeToMinutes(activeRange.end);
    let merged = true;
    while (merged) {
      merged = false;
      for (const r of todayEval.ranges) {
        if (parseTimeToMinutes(r.start) === endMinutes) {
          endMinutes = parseTimeToMinutes(r.end);
          merged = true;
        }
      }
    }

    const minutesUntil = endMinutes - nowMinutes;
    nextChange = {
      localTime: formatMinutesToTime(endMinutes),
      dayLabel: endMinutes === 1440 ? 'mañana' : 'hoy',
      minutesUntil,
      targetActive: false,
    };
  } else {
    // Currently free: search forward up to 35 days (covers full free August!) for next active start
    for (let dayOffset = 0; dayOffset <= 35; dayOffset++) {
      const target =
        dayOffset === 0
          ? {
              year: local.year,
              month: local.month,
              day: local.day,
              weekday: local.weekday,
            }
          : addCalendarDays(local.year, local.month, local.day, dayOffset);

      const dayEval =
        dayOffset === 0
          ? todayEval
          : evaluateDay(
              city,
              zone,
              target.year,
              target.month,
              target.day,
              target.weekday,
            );

      const sortedRanges = [...dayEval.ranges].sort(
        (a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start),
      );

      const nextRange = sortedRanges.find((r) => {
        const startMin = parseTimeToMinutes(r.start);
        return dayOffset === 0 ? startMin > nowMinutes : true;
      });

      if (nextRange) {
        const startMin = parseTimeToMinutes(nextRange.start);
        const minutesUntil = dayOffset * 1440 + startMin - nowMinutes;
        nextChange = {
          localTime: nextRange.start,
          dayLabel: getDayLabel(dayOffset, target.weekday),
          minutesUntil,
          targetActive: true,
        };
        break;
      }
    }
  }

  let reason: string;
  if (isActive) {
    if (zone.type === 'free_limited') {
      reason = todayEval.seasonRule
        ? `Control horario activo (${todayEval.seasonRule.label})`
        : 'Control horario gratuito activo';
    } else {
      reason = todayEval.seasonRule
        ? `Horario de pago activo (${todayEval.seasonRule.label})`
        : 'Horario de pago activo';
    }
  } else if (todayEval.isHolidayFree && todayEval.holiday) {
    reason = `${formatHolidayScope(todayEval.holiday.scope)}: ${todayEval.holiday.name}`;
  } else if (todayEval.ranges.length === 0) {
    if (todayEval.seasonRule) {
      reason = `Gratis (${todayEval.seasonRule.label})`;
    } else if (local.weekday === 0) {
      reason = 'Domingo sin regulación';
    } else if (local.weekday === 6) {
      reason = 'Sábado sin regulación';
    } else {
      reason = 'Sin regulación hoy';
    }
  } else {
    reason = todayEval.seasonRule
      ? `Fuera de horario (${todayEval.seasonRule.label})`
      : 'Fuera de horario regulado';
  }

  return {
    isActive,
    zoneType: zone.type,
    reason,
    activeSeasonLabel: todayEval.seasonRule?.label,
    holiday: todayEval.holiday,
    todayRanges: todayEval.ranges,
    nextChange,
  };
}

/**
 * Formats a duration in minutes to a compact Spanish string (e.g., "2h 15m", "45 min", "2 días").
 */
export function formatMinutesRemaining(minutes: number): string {
  if (minutes <= 0) return 'ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `${days} días`;
  }
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
