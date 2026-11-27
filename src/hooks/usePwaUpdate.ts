import { useCallback, useEffect, useRef, useState } from 'react';

export interface PwaUpdateState {
  updateAvailable: boolean;
  updating: boolean;
  applyUpdate: () => void;
}

/**
 * Tracks Service Worker updates natively (no extra workbox-window dependency)
 * so the user sees an "Actualizar ahora" button whenever a new version is ready.
 */
export function usePwaUpdate(): PwaUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isMounted = true;
    let registrationRef: ServiceWorkerRegistration | null = null;
    let reloading = false;

    const markWaiting = (worker: ServiceWorker | null) => {
      if (!isMounted || !worker) return;
      waitingWorkerRef.current = worker;
      setUpdateAvailable(true);
    };

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

    const attachRegistration = (reg: ServiceWorkerRegistration) => {
      registrationRef = reg;

      if (reg.waiting) {
        markWaiting(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            markWaiting(reg.waiting ?? installing);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && isMounted) {
        attachRegistration(reg);
      }
    });

    // Check for updates whenever the user brings the PWA back to the foreground
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        registrationRef?.update().catch(() => {
          // Ignore offline update check failures
        });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingWorkerRef.current;
    if (!waiting) {
      window.location.reload();
      return;
    }
    setUpdating(true);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  return { updateAvailable, updating, applyUpdate };
}
