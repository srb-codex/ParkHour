import { useCallback, useEffect, useState } from 'react';

const FAVORITES_KEY = 'parkhour_favorites_v1';
const LAST_CITY_KEY = 'parkhour_last_city_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readJson<string[]>(FAVORITES_KEY, []),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    } catch {
      // Ignore storage quota errors in private mode
    }
  }, [favoriteIds]);

  const toggleFavorite = useCallback((cityId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(cityId)
        ? prev.filter((id) => id !== cityId)
        : [cityId, ...prev],
    );
  }, []);

  const isFavorite = useCallback(
    (cityId: string) => favoriteIds.includes(cityId),
    [favoriteIds],
  );

  return { favoriteIds, toggleFavorite, isFavorite };
}

export function getSavedLastCityId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CITY_KEY);
  } catch {
    return null;
  }
}

export function saveLastCityId(cityId: string): void {
  try {
    window.localStorage.setItem(LAST_CITY_KEY, cityId);
  } catch {
    // Ignore storage errors
  }
}
