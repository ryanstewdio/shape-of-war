// Release polish (docs/14 item 6): sow.settings.difficulty persistence, the Settings model and the
// card's last choice (R2). No real localStorage: a Map backed store, and a store that throws.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTIES } from '../../src/core/difficulty';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_KEY,
  LAST_DIFFICULTY_KEY,
  loadDifficulty,
  loadLastDifficulty,
  parseDifficulty,
  saveDifficulty,
  saveLastDifficulty,
  type StorageLike,
} from '../../src/core/settings';
import {
  createSettingsModel,
  createSettingsScreen,
  DIFFICULTY_ROW_LABEL,
  difficultyButtonStates,
  difficultyLabel,
  type SettingsActions,
  type SettingsEffects,
} from '../../src/ui/settings';
import { asParent, groupButtons, installFakeDocument } from '../ui/fakeDom';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

function fx(): SettingsEffects & { calls: string[] } {
  const calls: string[] = [];
  const log = (name: string) => () => void calls.push(name);
  return {
    calls,
    setShowFps: log('showFps'),
    setGlowPath: log('glowPath'),
    applyNeon: log('neon'),
    setVolume: log('volume'),
    setWeaponPickups: log('weapons'),
    setEffectsTier: log('effects'),
    setTilt: log('tilt'),
    setMusicVolume: log('music'),
    requestFrame: (cb) => cb(),
  };
}

function actions(): SettingsActions {
  return {
    back: () => undefined,
    playSeed: () => undefined,
    seedHash: () => null,
    resetProgress: () => undefined,
    stress: () => undefined,
    currentNeon: () => 70,
    buildId: 'abc1234 2026-11-02T10:00Z',
  };
}

describe('difficulty key', () => {
  it('is sow.settings.difficulty and defaults to normal', () => {
    expect(DIFFICULTY_KEY).toBe('sow.settings.difficulty');
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(loadDifficulty(memory())).toBe('normal');
  });

  it('parses only the four exact strings; anything else is normal', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard', 'insane']);
    for (const d of DIFFICULTIES) expect(parseDifficulty(d)).toBe(d);
    for (const bad of [null, '', 'Easy', 'HARD', ' hard', 'medium', '1', 'Insane', 'INSANE']) expect(parseDifficulty(bad), String(bad)).toBe('normal');
  });

  it('round trips every value and writes only its own key', () => {
    for (const d of DIFFICULTIES) {
      const s = memory();
      saveDifficulty(d, s);
      expect([...s.data.keys()]).toEqual([DIFFICULTY_KEY]);
      expect(s.data.get(DIFFICULTY_KEY)).toBe(d);
      expect(loadDifficulty(s)).toBe(d);
    }
  });

  it('a corrupt stored value reads as normal', () => {
    const s = memory();
    s.data.set(DIFFICULTY_KEY, 'nightmare');
    expect(loadDifficulty(s)).toBe('normal');
  });

  it('survives a storage that throws and a missing storage', () => {
    expect(loadDifficulty(throwing)).toBe('normal');
    expect(() => saveDifficulty('hard', throwing)).not.toThrow();
    expect(loadDifficulty(null)).toBe('normal');
    expect(() => saveDifficulty('easy', null)).not.toThrow();
  });
});

// R2: the Settings Difficulty row is gone. The model's difficulty is the card's last choice,
// stored in sow.progress.difficulty; the old sow.settings.difficulty is read only, to seed it once.
describe('difficulty in the settings model (R2: the card\'s last choice)', () => {
  it('seeds from the old Settings key, then persists a card tap in sow.progress.difficulty without any effect', () => {
    const s = memory();
    s.data.set(DIFFICULTY_KEY, 'hard');
    const f = fx();
    const m = createSettingsModel(f, s);
    expect(m.state.difficulty).toBe('hard');
    m.setDifficulty('easy');
    expect(m.state.difficulty).toBe('easy');
    expect(s.data.get(LAST_DIFFICULTY_KEY)).toBe('easy');
    expect(s.data.get(DIFFICULTY_KEY)).toBe('hard'); // the old key is never written again
    expect(f.calls).toEqual([]);
    expect(createSettingsModel(fx(), s).state.difficulty).toBe('easy');
  });

  it('writes only the last choice key', () => {
    const s = memory();
    createSettingsModel(fx(), s).setDifficulty('hard');
    expect([...s.data.keys()]).toEqual([LAST_DIFFICULTY_KEY]);
  });

  it('loadLastDifficulty: the card key wins, a corrupt one reads as normal, a throwing store as normal', () => {
    const s = memory();
    expect(loadLastDifficulty(s)).toBe('normal');
    s.data.set(DIFFICULTY_KEY, 'insane');
    expect(loadLastDifficulty(s)).toBe('insane');
    saveLastDifficulty('easy', s);
    expect(loadLastDifficulty(s)).toBe('easy');
    s.data.set(LAST_DIFFICULTY_KEY, 'nightmare');
    expect(loadLastDifficulty(s)).toBe('normal');
    expect(loadLastDifficulty(throwing)).toBe('normal');
    expect(() => saveLastDifficulty('hard', throwing)).not.toThrow();
  });
});

describe('Difficulty labels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('labels are Easy, Normal, Hard and Insane with the current one marked', () => {
    expect(DIFFICULTY_ROW_LABEL).toBe('Difficulty');
    expect(DIFFICULTIES.map(difficultyLabel)).toEqual(['Easy', 'Normal', 'Hard', 'Insane']);
    expect(difficultyButtonStates('normal').map((b) => b.selected)).toEqual([false, true, false, false]);
    expect(difficultyButtonStates('insane').map((b) => b.selected)).toEqual([false, false, false, true]);
    expect(difficultyButtonStates('hard').map((b) => b.label)).toEqual(['Easy', 'Normal', 'Hard', 'Insane']);
  });

  it('R2: the row is no longer on the settings screen', () => {
    const root = installFakeDocument();
    const screen = createSettingsScreen(asParent(root), createSettingsModel(fx(), memory()), actions());
    screen.show();
    expect(groupButtons(root, DIFFICULTY_ROW_LABEL)).toEqual([]);
  });
});
