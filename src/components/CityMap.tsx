import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, LocateFixed, Map as MapIcon } from 'lucide-react';
import { formatMinutesRemaining } from '../engine/scheduleEngine';
import type { City, ParkingZone, ZoneColor, ZoneStatus } from '../types/parking';

interface ZoneEvaluation {
  zone: ParkingZone;
  status: ZoneStatus;
}

interface CityMapProps {
  city: City;
  zoneEvaluations: ZoneEvaluation[];
  userCoords: { lat: number; lng: number } | null;
  onLocate: () => void;
  locating: boolean;
}

interface GeoJsonFeatureProps {
  name?: string;
  shortLabel?: string;
  sectorNote?: string;
  zoneId?: string;
}

interface SectorItem {
  name: string;
  shortLabel: string;
  colorHex: string;
}

/**
 * Standardized tariff color palette across all cities:
 * Map colors ALWAYS represent the parking tariff type, never arbitrary sector colors.
 */
const TARIFF_COLOR_HEX: Record<ZoneColor, { stroke: string; fill: string }> = {
  blue: { stroke: '#1d4ed8', fill: '#3b82f6' },
  green: { stroke: '#047857', fill: '#10b981' },
  orange: { stroke: '#c2410c', fill: '#f97316' },
  red: { stroke: '#be123c', fill: '#f43f5e' },
  purple: { stroke: '#7e22ce', fill: '#a855f7' },
  free_limited: { stroke: '#0369a1', fill: '#38bdf8' },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPopupHtml(
  props: GeoJsonFeatureProps,
  zoneEval: ZoneEvaluation | undefined,
): string {
  const sectorTitle = props.name ? escapeHtml(props.name) : '';

  if (!zoneEval) {
    return `<div style="font-family:system-ui,sans-serif;min-width:160px">
      <strong style="font-size:13px">${sectorTitle || 'Zona regulada'}</strong>
    </div>`;
  }

  const { zone, status } = zoneEval;
  const heading = sectorTitle
    ? `${escapeHtml(zone.name)} · ${sectorTitle}`
    : escapeHtml(zone.name);
  const isPaid = status.isActive && zone.type === 'paid';
  const badgeBg = isPaid ? '#ffe4e6' : '#d1fae5';
  const badgeColor = isPaid ? '#be123c' : '#047857';
  const badgeText = isPaid ? 'DE PAGO AHORA' : 'GRATIS AHORA';

  let nextLine = '';
  if (status.nextChange) {
    const verb = isPaid ? 'De pago hasta' : 'Gratis hasta';
    const rem = formatMinutesRemaining(status.nextChange.minutesUntil);
    nextLine = `<div style="margin-top:6px;font-size:12px;color:#334155">
      ${verb} <strong>${escapeHtml(status.nextChange.dayLabel)} ${escapeHtml(status.nextChange.localTime)}</strong> (${escapeHtml(rem)})
    </div>`;
  }

  const maxLine = zone.maxDurationMinutes
    ? `<div style="margin-top:4px;font-size:11px;color:#475569">
        Tiempo máximo: <strong>${
          zone.maxDurationMinutes >= 60
            ? `${Math.floor(zone.maxDurationMinutes / 60)}h${zone.maxDurationMinutes % 60 ? ` ${zone.maxDurationMinutes % 60}m` : ''}`
            : `${zone.maxDurationMinutes} min`
        }</strong>
      </div>`
    : '';

  const noteLine = props.sectorNote
    ? `<div style="margin-top:5px;font-size:11px;color:#64748b">${escapeHtml(props.sectorNote)}</div>`
    : '';

  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:195px;line-height:1.35">
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:5px">${heading}</div>
    <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${badgeBg};color:${badgeColor}">
      ${badgeText}
    </span>
    ${nextLine}
    ${maxLine}
    ${noteLine}
  </div>`;
}

export function CityMap({
  city,
  zoneEvaluations,
  userCoords,
  onLocate,
  locating,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const featureLayersRef = useRef<Map<string, L.Layer>>(new Map());

  const [loadingMap, setLoadingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<SectorItem[]>([]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [city.lat, city.lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center & GeoJSON overlay when city or status changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }
    featureLayersRef.current.clear();
    setSectors([]);
    setMapError(null);

    if (!city.hasMap) {
      map.setView([city.lat, city.lng], 13);
      return;
    }

    let cancelled = false;
    setLoadingMap(true);

    const resolveZoneEval = (zoneId?: string): ZoneEvaluation | undefined =>
      zoneEvaluations.find((z) => z.zone.id === zoneId) ?? zoneEvaluations[0];

    const url = `${import.meta.env.BASE_URL}maps/${city.id}.geojson`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;

        const items: SectorItem[] = [];

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const p = (feature?.properties ?? {}) as GeoJsonFeatureProps;
            const zoneEval = resolveZoneEval(p.zoneId);
            const palette =
              TARIFF_COLOR_HEX[zoneEval?.zone.color ?? 'blue'] ??
              TARIFF_COLOR_HEX.blue;

            return {
              color: palette.stroke,
              weight: 2.25,
              opacity: 0.9,
              fillColor: palette.fill,
              fillOpacity: 0.2,
            };
          },
          onEachFeature: (feature, featureLayer) => {
            const p = (feature.properties ?? {}) as GeoJsonFeatureProps;
            const zoneEval = resolveZoneEval(p.zoneId);
            const palette =
              TARIFF_COLOR_HEX[zoneEval?.zone.color ?? 'blue'] ??
              TARIFF_COLOR_HEX.blue;

            featureLayer.bindPopup(buildPopupHtml(p, zoneEval));

            if (p.shortLabel) {
              featureLayer.bindTooltip(p.shortLabel, {
                permanent: true,
                direction: 'center',
                className: 'parkhour-sector-label',
              });
            }

            if (p.name) {
              items.push({
                name: p.name,
                shortLabel: p.shortLabel || p.name,
                colorHex: palette.fill,
              });
              featureLayersRef.current.set(p.name, featureLayer);
            }
          },
        }).addTo(mapRef.current);

        geoLayerRef.current = layer;
        setSectors(items);

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [20, 20] });
        } else {
          mapRef.current.setView([city.lat, city.lng], 14);
        }
        setLoadingMap(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMapError('No se pudo cargar la capa de zonas para esta ciudad.');
        setLoadingMap(false);
        mapRef.current?.setView([city.lat, city.lng], 13);
      });

    return () => {
      cancelled = true;
    };
  }, [city, zoneEvaluations]);

  // Update user GPS marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userCoords) {
      userMarkerRef.current = L.circleMarker([userCoords.lat, userCoords.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindPopup('<strong>Tu ubicación</strong>')
        .addTo(map);
    }
  }, [userCoords]);

  const handleFocusZone = (name: string) => {
    const map = mapRef.current;
    const layer = featureLayersRef.current.get(name);
    if (!map || !layer) return;

    if ('getBounds' in layer && typeof layer.getBounds === 'function') {
      const bounds = (layer as L.Polygon).getBounds();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      layer.openPopup(bounds.getCenter());
    }
  };

  const handleCenterUser = () => {
    if (userCoords && mapRef.current) {
      mapRef.current.setView([userCoords.lat, userCoords.lng], 16, {
        animate: true,
      });
    } else {
      onLocate();
    }
  };

  return (
    <div className="space-y-3">
      {/* Info notice if city has no GeoJSON layer yet */}
      {!city.hasMap && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <MapIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div className="space-y-1">
              <p>
                Todavía no tenemos las zonas pintadas de{' '}
                <strong>{city.name}</strong> en el mapa interactivo (actualmente
                disponible en <strong>Zamora</strong>).
              </p>
              {city.sourceUrl && (
                <a
                  href={city.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Consultar plano oficial de {city.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {mapError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {mapError}
        </div>
      )}

      {/* Map Container */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          ref={containerRef}
          className="h-[58dvh] min-h-[360px] w-full z-0"
          aria-label={`Mapa de zonas de aparcamiento en ${city.name}`}
        />

        {/* Floating GPS button */}
        <button
          type="button"
          onClick={handleCenterUser}
          disabled={locating}
          className="absolute right-3 bottom-6 z-[400] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur active:scale-95 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          aria-label="Centrar en mi ubicación GPS"
          title="Mi ubicación"
        >
          <LocateFixed
            className={`h-5 w-5 ${locating ? 'animate-pulse text-blue-600' : ''}`}
          />
        </button>

        {loadingMap && (
          <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow dark:bg-slate-900 dark:text-slate-200">
              Cargando zonas...
            </span>
          </div>
        )}
      </div>

      {/* Tariff Legend + Interactive Sectors */}
      {sectors.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          {/* Tariff color key */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Tipos de tarifa
            </p>
            <div className="flex flex-wrap gap-2">
              {zoneEvaluations.map(({ zone }) => {
                const palette =
                  TARIFF_COLOR_HEX[zone.color] ?? TARIFF_COLOR_HEX.blue;
                return (
                  <span
                    key={zone.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <span
                      className="h-3 w-3 rounded-sm border"
                      style={{
                        backgroundColor: `${palette.fill}40`,
                        borderColor: palette.stroke,
                      }}
                    />
                    {zone.name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Sector quick focus chips */}
          <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Sectores ({sectors.length}) — toca para enfocar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sectors.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleFocusZone(item.name)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.colorHex }}
                  />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
