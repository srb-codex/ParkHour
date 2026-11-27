import type { AutonomousCommunity, City, HolidayInfo } from '../types/parking';
import { addCalendarDays, getEasterSunday } from './easter';

interface FixedHoliday {
  month: number;
  day: number;
  name: string;
}

/**
 * Fixed national public holidays in Spain (all regions).
 */
const NATIONAL_FIXED_HOLIDAYS: FixedHoliday[] = [
  { month: 1, day: 1, name: 'Año Nuevo' },
  { month: 1, day: 6, name: 'Epifanía del Señor (Reyes)' },
  { month: 5, day: 1, name: 'Fiesta del Trabajo' },
  { month: 8, day: 15, name: 'Asunción de la Virgen' },
  { month: 10, day: 12, name: 'Fiesta Nacional de España' },
  { month: 11, day: 1, name: 'Todos los Santos' },
  { month: 12, day: 6, name: 'Día de la Constitución' },
  { month: 12, day: 8, name: 'Inmaculada Concepción' },
  { month: 12, day: 25, name: 'Navidad' },
];

/**
 * Communities where Maundy Thursday (Jueves Santo) is generally a public holiday.
 * (All except Cataluña and Comunitat Valenciana.)
 */
const MAUNDY_THURSDAY_COMMUNITIES = new Set<AutonomousCommunity>([
  'AN',
  'AR',
  'AS',
  'CN',
  'CB',
  'CM',
  'CL',
  'EX',
  'GA',
  'IB',
  'RI',
  'MD',
  'MC',
  'NC',
  'PV',
  'CE',
  'ML',
]);

/**
 * Communities where Easter Monday (Lunes de Pascua) is generally a public holiday.
 */
const EASTER_MONDAY_COMMUNITIES = new Set<AutonomousCommunity>([
  'CT',
  'IB',
  'NC',
  'PV',
  'VC',
  'RI',
]);

/**
 * Stable regional fixed holidays per Autonomous Community.
 */
const REGIONAL_FIXED_HOLIDAYS: Record<AutonomousCommunity, FixedHoliday[]> = {
  AN: [{ month: 2, day: 28, name: 'Día de Andalucía' }],
  AR: [{ month: 4, day: 23, name: 'San Jorge (Día de Aragón)' }],
  AS: [{ month: 9, day: 8, name: 'Día de Asturias' }],
  CN: [{ month: 5, day: 30, name: 'Día de Canarias' }],
  CB: [
    { month: 7, day: 28, name: 'Día de las Instituciones de Cantabria' },
    { month: 9, day: 15, name: 'La Bien Aparecida' },
  ],
  CM: [{ month: 5, day: 31, name: 'Día de Castilla-La Mancha' }],
  CL: [{ month: 4, day: 23, name: 'Día de Castilla y León' }],
  CT: [
    { month: 6, day: 24, name: 'Sant Joan' },
    { month: 9, day: 11, name: 'Diada Nacional de Catalunya' },
    { month: 12, day: 26, name: 'Sant Esteve' },
  ],
  EX: [{ month: 9, day: 8, name: 'Día de Extremadura' }],
  GA: [
    { month: 5, day: 17, name: 'Día das Letras Galegas' },
    { month: 7, day: 25, name: 'Día Nacional de Galicia (Santiago Apóstol)' },
  ],
  IB: [{ month: 3, day: 1, name: 'Dia de les Illes Balears' }],
  RI: [{ month: 6, day: 9, name: 'Día de La Rioja' }],
  MD: [{ month: 5, day: 2, name: 'Fiesta de la Comunidad de Madrid' }],
  MC: [
    { month: 3, day: 19, name: 'San José' },
    { month: 6, day: 9, name: 'Día de la Región de Murcia' },
  ],
  NC: [{ month: 12, day: 3, name: 'San Francisco Javier (Día de Navarra)' }],
  PV: [{ month: 7, day: 25, name: 'Santiago Apóstol' }],
  VC: [
    { month: 3, day: 19, name: 'San José (Fallas)' },
    { month: 6, day: 24, name: 'San Juan' },
    { month: 10, day: 9, name: 'Dia de la Comunitat Valenciana' },
  ],
  CE: [{ month: 9, day: 2, name: 'Día de Ceuta' }],
  ML: [{ month: 9, day: 17, name: 'Día de Melilla' }],
};

/**
 * Checks whether a calendar date (year, month 1-12, day 1-31) is a public holiday
 * in the given city (national, regional, or local).
 */
export function getHolidayForDate(
  city: City,
  year: number,
  month: number,
  day: number,
): HolidayInfo | undefined {
  // 1. National fixed holidays
  const natFixed = NATIONAL_FIXED_HOLIDAYS.find(
    (h) => h.month === month && h.day === day,
  );
  if (natFixed) {
    return { name: natFixed.name, scope: 'national' };
  }

  // 2. Movable Easter holidays
  const easter = getEasterSunday(year);
  const goodFriday = addCalendarDays(year, easter.month, easter.day, -2);
  if (goodFriday.month === month && goodFriday.day === day) {
    return { name: 'Viernes Santo', scope: 'national' };
  }

  if (MAUNDY_THURSDAY_COMMUNITIES.has(city.community)) {
    const maundyThursday = addCalendarDays(year, easter.month, easter.day, -3);
    if (maundyThursday.month === month && maundyThursday.day === day) {
      return { name: 'Jueves Santo', scope: 'regional' };
    }
  }

  if (EASTER_MONDAY_COMMUNITIES.has(city.community)) {
    const easterMonday = addCalendarDays(year, easter.month, easter.day, 1);
    if (easterMonday.month === month && easterMonday.day === day) {
      return { name: 'Lunes de Pascua', scope: 'regional' };
    }
  }

  // 3. Regional fixed holidays
  const regFixed = REGIONAL_FIXED_HOLIDAYS[city.community]?.find(
    (h) => h.month === month && h.day === day,
  );
  if (regFixed) {
    return { name: regFixed.name, scope: 'regional' };
  }

  // 4. Local city holidays
  const local = city.localHolidays.find(
    (h) =>
      h.month === month &&
      h.day === day &&
      (h.year === undefined || h.year === year),
  );
  if (local) {
    return { name: local.name, scope: 'local' };
  }

  return undefined;
}
