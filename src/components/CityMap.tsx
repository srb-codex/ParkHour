import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, LocateFixed, Map as MapIcon } from 'lucide-react';
import { formatMinutesRemaining } from '../engine/scheduleEngine';
import type { City, ParkingZone, ZoneStatus } from '../types/parking';

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
  description?: string;
  zoneId?: string;
  stroke?: string;
  fill?: string;
}

interface LegendItem {
  name: string;
  color: string;
}

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
  const title = escapeHtml(props.name || zoneEval?.zone.name || 'Zona regulada');

  if (!zoneEval) {
    return `<div style="font-family:system-ui,sans-serif;min-width:160px">
      <strong style="font-size:13px">${title}</strong>
    </div>`;
  }

  const { zone, status } = zoneEval;
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
    ? `<div style="margin-top:4px;font-size:11px;color:#64748b">
        Máx. ${
          zone.maxDurationMinutes >= 60
            ? `${Math.floor(zone.maxDurationMinutes / 60)}h${zone.maxDurationMinutes % 60 ? ` ${zone.maxDurationMinutes % 60}m` : ''}`
            : `${zone.maxDurationMinutes} min`
        } · ${escapeHtml(zone.name)}
      </div>`
    : '';

  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:185px;line-height:1.35">
    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:5px">${title}</div>
    <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${badgeBg};color:${badgeColor}">
      ${badgeText}
    </span>
    ${nextLine}
    ${maxLine}
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
  const [legend, setLegend] = useState<LegendItem[]>([]);

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
    setLegend([]);
    setMapError(null);

    if (!city.hasMap) {
      map.setView([city.lat, city.lng], 13);
      return;
    }

    let cancelled = false;
    setLoadingMap(true);

    const url = `${import.meta.env.BASE_URL}maps/${city.id}.geojson`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;

        const items: LegendItem[] = [];

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const p = (feature?.properties ?? {}) as GeoJsonFeatureProps;
            return {
              color: p.stroke || '#2563eb',
              weight: 2.5,
              opacity: 0.9,
              fillColor: p.fill || '#3b82f6',
              fillOpacity: 0.25,
            };
          },
          onEachFeature: (feature, featureLayer) => {
            const p = (feature.properties ?? {}) as GeoJsonFeatureProps;
            const zoneEval =
              zoneEvaluations.find((z) => z.zone.id === p.zoneId) ??
              zoneEvaluations[0];

            featureLayer.bindPopup(buildPopupHtml(p, zoneEval));

            if (p.name) {
              items.push({
                name: p.name,
                color: p.fill || p.stroke || '#2563eb',
              });
              featureLayersRef.current.set(p.name, featureLayer);
            }
          },
        }).addTo(mapRef.current);

        geoLayerRef.current = layer;
        setLegend(items);

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

      {/* Interactive Sector Legend */}
      {legend.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Sectores ORA ({legend.length}) — toca para enfocar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {legend.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => handleFocusZone(item.name)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
