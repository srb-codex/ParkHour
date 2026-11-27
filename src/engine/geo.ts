import type { City, LocationResolution, LocationResolver } from '../types/parking';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle distance in kilometers between two WGS84 coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * v1 City-level offline location resolver.
 * Implements `LocationResolver` so v2 can swap/wrap it with GeoJSON polygon matching.
 */
export class CityRadiusLocationResolver implements LocationResolver {
  resolve(lat: number, lng: number, cities: City[]): LocationResolution | null {
    if (cities.length === 0) return null;

    let closestCity = cities[0];
    let minDistance = haversineDistanceKm(lat, lng, closestCity.lat, closestCity.lng);

    for (let i = 1; i < cities.length; i++) {
      const candidate = cities[i];
      const dist = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestCity = candidate;
      }
    }

    return {
      city: closestCity,
      distanceKm: Math.round(minDistance * 10) / 10,
      isWithinRadius: minDistance <= closestCity.radiusKm,
      precision: 'city',
    };
  }
}

export const defaultLocationResolver: LocationResolver =
  new CityRadiusLocationResolver();
