// Boss calm pass (Ryan 2026-11-11): Brood numbers and the share of the wave schedule kept while a
// guardian lives, by difficulty.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { keepScheduledEntry } from '../../src/game/bosses/core';
import { BOSS_TABLE, BROODLING, WAVE_BUDGET_WITH_BOSS } from '../../src/game/bosses/table';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { inlineRectLevel } from '../../src/game/world';
import { bs, bossGame, enter } from './bossHelpers';
import { DT, idle } from './helpers';
import type { Difficulty } from '../../src/core/difficulty';
import type { LevelDef, SpawnEntry } from '../../src/levelgen/leveldef';

afterEach(() => bus.clear());

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'insane'];

describe('brood numbers', () => {
  it('body 340 and Broodlings 450 (45 hits each)', () => {
    expect(BOSS_TABLE.brood.hp).toBe(340);
    expect(BROODLING.hp).toBe(450);
  });
});

describe('wave budget while a guardian lives', () => {
  it('is 0, 0.25, 0.5, 0.6 by difficulty', () => {
    expect(WAVE_BUDGET_WITH_BOSS).toEqual({ easy: 0, normal: 0.25, hard: 0.5, insane: 0.6 });
  });

  it('keeps the table share of 100 entries once the boss is alive, all of them before', () => {
    for (const d of DIFFS) {
      const w = bossGame('warden', {}, { difficulty: d });
      let before = 0;
      for (let i = 0; i < 100; i++) if (keepScheduledEntry(w)) before++;
      expect(before).toBe(100);
      enter(w);
      bs(w).budgetAcc = 0;
      let kept = 0;
      for (let i = 0; i < 100; i++) if (keepScheduledEntry(w)) kept++;
      expect(kept).toBe(Math.round(WAVE_BUDGET_WITH_BOSS[d] * 100));
    }
  });

  it('spawns no regular enemy on Easy after the entrance, and some on Normal', () => {
    const base = inlineRectLevel(7);
    const entries: SpawnEntry[] = [];
    for (let i = 0; i < 20; i++) entries.push({ kind: 'grunt', tOffsetSec: 0, mode: 'fixed', x: -500 + i * 40, y: 300, angleDeg: 0, radius: 0, headingDeg: 0 });
    const waves: LevelDef['waves']['waves'] = [];
    for (let k = 0; k < 6; k++) waves.push({ index: k, atSec: 6 + k * 2, pattern: 'edges', entries });
    const patch: Partial<LevelDef> = { waves: { ...base.waves, waves, loopFromIndex: -1 } };
    const spawned = (d: Difficulty): number => {
      const w = bossGame('warden', patch, { difficulty: d, logSpawns: true });
      enter(w);
      const g = gs(w);
      const start = g.spawnLog?.length ?? 0;
      for (let i = 0; i < Math.round(20 / DT); i++) stepGame(w, DT, idle());
      return (g.spawnLog?.length ?? 0) - start;
    };
    expect(spawned('easy')).toBe(0);
    expect(spawned('normal')).toBeGreaterThan(0);
  });
});
