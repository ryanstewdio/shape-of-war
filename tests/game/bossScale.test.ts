// Release polish item 7: bosses scale with the level (cadence and bullet speed 75 percent at level 5,
// 100 at level 20, 115 at level 50 and on loops), hit points past the Int16 store become armour, and
// the difficulty's bossScale multiplies hit points and cadence (applyBossScaling, called directly
// here; bossDifficulty.test.ts stubs difficultyOf in the sim).
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DIFFICULTY } from '../../src/core/difficulty';
import { applyBossScaling, armouredTenths, bossAdt, bossScaleLevel, damageBoss } from '../../src/game/bosses/core';
import {
  armourFor,
  BOSS_HP_MAX,
  BOSS_TABLE,
  bossNominalLevel,
  ENRAGE_AFTER_SEC,
  ENRAGE_RATE,
  fullHpFor,
  levelAttackScale,
  maxHpFor,
  WARDEN,
} from '../../src/game/bosses/table';
import { HazardType } from '../../src/game/bosses/types';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { bs, bossGame, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

function ringBirths(w: World, secs: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.round(secs * 120); i++) {
    stepGame(w, DT, idle());
    for (let h = 1; h < w.cap; h++) {
      if (w.alive[h] !== 1 || w.kind[h] !== Kind.BossHazard || w.a[h] !== HazardType.Ring) continue;
      if ((w.t[h] ?? 0) <= DT * 1.5) out.push(i * DT);
    }
  }
  return out;
}

