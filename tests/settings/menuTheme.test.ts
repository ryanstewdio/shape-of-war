import { describe, expect, it } from 'vitest';
import { loadMenuTheme, MENU_THEME_KEY, saveMenuTheme, SETTINGS_PREFIX, type StorageLike } from '../../src/core/settings';

function memory(init: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('storage disabled');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('menu theme persistence', () => {
  it('registers the documented key under the settings prefix', () => {
    expect(MENU_THEME_KEY).toBe('sow.settings.menuTheme');
    expect(MENU_THEME_KEY.startsWith(SETTINGS_PREFIX)).toBe(true);
  });

  it('loads null when nothing is stored or storage is missing', () => {
    expect(loadMenuTheme(memory())).toBeNull();
    expect(loadMenuTheme(null)).toBeNull();
  });

  it('round trips the raw value under the key', () => {
    for (const raw of ['0', '1', '2']) {
      const m = memory();
      saveMenuTheme(raw, m);
      expect(m.data.get(MENU_THEME_KEY)).toBe(raw);
      expect(loadMenuTheme(m)).toBe(raw);
    }
  });

  it('survives throwing storage and null storage without throwing', () => {
    expect(() => saveMenuTheme('1', throwing)).not.toThrow();
    expect(loadMenuTheme(throwing)).toBeNull();
    expect(() => saveMenuTheme('1', null)).not.toThrow();
  });
});
