import type { City } from '../types/parking';
import { CITIES_DATA } from './citiesData';

export const CITIES: City[] = CITIES_DATA;

/**
 * Strips diacritics and lowercases text for accent-insensitive Spanish search.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getCityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

export function searchCities(query: string): City[] {
  const norm = normalizeText(query);
  if (!norm) return CITIES;

  return CITIES.filter((city) => {
    if (normalizeText(city.name).includes(norm)) return true;
    if (normalizeText(city.province).includes(norm)) return true;
    if (city.aliases?.some((a) => normalizeText(a).includes(norm))) return true;
    return false;
  });
}
