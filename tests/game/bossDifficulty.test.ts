// Release polish item 7: difficultyOf(w).bossScale multiplies boss hit points and attack cadence. The
// accessor is a stub returning normal until Forge wires GameOptions.difficulty, so this file stubs
// it per test to inject a table (vi.mock is file local).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { DIFFICULTY, type DifficultyTable } from '../../src/core/difficulty';
import { BOSS_TABLE, fullHpFor, WARDEN } from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import { Kind } from '../../src/game/world';
import { bs, bossGame, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

const table = vi.hoisted(() => ({ current: null as DifficultyTable | null }));

vi.mock('../../src/game/difficulty', async (orig) => {
  const real = await orig<typeof import('../../src/game/difficulty')>();
  return {
    ...real,
    difficultyOf: (w: Parameters<typeof real.difficultyOf>[0]) => table.current ?? real.difficultyOf(w),
  };
});

afterEach(() => {
  bus.clear();
  table.current = null;
});

function firstRingGap(): number {
  const w = bossGame('warden', { levelIndex: 20 });
  park(w, 600, 400);
  enter(w);
  const born: number[] = [];
  for (let i = 0; i < 120 * 12 && born.length < 2; i++) {
    stepGame(w, DT, idle());
    for (let h = 1; h < w.cap; h++) {
      if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Ring && (w.t[h] ?? 0) <= DT * 1.5) born.push(i * DT);
    }
  }
  return (born[1] ?? 0) - (born[0] ?? 0);
}

describe('difficulty bossScale in the sim (stubbed difficultyOf)', () => {
  for (const d of ['easy', 'normal', 'hard'] as const) {
    it(`${d}: Warden hit points and ring cadence times ${DIFFICULTY[d].bossScale}`, () => {
      table.current = DIFFICULTY[d];
      const k = DIFFICULTY[d].bossScale;
      const w = bossGame('warden', { levelIndex: 20 });
      enter(w);
      const s = bs(w);
      expect(s.maxHp * s.armour).toBeCloseTo(fullHpFor(BOSS_TABLE.warden, k), 4);
      expect(s.cadence).toBeCloseTo(k, 9);
      expect(firstRingGap()).toBeCloseTo(WARDEN.ringEvery / k, 1);
    });
  }

  it('Hard Spindle needs armour past the Int16 store and keeps its full hit points', () => {
    table.current = DIFFICULTY.hard;
    const w = bossGame('spindle', { levelIndex: 20 });
    enter(w);
    const s = bs(w);
    expect(s.maxHp).toBe(32767);
    expect(s.armour).toBeGreaterThan(1);
    expect(s.maxHp * s.armour).toBeCloseTo(fullHpFor(BOSS_TABLE.spindle, 1.35), 4);
  });
});
