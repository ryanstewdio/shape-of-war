import { describe, expect, it } from 'vitest';
import { DEFAULT_TILT, loadTilt, parseTilt, saveTilt, TILT_KEY, TILT_SETTINGS, type StorageLike } from '../../src/core/settings';
import { createSettingsModel, tiltButtonStates, tiltLabel, TILT_ROW_LABEL, type SettingsEffects } from '../../src/ui/settings';

function memory(init: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function fx(calls: string[]): SettingsEffects {
  return {
    setShowFps: () => undefined,
    setGlowPath: () => undefined,
    applyNeon: () => undefined,
    setVolume: () => undefined,
    setSpacePhysics: () => undefined,
    setWeaponPickups: () => undefined,
    setEffectsTier: () => undefined,
    setTilt: (l) => calls.push(`tilt:${l}`),
    setMusicVolume: () => undefined,
    requestFrame: () => undefined,
  };
}

describe('tilt setting persistence', () => {
  it('uses the documented key, defaults to off and lists Off, Low, High', () => {
    expect(TILT_KEY).toBe('sow.settings.tilt');
    expect(DEFAULT_TILT).toBe('off');
    expect(TILT_SETTINGS).toEqual(['off', 'low', 'high']);
    expect(loadTilt(memory())).toBe('off');
    expect(loadTilt(null)).toBe('off');
  });

  it('round trips each level and rejects junk', () => {
    for (const l of TILT_SETTINGS) {
      const m = memory();
      saveTilt(l, m);
      expect(m.data.get(TILT_KEY)).toBe(l);
      expect(loadTilt(m)).toBe(l);
    }
    for (const junk of ['HIGH', 'medium', '', ' low', 'true']) expect(parseTilt(junk)).toBe('off');
    expect(parseTilt(null)).toBe('off');
  });

  it('the model applies the stored level at boot, once per change, and persists', () => {
    const store = memory({ [TILT_KEY]: 'low' });
    const calls: string[] = [];
    const m = createSettingsModel(fx(calls), store);
    expect(m.state.tilt).toBe('low');
    m.applyBoot();
    m.setTilt('low');
    m.setTilt('high');
    m.setTilt('high');
    m.setTilt('off');
    expect(calls).toEqual(['tilt:low', 'tilt:high', 'tilt:off']);
    expect(store.data.get(TILT_KEY)).toBe('off');
  });

  it('labels the row and marks the current level', () => {
    expect(TILT_ROW_LABEL).toBe('3D tilt');
    expect(TILT_SETTINGS.map(tiltLabel)).toEqual(['Off', 'Low', 'High']);
    expect(tiltButtonStates('high').map((b) => b.selected)).toEqual([false, false, true]);
  });
});
