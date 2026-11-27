import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, LocateFixed, Map as MapIcon, ZoomIn } from 'lucide-react';
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
  legendLabel?: string;
  zoneId?: string;
}

interface ArcGisBandProps {
  Color?: string;
  color?: string;
  Bateria_Linea?: string;
  Res_NumPlazas?: number;
  [key: string]: unknown;
}

interface SectorItem {
  name: string;
  shortLabel: string;
  colorHex: string;
}

interface LegendTariffItem {
  id: string;
  label: string;
  stroke: string;
  fill: string;
}

interface BoundFeature {
  layer: L.Layer;
  props: GeoJsonFeatureProps;
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

function mapStreetColorToZone(rawColor?: string): {
  zoneId: string;
  color: ZoneColor;
  label: string;
} | null {
  const norm = (rawColor || '').trim().toLowerCase();
  if (!norm || norm === 'gris' || norm === 'blanco' || norm === 'amarillo') {
    return null;
  }
  if (norm.includes('verde')) {
    return { zoneId: 'green', color: 'green', label: 'Zona Verde' };
  }
  if (norm.includes('azul')) {
    return { zoneId: 'blue', color: 'blue', label: 'Zona Azul' };
  }
  if (norm.includes('alta rot')) {
    return { zoneId: 'red', color: 'red', label: 'Alta Rotación' };
  }
  if (norm.includes('naranja')) {
    return { zoneId: 'orange', color: 'orange', label: 'Ámbito Disuasorio (Naranja)' };
  }
  if (norm.includes('rojo')) {
    return { zoneId: 'red', color: 'red', label: 'Ámbito Hospitalario (Rojo)' };
  }
  return { zoneId: 'blue', color: 'blue', label: rawColor || 'Zona regulada' };
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
  const streetLayerRef = useRef<L.GeoJSON | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const featureLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const boundFeaturesRef = useRef<BoundFeature[]>([]);
  const boundStreetFeaturesRef = useRef<BoundFeature[]>([]);
  const latestEvaluationsRef = useRef<ZoneEvaluation[]>(zoneEvaluations);
  latestEvaluationsRef.current = zoneEvaluations;

  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  const [streetModeActive, setStreetModeActive] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [legendTariffs, setLegendTariffs] = useState<LegendTariffItem[]>([]);
  const [streetLegendTariffs, setStreetLegendTariffs] = useState<
    LegendTariffItem[]
  >([]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [city.lat, city.lng],
      zoom: 14,
      zoomControl: true,
      preferCanvas: true,
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

  // Load GeoJSON overlay & fit bounds ONLY when switching city (never resets user zoom on clock ticks!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }
    if (streetLayerRef.current) {
      streetLayerRef.current.remove();
      streetLayerRef.current = null;
    }
    featureLayersRef.current.clear();
    boundFeaturesRef.current = [];
    boundStreetFeaturesRef.current = [];
    setSectors([]);
    setLegendTariffs([]);
    setStreetLegendTariffs([]);
    setStreetModeActive(false);
    setMapError(null);

    if (!city.hasMap) {
      map.setView([city.lat, city.lng], 13);
      return;
    }

    let cancelled = false;
    setLoadingMap(true);

    const resolveZoneEval = (zoneId?: string): ZoneEvaluation | undefined => {
      const evals = latestEvaluationsRef.current;
      return evals.find((z) => z.zone.id === zoneId) ?? evals[0];
    };

    const url = `${import.meta.env.BASE_URL}maps/${city.id}.geojson`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;

        const items: SectorItem[] = [];
        const boundList: BoundFeature[] = [];
        const tariffMap = new Map<string, LegendTariffItem>();

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const p = (feature?.properties ?? {}) as GeoJsonFeatureProps;
            const zoneEval = resolveZoneEval(p.zoneId);
            const palette =
              TARIFF_COLOR_HEX[zoneEval?.zone.color ?? 'blue'] ??
              TARIFF_COLOR_HEX.blue;

            const isLine =
              feature?.geometry?.type === 'LineString' ||
              feature?.geometry?.type === 'MultiLineString';

            return {
              color: isLine ? palette.fill : palette.stroke,
              weight: isLine ? 4 : 2.25,
              opacity: 0.9,
              fillColor: palette.fill,
              fillOpacity: 0.18,
              lineCap: 'round',
            };
          },
          onEachFeature: (feature, featureLayer) => {
            const p = (feature.properties ?? {}) as GeoJsonFeatureProps;
            const zoneEval = resolveZoneEval(p.zoneId);
            const palette =
              TARIFF_COLOR_HEX[zoneEval?.zone.color ?? 'blue'] ??
              TARIFF_COLOR_HEX.blue;

            const tariffKey = p.legendLabel || zoneEval?.zone.id || 'blue';
            if (!tariffMap.has(tariffKey)) {
              tariffMap.set(tariffKey, {
                id: tariffKey,
                label: p.legendLabel || zoneEval?.zone.name || 'Zona regulada',
                stroke: palette.stroke,
                fill: palette.fill,
              });
            }

            featureLayer.bindPopup(buildPopupHtml(p, zoneEval));
            boundList.push({ layer: featureLayer, props: p });

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
        boundFeaturesRef.current = boundList;
        setSectors(items);
        setLegendTariffs(Array.from(tariffMap.values()));

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
  }, [city]);

