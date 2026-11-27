export type AutonomousCommunity =
  | 'AN' // Andalucía
  | 'AR' // Aragón
  | 'AS' // Asturias
  | 'CN' // Canarias
  | 'CB' // Cantabria
  | 'CM' // Castilla-La Mancha
  | 'CL' // Castilla y León
  | 'CT' // Cataluña
  | 'EX' // Extremadura
  | 'GA' // Galicia
  | 'IB' // Illes Balears
  | 'RI' // La Rioja
  | 'MD' // Comunidad de Madrid
  | 'MC' // Región de Murcia
  | 'NC' // Navarra
  | 'PV' // País Vasco
  | 'VC' // Comunitat Valenciana
  | 'CE' // Ceuta
  | 'ML'; // Melilla

export type SpainTimezone = 'Europe/Madrid' | 'Atlantic/Canary';

export interface TimeRange {
  /** Format "HH:MM" (00:00 - 23:59) */
  start: string;
  /** Format "HH:MM" (00:01 - 24:00) */
  end: string;
}

export interface WeeklySchedule {
  weekdays: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

export interface SeasonalRule {
  id: string;
  label: string;
  /** 1-12 */
  startMonth: number;
  /** 1-31 */
  startDay: number;
  /** 1-12 */
  endMonth: number;
  /** 1-31 */
  endDay: number;
  schedule: WeeklySchedule;
  holidaysFree?: boolean;
}

export type ZoneColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'free_limited';

export interface ParkingZone {
  id: string;
  name: string;
  color: ZoneColor;
  type: 'paid' | 'free_limited';
  maxDurationMinutes?: number;
  schedule: WeeklySchedule;
  seasonalRules?: SeasonalRule[];
  holidaysFree: boolean;
  notes?: string;
}

export interface LocalHoliday {
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  name: string;
  /** Optional year for movable local holidays */
  year?: number;
}

export interface ArcGisStreetLayerConfig {
  type: 'arcgis';
  /** ArcGIS MapServer/FeatureServer layer URL (without /query) */
  url: string;
  /** Minimum zoom level to load street-level bands */
  minZoom: number;
  /** Attribute name holding the paint color (default: 'Color') */
  colorField?: string;
  /** Comma-separated outFields to request */
  outFields?: string;
}

export interface City {
  id: string;
  name: string;
  aliases?: string[];
  province: string;
  community: AutonomousCommunity;
  timezone: SpainTimezone;
  lat: number;
  lng: number;
  radiusKm: number;
  serviceName: string;
  localHolidays: LocalHoliday[];
  zones: ParkingZone[];
  lastVerified: string;
  /** True only when schedules/zones have been checked against official municipal sources */
  verified?: boolean;
  /** Official municipal or operator URL for verification */
  sourceUrl?: string;
  /** True when a GeoJSON zone map exists in public/maps/<id>.geojson */
  hasMap?: boolean;
  /** Optional live street-level layer loaded on demand when zoomed in */
  streetLayer?: ArcGisStreetLayerConfig;
  generalNotes?: string;
}

export interface HolidayInfo {
  name: string;
  scope: 'national' | 'regional' | 'local';
}

export interface NextStateChange {
  /** Local HH:MM in city timezone */
  localTime: string;
  /** Human-readable day label: "hoy", "mañana", "lunes", etc. */
  dayLabel: string;
  /** Minutes until the state change */
  minutesUntil: number;
  /** Whether the zone becomes active (paid/regulated) at that time */
  targetActive: boolean;
}

export interface ZoneStatus {
  isActive: boolean;
  zoneType: 'paid' | 'free_limited';
  reason: string;
  activeSeasonLabel?: string;
  holiday?: HolidayInfo;
  todayRanges: TimeRange[];
  nextChange: NextStateChange | null;
}

export interface LocationResolution {
  city: City;
  distanceKm: number;
  isWithinRadius: boolean;
  precision: 'city' | 'street';
}

export interface LocationResolver {
  resolve(lat: number, lng: number, cities: City[]): LocationResolution | null;
}
