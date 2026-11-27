import { useCallback, useState } from 'react';
import { CITIES } from '../data/cities';
import { defaultLocationResolver } from '../engine/geo';
import type { LocationResolution } from '../types/parking';

export interface GeolocationState {
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
  resolution: LocationResolution | null;
  locate: () => void;
  clearError: () => void;
}

export function useGeolocation(
  onResolved?: (resolution: LocationResolution) => void,
): GeolocationState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolution, setResolution] = useState<LocationResolution | null>(null);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        const resolved = defaultLocationResolver.resolve(
          latitude,
          longitude,
          CITIES,
        );
        setLoading(false);
        if (resolved) {
          setResolution(resolved);
          onResolved?.(resolved);
        } else {
          setError('No se pudo determinar una ciudad cercana.');
        }
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError(
              'Permiso de ubicación denegado. Puedes activarlo en Ajustes o elegir tu ciudad manualmente.',
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Ubicación GPS no disponible en este momento.');
            break;
          case err.TIMEOUT:
            setError('Tiempo de espera agotado al obtener el GPS.');
            break;
          default:
            setError('Error al obtener tu ubicación.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }, [onResolved]);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, coords, resolution, locate, clearError };
}
