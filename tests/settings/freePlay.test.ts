// Free Play options (docs/14): the last setup persists under sow.settings.freePlay as JSON,
// validated field by field on load, defaults from DEFAULT_FREE_PLAY.
import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from '../../src/core/freeplayConfig';
import {
  DEFAULT_FREE_PLAY_SETUP,
  encodeFreePlaySetup,
  FREE_PLAY_ENEMY_KINDS,
  FREE_PLAY_KEY,
  loadFreePlaySetup,
  parseEnemyKinds,
  parseFreePlayConfig,
  parseFreePlaySetup,
  saveFreePlaySetup,
  type FreePlaySetup,
  type StorageLike,
} from '../../src/core/settings';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('disabled');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

const CUSTOM: FreePlaySetup = {
  arena: 'drum',
  barriers: true,
  config: {
    enemies: ['grunt', 'splime', 'dart'],
    density: 'swarm',
    lives: 'infinite',
    length: 300,
    weapon: 'pierce',
    pickups: false,
    drone: 'ram',
    superType: 'homing',
    bosses: 'tempest',
    wells: 'many',
    drift: 'high',
    size: 'large',
  },
};

describe('sow.settings.freePlay', () => {
  it('is one key under the settings prefix', () => {
    expect(FREE_PLAY_KEY).toBe('sow.settings.freePlay');
  });

  it('defaults to rect, barriers off and DEFAULT_FREE_PLAY', () => {
    expect(loadFreePlaySetup(memory())).toEqual({ arena: 'rect', barriers: false, config: DEFAULT_FREE_PLAY });
    expect(DEFAULT_FREE_PLAY_SETUP.config).toBe(DEFAULT_FREE_PLAY);
  });

  it('round trips a full custom setup (enemies come back in screen order)', () => {
    const s = memory();
    saveFreePlaySetup(CUSTOM, s);
    const back = loadFreePlaySetup(s);
    expect(back).toEqual({ ...CUSTOM, config: { ...CUSTOM.config, enemies: ['grunt', 'dart', 'splime'] } });
    expect(JSON.parse(s.data.get(FREE_PLAY_KEY) ?? '')).toEqual(JSON.parse(encodeFreePlaySetup(back)));
  });

  it('round trips every value of every field', () => {
    const variants: Partial<FreePlayConfig>[] = [
      ...(['low', 'normal', 'swarm'] as const).map((density) => ({ density })),
      ...([1, 3, 5, 'infinite'] as const).map((lives) => ({ lives })),
      ...(['endless', 180, 300, 600] as const).map((length) => ({ length })),
      ...([null, 'spread', 'rapid', 'pierce', 'orbit'] as const).map((weapon) => ({ weapon })),
      { pickups: true },
      { pickups: false },
      ...(['attack', 'collect', 'ram'] as const).map((drone) => ({ drone })),
      ...(['homing', 'detonate', 'turbo'] as const).map((superType) => ({ superType })),
      ...(['off', 'every3', 'warden', 'prism'] as const).map((bosses) => ({ bosses })),
      ...(['off', 'normal', 'many'] as const).map((wells) => ({ wells })),
      ...(['off', 'low', 'high'] as const).map((drift) => ({ drift })),
      ...(['small', 'medium', 'large'] as const).map((size) => ({ size })),
      { enemies: [...FREE_PLAY_ENEMY_KINDS] },
      { enemies: [] },
    ];
    expect(variants.length).toBe(39);
    for (const v of variants) {
      const setup: FreePlaySetup = { arena: 'circle', barriers: true, config: { ...DEFAULT_FREE_PLAY, ...v } };
      const s = memory();
      saveFreePlaySetup(setup, s);
      expect(loadFreePlaySetup(s), JSON.stringify(v)).toEqual(setup);
    }
  });

  it('falls back to the default on missing, empty, malformed or non object JSON', () => {
    for (const raw of [null, '', '{not json', '42', '"rect"', '[]', 'null']) {
      expect(parseFreePlaySetup(raw), String(raw)).toEqual(DEFAULT_FREE_PLAY_SETUP);
    }
  });

  it('a bad field takes its own default and the rest survive', () => {
    const raw = JSON.stringify({
      arena: 'hexagon',
      barriers: 'yes',
      config: { ...CUSTOM.config, lives: 4, length: 120, weapon: 'laser', density: 'max', bosses: 'kraken', pickups: 'off', size: 2 },
    });
    const v = parseFreePlaySetup(raw);
    expect(v.arena).toBe('rect');
    expect(v.barriers).toBe(false);
    expect(v.config.lives).toBe(DEFAULT_FREE_PLAY.lives);
    expect(v.config.length).toBe(DEFAULT_FREE_PLAY.length);
    expect(v.config.weapon).toBe(DEFAULT_FREE_PLAY.weapon);
    expect(v.config.density).toBe(DEFAULT_FREE_PLAY.density);
    expect(v.config.bosses).toBe(DEFAULT_FREE_PLAY.bosses);
    expect(v.config.pickups).toBe(DEFAULT_FREE_PLAY.pickups);
    expect(v.config.size).toBe(DEFAULT_FREE_PLAY.size);
    expect(v.config.drone).toBe('ram');
    expect(v.config.superType).toBe('homing');
    expect(v.config.wells).toBe('many');
    expect(v.config.drift).toBe('high');
    expect(v.config.enemies).toEqual(['grunt', 'dart', 'splime']);
  });

  it('a string length or lives ("300", "3") is not accepted', () => {
    const v = parseFreePlayConfig({ length: '300', lives: '3' });
    expect(v.length).toBe('endless');
    expect(v.lives).toBe(3);
  });

  it('enemy lists drop unknown kinds and repeats, and a non list is empty', () => {
    expect(parseEnemyKinds(['snake', 'mine', 'grunt', 'snake', 7, null])).toEqual(['grunt', 'snake']);
    expect(parseEnemyKinds('grunt')).toEqual([]);
    expect(parseEnemyKinds(undefined)).toEqual([]);
    expect(FREE_PLAY_ENEMY_KINDS.length).toBe(13); // forge-leaver: the Leaver toggle
  });

  it('a missing config object reads as DEFAULT_FREE_PLAY', () => {
    expect(parseFreePlaySetup(JSON.stringify({ arena: 'drum', barriers: true })).config).toEqual(DEFAULT_FREE_PLAY);
    expect(parseFreePlayConfig('nope')).toEqual(DEFAULT_FREE_PLAY);
  });

  it('storage that throws never throws: the save is dropped and the load reads the default', () => {
    expect(() => saveFreePlaySetup(CUSTOM, throwing)).not.toThrow();
    expect(loadFreePlaySetup(throwing)).toEqual(DEFAULT_FREE_PLAY_SETUP);
    expect(loadFreePlaySetup(null)).toEqual(DEFAULT_FREE_PLAY_SETUP);
  });

  it('the stored JSON is JSON safe and holds only arena, barriers and config', () => {
    const s = memory();
    saveFreePlaySetup(CUSTOM, s);
    expect(Object.keys(JSON.parse(s.data.get(FREE_PLAY_KEY) ?? '{}') as object).sort()).toEqual(['arena', 'barriers', 'config']);
  });
});
