import { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Sun,
} from 'lucide-react';
import { formatMinutesRemaining } from '../engine/scheduleEngine';
import type {
  ParkingZone,
  TimeRange,
  WeeklySchedule,
  ZoneColor,
  ZoneStatus,
} from '../types/parking';

interface ZoneCardProps {
  zone: ParkingZone;
  status: ZoneStatus;
}

const ZONE_DOT_CLASSES: Record<ZoneColor, string> = {
  blue: 'bg-blue-500 ring-blue-500/25',
  green: 'bg-emerald-500 ring-emerald-500/25',
  orange: 'bg-orange-500 ring-orange-500/25',
  red: 'bg-rose-500 ring-rose-500/25',
  purple: 'bg-purple-500 ring-purple-500/25',
  free_limited: 'bg-sky-500 ring-sky-500/25',
};

function formatRanges(ranges: TimeRange[]): string {
  if (ranges.length === 0) return 'Gratis';
  if (
    ranges.length === 1 &&
    ranges[0].start === '00:00' &&
    ranges[0].end === '24:00'
  ) {
    return '24 horas';
  }
  return ranges.map((r) => `${r.start}–${r.end}`).join(' y ');
}

function formatMaxDuration(minutes?: number): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `Máx. ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `Máx. ${h}h` : `Máx. ${h}h ${m}m`;
}

function ScheduleSummaryRows({ schedule }: { schedule: WeeklySchedule }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
      <dt className="font-medium text-slate-500 dark:text-slate-400">
        Lunes a viernes
      </dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
        {formatRanges(schedule.weekdays)}
      </dd>
      <dt className="font-medium text-slate-500 dark:text-slate-400">
        Sábados
      </dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
        {formatRanges(schedule.saturday)}
      </dd>
      <dt className="font-medium text-slate-500 dark:text-slate-400">
        Domingos
      </dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">
        {formatRanges(schedule.sunday)}
      </dd>
    </dl>
  );
}

export function ZoneCard({ zone, status }: ZoneCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isPaidNow = status.isActive && zone.type === 'paid';
  const isLimitedNow = status.isActive && zone.type === 'free_limited';
  const isFreeNow = !status.isActive;

  const badgeClasses = isPaidNow
    ? 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30'
    : isLimitedNow
      ? 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30';

  const statusLabel = isPaidNow
    ? 'DE PAGO AHORA'
    : isLimitedNow
      ? 'GRATIS CON LÍMITE'
      : 'GRATIS AHORA';

  const maxDurationText = formatMaxDuration(zone.maxDurationMinutes);

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="p-4">
        {/* Top row: zone name + traffic light badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`h-3.5 w-3.5 shrink-0 rounded-full ring-4 ${ZONE_DOT_CLASSES[zone.color]}`}
              aria-hidden="true"
            />
            <h2 className="font-semibold text-slate-900 dark:text-white leading-snug">
              {zone.name}
            </h2>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${badgeClasses}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Countdown / Next change */}
        <div className="mt-3 space-y-1">
          {status.nextChange ? (
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {isFreeNow ? (
                <>
                  Gratis hasta{' '}
                  <span className="font-semibold">
                    {status.nextChange.dayLabel} a las {status.nextChange.localTime}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    (en {formatMinutesRemaining(status.nextChange.minutesUntil)})
                  </span>
                </>
              ) : (
                <>
                  {zone.type === 'free_limited' ? 'Control' : 'De pago'} hasta{' '}
                  <span className="font-semibold">
                    {status.nextChange.dayLabel} a las {status.nextChange.localTime}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    (quedan {formatMinutesRemaining(status.nextChange.minutesUntil)})
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isFreeNow
                ? 'Sin regulación de pago programada.'
                : 'Regulación activa de forma continua.'}
            </p>
          )}

          {/* Contextual chips: reason, holiday, season, max duration */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {status.holiday && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <Calendar className="h-3 w-3" />
                {status.holiday.name}
              </span>
            )}
            {status.activeSeasonLabel && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                <Sun className="h-3 w-3" />
                {status.activeSeasonLabel}
              </span>
            )}
            {maxDurationText && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Clock className="h-3 w-3" />
                {maxDurationText}
              </span>
            )}
          </div>
        </div>

        {/* Today's schedule summary + toggle */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Hoy:{' '}
            <strong className="font-medium text-slate-700 dark:text-slate-200">
              {formatRanges(status.todayRanges)}
            </strong>
          </span>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 active:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-950/50"
            aria-expanded={expanded}
          >
            {expanded ? 'Ocultar horario' : 'Ver horario'}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable full schedule details */}
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 text-xs rounded-b-2xl dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-slate-400">
              Horario habitual
            </p>
            <ScheduleSummaryRows schedule={zone.schedule} />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">
                Festivos
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {zone.holidaysFree ? 'Gratis' : 'Regulado'}
              </span>
            </div>
          </div>

          {zone.seasonalRules && zone.seasonalRules.length > 0 && (
            <div className="border-t border-slate-200/70 pt-2.5 dark:border-slate-800">
              <p className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-400">
                Reglas especiales / Verano
              </p>
              {zone.seasonalRules.map((rule) => (
                <div key={rule.id} className="space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {rule.label}
                  </p>
                  <ScheduleSummaryRows schedule={rule.schedule} />
                </div>
              ))}
            </div>
          )}

          {zone.notes && (
            <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 p-2.5 text-slate-600 dark:bg-blue-500/10 dark:text-slate-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
              <p className="leading-relaxed">{zone.notes}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
