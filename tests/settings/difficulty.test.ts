// Release polish (docs/14 item 6): sow.settings.difficulty persistence, the Settings model and the
// Difficulty row. No real localStorage: a Map backed store, and a store that throws.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTIES } from '../../src/core/difficulty';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_KEY,
  loadDifficulty,
  parseDifficulty,
  saveDifficulty,
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
    setSpacePhysics: log('space'),
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

  it('parses only the three exact strings; anything else is normal', () => {
    for (const d of DIFFICULTIES) expect(parseDifficulty(d)).toBe(d);
    for (const bad of [null, '', 'Easy', 'HARD', ' hard', 'medium', '1']) expect(parseDifficulty(bad), String(bad)).toBe('normal');
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

describe('difficulty in the settings model', () => {
  it('loads the stored value and persists a tap without calling any effect', () => {
    const s = memory();
    s.data.set(DIFFICULTY_KEY, 'hard');
    const f = fx();
    const m = createSettingsModel(f, s);
    expect(m.state.difficulty).toBe('hard');
    m.setDifficulty('easy');
    expect(m.state.difficulty).toBe('easy');
    expect(s.data.get(DIFFICULTY_KEY)).toBe('easy');
    expect(f.calls).toEqual([]);
    expect(createSettingsModel(fx(), s).state.difficulty).toBe('easy');
  });

  it('writes only its own key', () => {
    const s = memory();
    createSettingsModel(fx(), s).setDifficulty('hard');
    expect([...s.data.keys()]).toEqual([DIFFICULTY_KEY]);
  });
});

describe('Difficulty row', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('labels are Easy, Normal and Hard with the current one marked', () => {
    expect(DIFFICULTY_ROW_LABEL).toBe('Difficulty');
    expect(DIFFICULTIES.map(difficultyLabel)).toEqual(['Easy', 'Normal', 'Hard']);
    expect(difficultyButtonStates('normal').map((b) => b.selected)).toEqual([false, true, false]);
    expect(difficultyButtonStates('hard').map((b) => b.label)).toEqual(['Easy', 'Normal', 'Hard']);
  });

  it('is on the settings screen; a tap lights the button and saves the key', () => {
    const root = installFakeDocument();
    const s = memory();
    const model = createSettingsModel(fx(), s);
    const screen = createSettingsScreen(asParent(root), model, actions());
    screen.show();
    const buttons = groupButtons(root, DIFFICULTY_ROW_LABEL);
    expect(buttons.map((b) => b.textContent)).toEqual(['Easy', 'Normal', 'Hard']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    buttons[2]?.tap();
    expect(model.state.difficulty).toBe('hard');
    expect(s.data.get(DIFFICULTY_KEY)).toBe('hard');
    expect(buttons.map((b) => b.classList.contains('sow-on'))).toEqual([false, false, true]);
  });
});
