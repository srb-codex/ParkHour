import { describe, expect, it } from 'vitest';
import { getCityById } from '../data/cities';
import { getEasterSunday } from './easter';
import { defaultLocationResolver, haversineDistanceKm } from './geo';
import { getHolidayForDate } from './holidays';
import { evaluateZoneStatus, formatMinutesRemaining } from './scheduleEngine';
import { CITIES } from '../data/cities';

describe('Easter & Holidays', () => {
  it('computes Easter Sunday accurately', () => {
    expect(getEasterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(getEasterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(getEasterSunday(2027)).toEqual({ month: 3, day: 28 });
  });

  it('detects national, regional, and local holidays', () => {
    const madrid = getCityById('madrid')!;
    const barcelona = getCityById('barcelona')!;

    // National fixed: Dec 6
    expect(getHolidayForDate(madrid, 2026, 12, 6)).toEqual({
      name: 'Día de la Constitución',
      scope: 'national',
    });

    // National movable: Good Friday 2026 = April 3
    expect(getHolidayForDate(madrid, 2026, 4, 3)).toEqual({
      name: 'Viernes Santo',
      scope: 'national',
    });

    // Regional movable: Maundy Thursday 2026 = April 2 (holiday in Madrid, not Barcelona)
    expect(getHolidayForDate(madrid, 2026, 4, 2)?.name).toBe('Jueves Santo');
    expect(getHolidayForDate(barcelona, 2026, 4, 2)).toBeUndefined();

    // Regional movable: Easter Monday 2026 = April 6 (holiday in Barcelona, not Madrid)
    expect(getHolidayForDate(barcelona, 2026, 4, 6)?.name).toBe('Lunes de Pascua');
    expect(getHolidayForDate(madrid, 2026, 4, 6)).toBeUndefined();

    // Regional fixed
    expect(getHolidayForDate(madrid, 2026, 5, 2)?.scope).toBe('regional');
    expect(getHolidayForDate(barcelona, 2026, 9, 11)?.scope).toBe('regional');

    // Local fixed
    expect(getHolidayForDate(madrid, 2026, 5, 15)).toEqual({
      name: 'San Isidro Labrador',
      scope: 'local',
    });
  });
});

describe('Schedule Engine', () => {
  it('evaluates active paid weekday hours in Madrid', () => {
    const madrid = getCityById('madrid')!;
    const blue = madrid.zones[0];

    // Wednesday 2026-11-18 at 11:30 CET (UTC+1 -> 10:30Z)
    const status = evaluateZoneStatus(madrid, blue, new Date('2026-11-18T10:30:00Z'));
    expect(status.isActive).toBe(true);
    expect(status.nextChange?.localTime).toBe('21:00');
    expect(status.nextChange?.dayLabel).toBe('hoy');
    expect(status.nextChange?.minutesUntil).toBe(9 * 60 + 30);
    expect(status.nextChange?.targetActive).toBe(false);
  });

  it('applies Madrid August afternoon free rule', () => {
    const madrid = getCityById('madrid')!;
    const blue = madrid.zones[0];

    // Tuesday 2026-08-11 at 16:00 CEST (UTC+2 -> 14:00Z)
    const status = evaluateZoneStatus(madrid, blue, new Date('2026-08-11T14:00:00Z'));
    expect(status.isActive).toBe(false);
    expect(status.activeSeasonLabel).toContain('agosto');
    expect(status.nextChange?.localTime).toBe('09:00');
    expect(status.nextChange?.dayLabel).toBe('mañana');
    expect(status.nextChange?.targetActive).toBe(true);
  });

  it('marks national and local holidays as free and finds next paid day', () => {
    const madrid = getCityById('madrid')!;
    const blue = madrid.zones[0];

    // Friday 2026-05-15 (San Isidro local holiday in Madrid) at 11:00 CEST (09:00Z)
    const status = evaluateZoneStatus(madrid, blue, new Date('2026-05-15T09:00:00Z'));
    expect(status.isActive).toBe(false);
    expect(status.holiday?.name).toBe('San Isidro Labrador');
    expect(status.nextChange?.dayLabel).toBe('mañana'); // Saturday 09:00
    expect(status.nextChange?.localTime).toBe('09:00');
  });

  it('handles full free August in Vitoria-Gasteiz and finds September 1', () => {
    const vitoria = getCityById('vitoria-gasteiz')!;
    const blue = vitoria.zones[0];

    // Monday 2026-08-10 at 11:00 CEST (09:00Z)
    const status = evaluateZoneStatus(vitoria, blue, new Date('2026-08-10T09:00:00Z'));
    expect(status.isActive).toBe(false);
    expect(status.activeSeasonLabel).toContain('Agosto');
    expect(status.nextChange).not.toBeNull();
    expect(status.nextChange?.localTime).toBe('10:00');
  });

  it('respects Atlantic/Canary timezone for Las Palmas', () => {
    const lasPalmas = getCityById('las-palmas')!;
    const blue = lasPalmas.zones[0];

    // Wednesday 2026-11-18 at 08:30 UTC:
    // Madrid = 09:30 (paid), Las Palmas = 08:30 (free until 09:00!)
    const instant = new Date('2026-11-18T08:30:00Z');
    const lpStatus = evaluateZoneStatus(lasPalmas, blue, instant);
    expect(lpStatus.isActive).toBe(false);
    expect(lpStatus.nextChange?.localTime).toBe('09:00');
    expect(lpStatus.nextChange?.minutesUntil).toBe(30);

    const madrid = getCityById('madrid')!;
    const madStatus = evaluateZoneStatus(madrid, madrid.zones[0], instant);
    expect(madStatus.isActive).toBe(true);
  });

  it('formats remaining minutes cleanly', () => {
    expect(formatMinutesRemaining(35)).toBe('35 min');
    expect(formatMinutesRemaining(120)).toBe('2h');
    expect(formatMinutesRemaining(135)).toBe('2h 15m');
    expect(formatMinutesRemaining(60 * 50)).toBe('2 días');
  });
});

describe('Geo Resolver', () => {
  it('resolves Madrid coordinates to Madrid within radius', () => {
    const res = defaultLocationResolver.resolve(40.42, -3.705, CITIES);
    expect(res).not.toBeNull();
    expect(res!.city.id).toBe('madrid');
    expect(res!.isWithinRadius).toBe(true);
    expect(res!.precision).toBe('city');
  });

  it('computes reasonable Madrid-Barcelona distance', () => {
    const madrid = getCityById('madrid')!;
    const bcn = getCityById('barcelona')!;
    const km = haversineDistanceKm(madrid.lat, madrid.lng, bcn.lat, bcn.lng);
    expect(km).toBeGreaterThan(480);
    expect(km).toBeLessThan(530);
  });
});