  // Live street-level colored bands when zoomed in (e.g., Madrid SER Bandas de Aparcamiento)
  useEffect(() => {
    const map = mapRef.current;
    const cfg = city.streetLayer;
    if (!map || !cfg) return;

    let debounceTimer: number | undefined;
    let controller: AbortController | null = null;

    const clearStreetLayer = () => {
      if (streetLayerRef.current) {
        streetLayerRef.current.remove();
        streetLayerRef.current = null;
      }
      boundStreetFeaturesRef.current = [];
      setStreetLegendTariffs([]);
      setStreetModeActive(false);
      setLoadingStreets(false);
      // Restore barrio polygon fill visibility when zoomed out
      geoLayerRef.current?.setStyle({ fillOpacity: 0.18, opacity: 0.9 });
    };

    const loadVisibleStreets = () => {
      const zoom = map.getZoom();
      if (zoom < cfg.minZoom) {
        controller?.abort();
        clearStreetLayer();
        return;
      }

      if (!navigator.onLine) {
        return;
      }

      controller?.abort();
      controller = new AbortController();
      setLoadingStreets(true);
      setStreetModeActive(true);

      // Soften barrio polygons so colored street lines stand out crisply
      geoLayerRef.current?.setStyle({ fillOpacity: 0.03, opacity: 0.35 });

      const colorField = cfg.colorField || 'Color';
      const b = map.getBounds();
      const params = new URLSearchParams({
        where: '1=1',
        geometry: `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        inSR: '4326',
        outSR: '4326',
        outFields: cfg.outFields || 'Color,Bateria_Linea,Res_NumPlazas',
        resultRecordCount: '1500',
        f: 'geojson',
      });

      fetch(`${cfg.url}/query?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((geojson: GeoJSON.FeatureCollection) => {
          if (!mapRef.current) return;

          if (streetLayerRef.current) {
            streetLayerRef.current.remove();
            streetLayerRef.current = null;
          }

          const boundStreets: BoundFeature[] = [];
          const streetTariffMap = new Map<string, LegendTariffItem>();
          const evals = latestEvaluationsRef.current;

          const getRawColor = (p: ArcGisBandProps): string | undefined => {
            const val = p[colorField] ?? p.Color ?? p.color;
            return typeof val === 'string' ? val : undefined;
          };

          const layer = L.geoJSON(geojson, {
            filter: (feature) => {
              const p = (feature.properties ?? {}) as ArcGisBandProps;
              return mapStreetColorToZone(getRawColor(p)) !== null;
            },
            style: (feature) => {
              const p = (feature?.properties ?? {}) as ArcGisBandProps;
              const mapped = mapStreetColorToZone(getRawColor(p));
              const palette =
                TARIFF_COLOR_HEX[mapped?.color ?? 'blue'] ??
                TARIFF_COLOR_HEX.blue;

              return {
                color: palette.fill,
                weight: zoom >= 17 ? 6 : 4.5,
                opacity: 0.92,
                lineCap: 'round',
              };
            },
            onEachFeature: (feature, featureLayer) => {
              const p = (feature.properties ?? {}) as ArcGisBandProps;
              const mapped = mapStreetColorToZone(getRawColor(p));
              if (!mapped) return;

              const zoneEval =
                evals.find((z) => z.zone.id === mapped.zoneId) ?? evals[0];
              const palette = TARIFF_COLOR_HEX[mapped.color];

              if (!streetTariffMap.has(mapped.label)) {
                streetTariffMap.set(mapped.label, {
                  id: mapped.label,
                  label: mapped.label,
                  stroke: palette.stroke,
                  fill: palette.fill,
                });
              }

              const detailParts: string[] = [];
              if (p.Res_NumPlazas) {
                detailParts.push(
                  `${p.Res_NumPlazas} ${p.Res_NumPlazas === 1 ? 'plaza' : 'plazas'}`,
                );
              }
              if (p.Bateria_Linea) {
                detailParts.push(`en ${p.Bateria_Linea.toLowerCase()}`);
              }

              const popupProps: GeoJsonFeatureProps = {
                name: detailParts.length > 0 ? detailParts.join(' ') : mapped.label,
                zoneId: mapped.zoneId,
              };

              featureLayer.bindPopup(buildPopupHtml(popupProps, zoneEval));
              boundStreets.push({ layer: featureLayer, props: popupProps });
            },
          }).addTo(mapRef.current);

          streetLayerRef.current = layer;
          boundStreetFeaturesRef.current = boundStreets;
          setStreetLegendTariffs(Array.from(streetTariffMap.values()));
          setLoadingStreets(false);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setLoadingStreets(false);
        });
    };

    const scheduleLoad = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(loadVisibleStreets, 300);
    };

    map.on('moveend', scheduleLoad);
    map.on('zoomend', scheduleLoad);

    return () => {
      window.clearTimeout(debounceTimer);
      controller?.abort();
      map.off('moveend', scheduleLoad);
      map.off('zoomend', scheduleLoad);
    };
  }, [city]);

  // Refresh popup contents in-place when clock/status ticks (preserves zoom & pan!)
  useEffect(() => {
    for (const { layer, props } of boundFeaturesRef.current) {
      const zoneEval =
        zoneEvaluations.find((z) => z.zone.id === props.zoneId) ??
        zoneEvaluations[0];
      layer.setPopupContent(buildPopupHtml(props, zoneEval));
    }
    for (const { layer, props } of boundStreetFeaturesRef.current) {
      const zoneEval =
        zoneEvaluations.find((z) => z.zone.id === props.zoneId) ??
        zoneEvaluations[0];
      layer.setPopupContent(buildPopupHtml(props, zoneEval));
    }
  }, [zoneEvaluations]);

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

  const activeLegend =
    streetModeActive && streetLegendTariffs.length > 0
      ? streetLegendTariffs
      : legendTariffs;

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
                <strong>{city.name}</strong> en el mapa interactivo.
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

        {/* Zoom-in hint pill for cities with street-level band layers */}
        {city.streetLayer && !streetModeActive && !loadingMap && (
          <div className="pointer-events-none absolute top-3 right-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-medium text-white shadow-md">
            <ZoomIn className="h-3.5 w-3.5 text-sky-400" />
            Acerca el zoom para ver calles por color
          </div>
        )}

        {loadingStreets && (
          <div className="pointer-events-none absolute top-3 right-3 z-[400] rounded-full bg-blue-600/95 px-3 py-1.5 text-[11px] font-medium text-white shadow-md">
            Cargando calles...
          </div>
        )}

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
      {(activeLegend.length > 0 || sectors.length > 0) && (
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          {/* Tariff color key */}
          {activeLegend.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {streetModeActive
                  ? 'Calles visibles por color'
                  : 'Tipos de tarifa'}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeLegend.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border"
                      style={{
                        backgroundColor: streetModeActive
                          ? t.fill
                          : `${t.fill}40`,
                        borderColor: t.stroke,
                      }}
                    />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sector quick focus chips (only when <= 20 sectors to avoid clutter) */}
          {sectors.length > 0 && sectors.length <= 20 ? (
            <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Sectores ({sectors.length}) — toca para enfocar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sectors.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
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
          ) : (
            <p className="border-t border-slate-100 pt-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {streetModeActive
                ? 'Toca cualquier calle pintada para ver plazas, estado y horario en tiempo real.'
                : 'Toca cualquier zona del mapa para ver su estado y horario en tiempo real.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
