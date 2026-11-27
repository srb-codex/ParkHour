import { useState } from 'react';
import { Share, X } from 'lucide-react';

const DISMISS_KEY = 'parkhour_install_hint_dismissed_v1';

function shouldShowIosInstallHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return false;
  } catch {
    // ignore
  }

  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return isIos && !isStandalone;
}

export function InstallHint() {
  const [visible, setVisible] = useState<boolean>(() =>
    shouldShowIosInstallHint(),
  );

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-3.5 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Share className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="leading-relaxed">
            <strong>Instala ParkHour en tu iPhone:</strong> pulsa el botón{' '}
            <em>Compartir</em> de Safari y elige{' '}
            <strong>«Añadir a pantalla de inicio»</strong> para usarla como app
            incluso sin cobertura.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          aria-label="Ocultar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
