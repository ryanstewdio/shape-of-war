import { describe, expect, it } from 'vitest';
import { ADVENTURE_SCORES_KEY, loadAdventureScores, loadUnlocked, unlockLevel } from '../../src/core/settings';
import { isDev, gateSearch } from '../../src/ui/devGate';
import { ADVENTURE_LEVELS, unlockAllLevels } from '../../src/ui/devUnlock';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe('dev unlock', () => {
  it('unlocks 50 levels and keeps stars and scores', () => {
    const st = memory();
    st.setItem(ADVENTURE_SCORES_KEY, JSON.stringify({ '3': { best: 1234, stars: 2 } }));
    const before = loadAdventureScores(st);
    expect(before['3']?.best).toBe(1234);
    expect(unlockAllLevels((i) => unlockLevel(i, st))).toBe(ADVENTURE_LEVELS);
    expect(loadUnlocked(st)).toBe(50);
    expect(loadAdventureScores(st)).toEqual(before);
  });
  it('never lowers a higher unlock', () => {
    const st = memory();
    unlockLevel(60, st);
    unlockAllLevels((i) => unlockLevel(i, st));
    expect(loadUnlocked(st)).toBe(60);
  });
});

describe('isDev with the build flag', () => {
  it('is on with VITE_SOW_DEV=1 and no query', () => {
    expect(isDev('', '1')).toBe(true);
    expect(gateSearch('?boss=brood', '1')).toBe('?boss=brood');
  });
  it('is off without the flag or the query', () => {
    expect(isDev('', undefined)).toBe(false);
    expect(isDev('', '0')).toBe(false);
    expect(gateSearch('?boss=brood', undefined)).toBe('');
  });
  it('?dev=1 still works with the flag off', () => {
    expect(isDev('?dev=1', undefined)).toBe(true);
  });
});