describe('level scale (pure)', () => {
  it('75 percent at level 5 and below, 100 at 20, 115 at 50, linear between', () => {
    expect(levelAttackScale(1, false)).toBe(0.75);
    expect(levelAttackScale(5, false)).toBe(0.75);
    expect(levelAttackScale(10, false)).toBeCloseTo(0.75 + 0.25 / 3, 9);
    expect(levelAttackScale(15, false)).toBeCloseTo(0.75 + 0.5 / 3, 9);
    expect(levelAttackScale(20, false)).toBe(1);
    expect(levelAttackScale(35, false)).toBeCloseTo(1.075, 9);
    expect(levelAttackScale(50, false)).toBe(1.15);
    expect(levelAttackScale(80, false)).toBe(1.15);
  });

  it('rises with the level and every loop of the list plays at 115 percent', () => {
    let prev = 0;
    for (let l = 1; l <= 60; l++) {
      const s = levelAttackScale(l, false);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(levelAttackScale(5, true)).toBe(1.15);
    expect(levelAttackScale(20, true)).toBe(1.15);
  });

  it('Endless (level index 0) scales each boss at its first pass level', () => {
    BOSS_IDS.forEach((id, i) => {
      expect(bossScaleLevel(0, id)).toBe(bossNominalLevel(i));
      expect(bossScaleLevel(17, id)).toBe(17);
    });
    expect(bossNominalLevel(0)).toBe(5);
    expect(bossNominalLevel(9)).toBe(50);
  });
});

describe('hit points, armour and difficulty (pure)', () => {
  it('rows past the Int16 store keep the bar at the cap and the rest as armour', () => {
    for (const id of BOSS_IDS) {
      const row = BOSS_TABLE[id];
      const full = fullHpFor(row, 1);
      expect(maxHpFor(row, 1)).toBe(Math.min(full, BOSS_HP_MAX));
      expect(maxHpFor(row, 1) * armourFor(row, 1)).toBeCloseTo(full, 6);
    }
    // Boss health: every row fits the store at hpMul 1 (armour 1); a later pass or Insane can still pass it.
    for (const id of BOSS_IDS) expect(armourFor(BOSS_TABLE[id], 1)).toBe(1);
    expect(armourFor(BOSS_TABLE.twins, 2)).toBeGreaterThan(1);
    expect(maxHpFor(BOSS_TABLE.twins, 2) * armourFor(BOSS_TABLE.twins, 2)).toBeCloseTo(fullHpFor(BOSS_TABLE.twins, 2), 6);
  });

  it('armoured hits keep every tenth: a sum of hits lands its total over the armour', () => {
    let acc = 0;
    let landed = 0;
    const armour = 1.29;
    for (let i = 0; i < 1000; i++) {
      const n = armouredTenths(10, armour, acc);
      acc += 10 / armour - n;
      landed += n;
      expect(acc).toBeGreaterThanOrEqual(-1e-6);
      expect(acc).toBeLessThan(1);
    }
    expect(Math.abs(landed - 10000 / armour)).toBeLessThan(1);
    expect(armouredTenths(10, 1, 0)).toBe(10);
  });

  for (const d of ['easy', 'normal', 'hard'] as const) {
    it(`${d}: hit points and cadence times bossScale ${DIFFICULTY[d].bossScale}`, () => {
      const k = DIFFICULTY[d].bossScale;
      for (const id of BOSS_IDS) {
        const w = bossGame(id, { levelIndex: 20 });
        const s = bs(w);
        const max = applyBossScaling(w, s, k);
        expect(s.cadence).toBeCloseTo(k, 9);
        expect(s.levelScale).toBe(1);
        // Effective hit points (stored times armour) are the row times bossScale.
        expect(max * s.armour).toBeCloseTo(fullHpFor(BOSS_TABLE[id], k), 4);
        expect(max).toBeLessThanOrEqual(BOSS_HP_MAX);
      }
    });
  }

  it('cadence is the level scale times bossScale, and enrage still multiplies attack time', () => {
    const w = bossGame('warden', { levelIndex: 5 });
    const s = bs(w);
    applyBossScaling(w, s, DIFFICULTY.hard.bossScale);
    expect(s.cadence).toBeCloseTo(0.75 * 1.35, 9);
    expect(bossAdt(w, s, 1)).toBeCloseTo(0.75 * 1.35, 9);
    s.age = ENRAGE_AFTER_SEC;
    expect(bossAdt(w, s, 1)).toBeCloseTo(0.75 * 1.35 * ENRAGE_RATE, 9);
  });
});

describe('level scale in the sim', () => {
  it('Warden at level 5 rings at 75 percent cadence; at level 20 at the table rate', () => {
    const gap = (level: number): number => {
      const w = bossGame('warden', { levelIndex: level });
      park(w, 600, 400);
      enter(w);
      const born = ringBirths(w, 9);
      expect(born.length).toBeGreaterThanOrEqual(2);
      return (born[1] ?? 0) - (born[0] ?? 0);
    };
    expect(gap(20)).toBeCloseTo(WARDEN.ringEvery, 1);
    expect(gap(5)).toBeCloseTo(WARDEN.ringEvery / 0.75, 1);
  });

  it('Spindle pellets fly at 75 percent speed at level 5 and 100 percent at level 20', () => {
    const speed = (level: number): number => {
      const w = bossGame('spindle', { levelIndex: level });
      park(w, 600, 400);
      enter(w);
      for (let i = 0; i < 120 * 12; i++) {
        stepGame(w, DT, idle());
        const p = enemyBulletsOf(w);
        for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1) return Math.hypot(p.vx[e] ?? 0, p.vy[e] ?? 0);
      }
      return 0;
    };
    expect(speed(20)).toBeCloseTo(180, 3);
    expect(speed(5)).toBeCloseTo(180 * 0.75, 3);
  });

  it('a loop boss (hpMul above 1) plays at 115 percent wherever it falls', () => {
    const w = bossGame('warden', { levelIndex: 5 });
    const s = bs(w);
    s.spec = { ...s.spec, hpMul: 1.25 };
    applyBossScaling(w, s, 1);
    expect(s.levelScale).toBe(1.15);
  });

  it('armour slows an armoured core by exactly its factor', () => {
    const w = bossGame('spindle');
    enter(w);
    const s = bs(w);
    const id = s.id;
    const before = w.hp[id] ?? 0;
    for (let i = 0; i < 100; i++) damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0);
    expect(before - (w.hp[id] ?? 0)).toBe(Math.floor(1000 / s.armour + 1e-9));
  });

  it('every boss reaches the sim with its scale set from its campaign level', () => {
    for (const id of BOSS_IDS as readonly BossId[]) {
      const level = bossNominalLevel(BOSS_IDS.indexOf(id));
      const w = bossGame(id, { levelIndex: level });
      enter(w);
      const s = bs(w);
      expect(s.levelScale).toBeCloseTo(levelAttackScale(level, false), 9);
      expect(s.cadence).toBeCloseTo(s.levelScale, 9); // Normal: bossScale 1 until Forge wires the choice
    }
  });
});
