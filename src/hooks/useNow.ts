import { useEffect, useState } from 'react';

/**
 * Returns a Date that refreshes every 30 seconds and immediately
 * when the PWA returns to the foreground on iOS/Android.
 */
export function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return now;
}
