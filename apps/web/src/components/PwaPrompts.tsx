import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { BrandMark } from './Brand';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as NavigatorWithStandalone;
  const standaloneMedia =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
  return standaloneMedia || navigatorWithStandalone.standalone === true;
}

/**
 * Production-only service-worker registration and the small, dismissible
 * surfaces around it: offline status, install invitation, and update prompt.
 *
 * Registration is skipped in development so Vite's HMR and test runs are not
 * affected. The service worker itself is generated at build time by the Vite
 * plugin in vite.config.ts.
 */
export function PwaPrompts() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [installVisible, setInstallVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequestedRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setInstallDismissed(false);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (installEvent === null || installDismissed || isStandalone) {
      setInstallVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setInstallVisible(true), 6000);
    return () => window.clearTimeout(timer);
  }, [installEvent, installDismissed, isStandalone]);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const handleControllerChange = () => {
      if (reloadRequestedRef.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const watchInstallingWorker = (registration: ServiceWorkerRegistration) => {
      const installing = registration.installing;
      if (installing === null) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller !== null) {
          setUpdateReady(true);
          setUpdateDismissed(false);
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;
        if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
          setUpdateReady(true);
        }
        registration.addEventListener('updatefound', () => watchInstallingWorker(registration));
      })
      .catch(() => {
        // Registration failure should never prevent the archive from working.
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const install = async () => {
    if (installEvent === null) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      setIsStandalone(true);
    } else {
      setInstallDismissed(true);
    }
  };

  const applyUpdate = async () => {
    setApplyingUpdate(true);
    const waiting = registrationRef.current?.waiting;
    if (waiting === undefined || waiting === null) {
      window.location.reload();
      return;
    }
    reloadRequestedRef.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  const showInstall = installEvent !== null && installVisible && !installDismissed && !isStandalone;
  const showUpdate = updateReady && !updateDismissed;

  if (online && !showInstall && !showUpdate) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-end sm:p-5">
      {!online && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-forest-deep bg-forest-deep px-4 py-3 text-ivory shadow-panel sm:max-w-md"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-ivory/70" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">You&rsquo;re offline</p>
            <p className="mt-0.5 text-xs leading-5 text-ivory/70">
              Pages you have already visited remain available. New records will load when you
              reconnect.
            </p>
          </div>
        </div>
      )}

      {showUpdate && (
        <div
          role="region"
          aria-label="Application update"
          className="pointer-events-auto rounded-xl border border-line bg-paper p-4 shadow-panel sm:max-w-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                role="status"
                aria-live="polite"
                className="font-display text-lg leading-tight text-ink"
              >
                A newer edition is ready
              </p>
              <p className="mt-1 text-xs leading-5 text-earth-ink">
                Refresh to see the latest archive updates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUpdateDismissed(true)}
              className="btn-icon -mr-2 -mt-2 h-10 w-10"
              aria-label="Dismiss update notice"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyUpdate()}
              disabled={applyingUpdate}
              className="btn-primary btn-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {applyingUpdate ? 'Refreshing…' : 'Refresh now'}
            </button>
            <button
              type="button"
              onClick={() => setUpdateDismissed(true)}
              className="btn-ghost btn-sm"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {showInstall && (
        <div
          role="complementary"
          aria-label="Install EnteBharatham"
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-paper p-1.5 shadow-panel"
        >
          <BrandMark className="ml-1.5 h-7 w-7 shrink-0" />
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex min-h-10 items-center gap-2 px-2.5 text-xs font-semibold text-forest transition-colors hover:text-terracotta-deep"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Install app
          </button>
          <button
            type="button"
            onClick={() => setInstallDismissed(true)}
            className="flex h-10 w-10 items-center justify-center text-earth-ink transition-colors hover:bg-cream hover:text-ink"
            aria-label="Dismiss install prompt"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
