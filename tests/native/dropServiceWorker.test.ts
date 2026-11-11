import { describe, expect, it, vi } from 'vitest';
import { dropServiceWorker, type SwEnv } from '../../src/native/dropServiceWorker';

function env(native: boolean, regs: number): { e: SwEnv; unreg: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> } {
  const unreg = vi.fn(() => Promise.resolve(true));
  const del = vi.fn(() => Promise.resolve(true));
  const reload = vi.fn();
  const list = Array.from({ length: regs }, () => ({ unregister: unreg }));
  const e = {
    isNative: () => native,
    serviceWorker: { getRegistrations: () => Promise.resolve(list) } as unknown as SwEnv['serviceWorker'],
    cacheKeys: () => Promise.resolve(['a', 'b']),
    deleteCache: del,
    reload,
  } satisfies SwEnv;
  return { e, unreg, del, reload };
}

describe('dropServiceWorker', () => {
  it('does nothing on the web', async () => {
    const x = env(false, 2);
    expect(await dropServiceWorker(x.e)).toBe(false);
    expect(x.unreg).not.toHaveBeenCalled();
    expect(x.del).not.toHaveBeenCalled();
    expect(x.reload).not.toHaveBeenCalled();
  });
  it('does nothing on native with no registration (no reload loop)', async () => {
    const x = env(true, 0);
    expect(await dropServiceWorker(x.e)).toBe(false);
    expect(x.reload).not.toHaveBeenCalled();
  });
  it('unregisters, clears caches and reloads once on native', async () => {
    const x = env(true, 2);
    expect(await dropServiceWorker(x.e)).toBe(true);
    expect(x.unreg).toHaveBeenCalledTimes(2);
    expect(x.del).toHaveBeenCalledTimes(2);
    expect(x.reload).toHaveBeenCalledTimes(1);
  });
  it('does nothing without service worker support', async () => {
    const x = env(true, 1);
    expect(await dropServiceWorker({ ...x.e, serviceWorker: undefined })).toBe(false);
  });
});
