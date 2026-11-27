import { describe, expect, it } from 'vitest';
import { CITIES, searchCities } from './cities';
import { parseTimeToMinutes } from '../engine/scheduleEngine';
import type { TimeRange } from '../types/parking';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d|24:00$/;

function validateRanges(ranges: TimeRange[], context: string) {
  let prevEnd = -1;
  for (const r of ranges) {
    expect(r.start, `${context} start`).toMatch(TIME_REGEX);
    expect(r.end, `${context} end`).toMatch(TIME_REGEX);
    const s = parseTimeToMinutes(r.start);
    const e = parseTimeToMinutes(r.end);
    expect(s, `${context} start < end`).toBeLessThan(e);
    expect(s, `${context} non-overlapping`).toBeGreaterThanOrEqual(prevEnd);
    prevEnd = e;
  }
}

describe('Spain 52 Capitals Dataset Integrity', () => {
  it('contains all 50 provincial capitals plus Ceuta and Melilla (52 cities)', () => {
    expect(CITIES.length).toBe(52);
    const ids = new Set(CITIES.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it('has valid coordinates, timezones, and well-formed schedules for every city', () => {
    for (const city of CITIES) {
      expect(city.lat, city.id).toBeGreaterThan(27);
      expect(city.lat, city.id).toBeLessThan(44.5);
      expect(city.lng, city.id).toBeGreaterThan(-18.5);
      expect(city.lng, city.id).toBeLessThan(4.5);

      if (city.community === 'CN') {
        expect(city.timezone, city.id).toBe('Atlantic/Canary');
      } else {
        expect(city.timezone, city.id).toBe('Europe/Madrid');
      }

      expect(city.zones.length, city.id).toBeGreaterThan(0);

      for (const zone of city.zones) {
        validateRanges(zone.schedule.weekdays, `${city.id}.${zone.id}.weekdays`);
        validateRanges(zone.schedule.saturday, `${city.id}.${zone.id}.saturday`);
        validateRanges(zone.schedule.sunday, `${city.id}.${zone.id}.sunday`);

        for (const rule of zone.seasonalRules ?? []) {
          validateRanges(rule.schedule.weekdays, `${city.id}.${zone.id}.${rule.id}.weekdays`);
          validateRanges(rule.schedule.saturday, `${city.id}.${zone.id}.${rule.id}.saturday`);
          validateRanges(rule.schedule.sunday, `${city.id}.${zone.id}.${rule.id}.sunday`);
        }
      }
    }
  });

  it('supports accent-insensitive and alias search', () => {
    expect(searchCities('malaga').some((c) => c.id === 'malaga')).toBe(true);
    expect(searchCities('donostia').some((c) => c.id === 'san-sebastian')).toBe(true);
    expect(searchCities('la coruna').some((c) => c.id === 'a-coruna')).toBe(true);
    expect(searchCities('mallorca').some((c) => c.id === 'palma')).toBe(true);
  });
});
