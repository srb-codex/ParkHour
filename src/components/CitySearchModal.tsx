import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, Star, X } from 'lucide-react';
import { CITIES, searchCities } from '../data/cities';
import type { City } from '../types/parking';

interface CitySearchModalProps {
  open: boolean;
  activeCityId: string;
  favoriteIds: string[];
  onSelectCity: (city: City) => void;
  onToggleFavorite: (cityId: string) => void;
  onClose: () => void;
}

export function CitySearchModal({
  open,
  activeCityId,
  favoriteIds,
  onSelectCity,
  onToggleFavorite,
  onClose,
}: CitySearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const filtered = useMemo(() => searchCities(query), [query]);

  const favoriteCities = useMemo(
    () =>
      favoriteIds
        .map((id) => CITIES.find((c) => c.id === id))
        .filter((c): c is City => Boolean(c)),
    [favoriteIds],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar ciudad"
    >
      {/* Top search bar */}
      <div className="safe-top border-b border-slate-200 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar capital o provincia..."
              className="w-full rounded-xl bg-slate-100 py-2.5 pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Cerrar buscador"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Results list */}
      <div className="safe-bottom flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto max-w-lg space-y-5">
          {!query.trim() && favoriteCities.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Favoritas
              </h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {favoriteCities.map((city) => (
                  <CityRow
                    key={`fav-${city.id}`}
                    city={city}
                    isActive={city.id === activeCityId}
                    isFavorite={true}
                    onSelect={() => {
                      onSelectCity(city);
                      onClose();
                    }}
                    onToggleFavorite={() => onToggleFavorite(city.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {query.trim()
                ? `Resultados (${filtered.length})`
                : `Todas las capitales (${CITIES.length})`}
            </h3>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No se encontró ninguna capital para «{query}».
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {filtered.map((city) => (
                  <CityRow
                    key={city.id}
                    city={city}
                    isActive={city.id === activeCityId}
                    isFavorite={favoriteIds.includes(city.id)}
                    onSelect={() => {
                      onSelectCity(city);
                      onClose();
                    }}
                    onToggleFavorite={() => onToggleFavorite(city.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

interface CityRowProps {
  city: City;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function CityRow({
  city,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: CityRowProps) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 text-left min-w-0"
      >
        <MapPin
          className={`h-4 w-4 shrink-0 ${
            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
          }`}
        />
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {city.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {city.serviceName} · {city.province}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleFavorite}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      >
        <Star
          className={`h-4 w-4 ${
            isFavorite
              ? 'fill-amber-400 text-amber-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        />
      </button>
    </li>
  );
}
