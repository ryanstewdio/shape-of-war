import { Capacitor } from '@capacitor/core';

export interface SwEnv {
  readonly isNative: () => boolean;
  readonly serviceWorker: Pick<ServiceWorkerContainer, 'getRegistrations'> | undefined;
  readonly cacheKeys: () => Promise<readonly string[]>;
  readonly deleteCache: (key: string) => Promise<boolean>;
  readonly reload: () => void;
}

/**
 * Native only: the app bundles its files, so a service worker left over from an
 * older PWA install must go. When at least one registration exists, unregister
 * all of them, clear every cache, then reload once. Does nothing on the web or
 * when no registration exists, so the reload cannot loop.
 * Resolves true when it triggered a reload.
 */
export async function dropServiceWorker(env: SwEnv): Promise<boolean> {
  if (!env.isNative() || env.serviceWorker === undefined) return false;
  const regs = await env.serviceWorker.getRegistrations();
  if (regs.length === 0) return false;
  await Promise.all(regs.map((r) => r.unregister()));
  const keys = await env.cacheKeys();
  await Promise.all(keys.map((k) => env.deleteCache(k)));
  env.reload();
  return true;
}

/** Browser wiring for dropServiceWorker. Errors are swallowed: cleanup is best effort. */
export function installServiceWorkerCleanup(): void {
  if (!Capacitor.isNativePlatform()) return;
  void dropServiceWorker({
    isNative: () => Capacitor.isNativePlatform(),
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    cacheKeys: () => (typeof caches === 'undefined' ? Promise.resolve([]) : caches.keys()),
    deleteCache: (k) => caches.delete(k),
    reload: () => location.reload(),
  }).catch(() => {});
}
