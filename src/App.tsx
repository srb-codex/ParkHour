import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  LocateFixed,
  MapPin,
  Search,
  Star,
  WifiOff,
} from 'lucide-react';
import { CitySearchModal } from './components/CitySearchModal';
import { InstallHint } from './components/InstallHint';
import { ZoneCard } from './components/ZoneCard';
import { CITIES, getCityById } from './data/cities';
import { evaluateZoneStatus, getLocalDateParts } from './engine/scheduleEngine';
import {
  getSavedLastCityId,
  saveLastCityId,
  useFavorites,
} from './hooks/useFavorites';
import { useGeolocation } from './hooks/useGeolocation';
import { useNow } from './hooks/useNow';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { City, LocationResolution } from './types/parking';

const DEFAULT_CITY_ID = 'madrid';

function getInitialCity(): City {
  const savedId = getSavedLastCityId();
  if (savedId) {
    const found = getCityById(savedId);
    if (found) return found;
  }
  return getCityById(DEFAULT_CITY_ID) ?? CITIES[0];
}

export function App() {
  const [city, setCity] = useState<City>(() => getInitialCity());
  const [searchOpen, setSearchOpen] = useState(false);
  const [gpsMeta, setGpsMeta] = useState<LocationResolution | null>(null);

  const now = useNow();
  const isOnline = useOnlineStatus();
  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites();

  const handleSelectCity = useCallback((selected: City, fromGps = false) => {
    setCity(selected);
    saveLastCityId(selected.id);
    if (!fromGps) {
      setGpsMeta(null);
    }
  }, []);

  const handleGpsResolved = useCallback(
    (resolution: LocationResolution) => {
      setGpsMeta(resolution);
      handleSelectCity(resolution.city, true);
    },
    [handleSelectCity],
  );

  const geo = useGeolocation(handleGpsResolved);

  // Format current local clock in the active city's timezone
  const localClock = useMemo(() => {
    const p = getLocalDateParts(now, city.timezone);
    const hh = String(p.hour).padStart(2, '0');
    const mm = String(p.minute).padStart(2, '0');
    const dateFormatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: city.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const dateStr = dateFormatter.format(now);
    return {
      time: `${hh}:${mm}`,
      date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
    };
  }, [now, city.timezone]);

  const zoneEvaluations = useMemo(
    () =>
      city.zones.map((zone) => ({
        zone,
        status: evaluateZoneStatus(city, zone, now),
      })),
    [city, now],
  );

  const favoriteCities = useMemo(
    () =>
      favoriteIds
        .map((id) => getCityById(id))
        .filter((c): c is City => Boolean(c)),
    [favoriteIds],
  );

  // Keep document title in sync
  useEffect(() => {
    document.title = `${city.name} · ParkHour`;
  }, [city.name]);

  const activeIsFavorite = isFavorite(city.id);

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sticky Header */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85">
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            {/* Active City Selector Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group flex items-center gap-2 rounded-xl py-1 pr-2 text-left min-w-0 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {city.name}
                  </h1>
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {city.serviceName} · {localClock.time}
                  {city.timezone === 'Atlantic/Canary' ? ' (Canarias)' : ''}
                </p>
              </div>
            </button>

            {/* Right Actions: GPS, Favorite, Search */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={geo.locate}
                disabled={geo.loading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Detectar ciudad por GPS"
                title="Detectar por GPS"
              >
                <LocateFixed
                  className={`h-5 w-5 ${geo.loading ? 'animate-pulse text-blue-600' : ''}`}
                />
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(city.id)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label={
                  activeIsFavorite
                    ? 'Quitar de favoritos'
                    : 'Guardar en favoritos'
                }
                title={
                  activeIsFavorite
                    ? 'Quitar de favoritos'
                    : 'Guardar en favoritos'
                }
              >
                <Star
                  className={`h-5 w-5 ${
                    activeIsFavorite
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Buscar otra ciudad"
                title="Buscar ciudad"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Favorites Quick Chips */}
          {favoriteCities.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {favoriteCities.map((fav) => {
                const selected = fav.id === city.id;
                return (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() => handleSelectCity(fav)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {fav.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="safe-bottom mx-auto w-full max-w-lg flex-1 space-y-3.5 px-4 pt-4">
        {/* Date + Offline indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{localClock.date}</span>
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <WifiOff className="h-3 w-3" />
              Modo offline
            </span>
          )}
        </div>

        {/* GPS Error Alert */}
        {geo.error && (
          <div className="flex items-start justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{geo.error}</p>
            </div>
            <button
              type="button"
              onClick={geo.clearError}
              className="font-semibold underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* GPS Outside Radius Banner */}
        {gpsMeta && !gpsMeta.isWithinRadius && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            Estás a <strong>{gpsMeta.distanceKm} km</strong> de{' '}
            <strong>{gpsMeta.city.name}</strong> (la capital soportada más
            cercana). Si estás en otro municipio, consulta la señalización local.
          </div>
        )}

        {/* iOS Install Hint */}
        <InstallHint />

        {/* Parking Zones List */}
        <section className="space-y-3" aria-label="Zonas de aparcamiento">
          {zoneEvaluations.map(({ zone, status }) => (
            <ZoneCard key={`${city.id}-${zone.id}`} zone={zone} status={status} />
          ))}
        </section>

        {/* City General Notes */}
        {city.generalNotes && (
          <p className="rounded-2xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {city.generalNotes}
          </p>
        )}

        {/* Footer Disclaimer */}
        <footer className="pt-4 pb-6 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          <p>
            Información orientativa (verificada: {city.lastVerified}). Comprueba
            siempre la señalización vertical y el parquímetro antes de estacionar.
          </p>
          <p className="mt-1">ParkHour · 52 capitales de España · 100% offline</p>
        </footer>
      </main>

      {/* City Search Modal */}
      <CitySearchModal
        open={searchOpen}
        activeCityId={city.id}
        favoriteIds={favoriteIds}
        onSelectCity={(selected) => handleSelectCity(selected, false)}
        onToggleFavorite={toggleFavorite}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}

export default App;
