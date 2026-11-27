import { RefreshCw } from 'lucide-react';

interface UpdateBannerProps {
  visible: boolean;
  updating: boolean;
  onUpdate: () => void;
}

export function UpdateBanner({
  visible,
  updating,
  onUpdate,
}: UpdateBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-600 px-3.5 py-2.5 text-white shadow-sm dark:border-blue-500/40"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold">Nueva versión disponible</p>
        <p className="text-[11px] text-blue-100">
          Actualiza para cargar los últimos horarios verificados.
        </p>
      </div>
      <button
        type="button"
        onClick={onUpdate}
        disabled={updating}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-xs active:scale-95 disabled:opacity-70"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
        {updating ? 'Actualizando...' : 'Actualizar ahora'}
      </button>
    </div>
  );
}
