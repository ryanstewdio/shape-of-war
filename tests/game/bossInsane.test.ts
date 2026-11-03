// R1 (Ryan): Insane is 20 percent harder than Hard; bosses use their abilities faster and bring
// more minions. Cadence and hit points scale with bossScale (bossDifficulty.test.ts); this file
// covers the minion counts (addScale, rounded, at least 1, inside the pools and caps) and the
// Insane telegraph (15 percent shorter) on Warden, Bastion and Brood, and Insane determinism.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { bastionHornets, bulwarksFor } from '../../src/game/bosses/bastion';
import { addsPerWaveFor } from '../../src/game/bosses/brood';
import { countAdds, countHornets } from '../../src/game/bosses/core';
import { hazardTelegraph } from '../../src/game/bosses/kit';
import {
  bossTele,
  hornetCap,
  INSANE_TELEGRAPH_SCALE,
  minionCount,
  telegraphScaleFor,
} from '../../src/game/bosses/scale';
import { bossOf } from '../../src/game/bosses/state';
import {
  BASTION_SHIELD,
  BROOD,
  BROODLING,
  HORNET_CAP,
  MAX_ADDS,
  MAX_HORNETS,
  MAX_PARTS,
  PRISM,
  WARDEN_SHIELD,
} from '../../src/game/bosses/table';
import { createGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { BossId } from '../../src/levelgen/leveldef';
import { bossGame, bossLevel, bs, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const add = (d: Difficulty): number => DIFFICULTY[d].addScale;

describe('pure scales', () => {
  it('minionCount rounds, keeps at least 1 and stays under the cap', () => {
    expect(minionCount(10, 1, 16)).toBe(10);
    expect(minionCount(10, 1.6, 16)).toBe(16);
    expect(minionCount(10, 2, 16)).toBe(16);
    expect(minionCount(1, 0.75, 8)).toBe(1);
    expect(minionCount(1, 0.1, 8)).toBe(1);
    expect(minionCount(3, 0.75, 8)).toBe(2);
    expect(minionCount(0, 1.6, 8)).toBe(0);
    expect(minionCount(4, Number.NaN, 8)).toBe(4);
  });

  it('only Insane shortens the telegraph, by 15 percent', () => {
    expect(INSANE_TELEGRAPH_SCALE).toBe(0.85);
    for (const d of DIFFICULTIES) expect(telegraphScaleFor(d)).toBe(d === 'insane' ? 0.85 : 1);
  });

  it('Warden Hornets per shield: 8, 10, 13, 16 inside the pool of 16', () => {
    const want: Record<Difficulty, number> = { easy: 8, normal: 10, hard: 13, insane: 16 };
    for (const d of DIFFICULTIES) {
      expect(minionCount(WARDEN_SHIELD.hornetsMin, add(d), MAX_HORNETS)).toBe(want[d]);
      expect(hornetCap(add(d))).toBe(want[d]);
    }
    expect(HORNET_CAP).toBe(10);
    expect(MAX_HORNETS).toBe(16);
  });

  it('Bastion: Hornets per shield 6, 8, 10, 13 and Bulwarks per wave 1, 1, 1, 2', () => {
    const hornets: Record<Difficulty, number> = { easy: 6, normal: 8, hard: 10, insane: 13 };
    const bulwarks: Record<Difficulty, number> = { easy: 1, normal: 1, hard: 1, insane: 2 };
    for (const d of DIFFICULTIES) {
      expect(bastionHornets(add(d))).toBe(hornets[d]);
      expect(bastionHornets(add(d))).toBeLessThanOrEqual(hornetCap(add(d)));
      expect(bulwarksFor(add(d))).toBe(bulwarks[d]);
    }
    expect(BASTION_SHIELD.hornets).toBe(8);
  });

  it('Brood: Darts per wave and Broodling Darts scale, inside the add slots', () => {
    const p1: Record<Difficulty, number> = { easy: 2, normal: 3, hard: 4, insane: 5 };
    const p2: Record<Difficulty, number> = { easy: 3, normal: 4, hard: 5, insane: 6 };
    const darts: Record<Difficulty, number> = { easy: 2, normal: 2, hard: 3, insane: 3 };
    for (const d of DIFFICULTIES) {
      expect(minionCount(addsPerWaveFor(1), add(d), MAX_ADDS)).toBe(p1[d]);
      expect(minionCount(addsPerWaveFor(2), add(d), MAX_ADDS)).toBe(p2[d]);
      expect(minionCount(BROODLING.dartsPerWave, add(d), MAX_ADDS)).toBe(darts[d]);
    }
    expect(BROOD.addsPerWave).toBe(3);
  });

  it('Prism pods (its Brood echo) scale inside the part slots', () => {
    expect(DIFFICULTIES.map((d) => minionCount(PRISM.pods, add(d), MAX_PARTS))).toEqual([2, 3, 4, 4]);
  });
});

/** Largest rise in a count across one step over secs: the size of one wave. */
function biggestWave(w: World, secs: number, countOf: () => number): number {
  let prev = countOf();
  let best = 0;
  for (let i = 0; i < Math.round(secs * 120); i++) {
    stepGame(w, DT, idle());
    const n = countOf();
    if (n - prev > best) best = n - prev;
    prev = n;
  }
  return best;
}

/** Telegraph of the first boss hazard seen in secs (hzTele of a lethal hazard), -1 if none. */
function firstHazardTele(w: World, secs: number): number {
  for (let i = 0; i < Math.round(secs * 120); i++) {
    stepGame(w, DT, idle());
    for (let h = 1; h < w.cap; h++) {
      if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && bs(w).hzMarker[h] !== 1) {
        const t = bs(w).hzTele[h] ?? 0;
        if (t > 0) return t;
      }
    }
  }
  return -1;
}

function game(id: BossId, d: Difficulty): World {
  const w = bossGame(id, { par: 1000 }, { difficulty: d });
  park(w, 600, 400);
  enter(w);
  return w;
}

describe('in the sim, per difficulty', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: the boss carries addScale and the telegraph scale`, () => {
      const w = game('warden', d);
      expect(bs(w).addScale).toBe(add(d));
      expect(bs(w).teleScale).toBe(telegraphScaleFor(d));
      expect(bossTele(bs(w))).toBeCloseTo(hazardTelegraph(1) * telegraphScaleFor(d), 9);
    });
  }

  for (const d of ['normal', 'insane'] as Difficulty[]) {
    it(`${d}: Warden's first shield releases ${minionCount(10, add(d), MAX_HORNETS)} Hornets`, () => {
      const w = game('warden', d);
      let peak = 0;
      for (let i = 0; i < 120 * (WARDEN_SHIELD.firstSec + 2.5); i++) {
        stepGame(w, DT, idle());
        peak = Math.max(peak, countHornets(w, bs(w)));
      }
      expect(peak).toBe(minionCount(10, add(d), MAX_HORNETS));
    });

    it(`${d}: Warden's ring telegraph is ${hazardTelegraph(1) * telegraphScaleFor(d)} s`, () => {
      expect(firstHazardTele(game('warden', d), 10)).toBeCloseTo(hazardTelegraph(1) * telegraphScaleFor(d), 6); // Float32 store
    });

    it(`${d}: Brood's first Dart wave is ${minionCount(3, add(d), MAX_ADDS)}`, () => {
      const w = game('brood', d);
      expect(biggestWave(w, 4, () => countAdds(w, bs(w)))).toBe(minionCount(3, add(d), MAX_ADDS));
    });

    it(`${d}: Brood's charge marker shows the scaled telegraph`, () => {
      const w = game('brood', d);
      // Markers end just short of the telegraph; the wind up itself is bossTele long.
      expect(bossTele(bs(w))).toBeCloseTo(hazardTelegraph(1) * telegraphScaleFor(d), 9);
      let marker = -1;
      for (let i = 0; i < 120 * 6 && marker < 0; i++) {
        stepGame(w, DT, idle());
        for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && bs(w).hzMarker[h] === 1) marker = h;
      }
      expect(marker).toBeGreaterThan(0);
      expect(bs(w).hzTele[marker] ?? 0).toBeCloseTo(hazardTelegraph(1) * telegraphScaleFor(d), 6);
    });

    it(`${d}: Bastion's Bulwark wave is ${minionCount(1, add(d), MAX_ADDS)} and its lanes telegraph scaled`, () => {
      const w = game('bastion', d);
      expect(biggestWave(w, 16, () => countAdds(w, bs(w)))).toBe(minionCount(1, add(d), MAX_ADDS));
      expect(firstHazardTele(game('bastion', d), 6)).toBeCloseTo(hazardTelegraph(3) * telegraphScaleFor(d), 6);
    });
  }
});

/** The bossDeterminism input script: wander, fire, a bomb at 20 s, a super every 15 s. */
function inputAt(step: number, out: InputState): InputState {
  const t = step * DT;
  out.move.active = true;
  out.move.x = Math.cos(t * 0.7) * 0.9;
  out.move.y = Math.sin(t * 1.1) * 0.9;
  out.aim.active = true;
  out.aim.x = Math.cos(t * 0.5);
  out.aim.y = Math.sin(t * 0.5);
  out.bomb = step === 120 * 20;
  out.superPressed = step % (120 * 15) === 0 && step > 0;
  return out;
}

/** A 40 s Insane run folded into one hash (FNV style over the boss, its parts, hazards and adds). */
function insaneHash(id: BossId): number {
  const w = createGame(bossLevel(id, { lives: 40, par: 6000 }, 2), { vibrate: () => undefined, difficulty: 'insane' });
  const input = idle();
  let h = 2166136261;
  const mix = (v: number): void => {
    h = Math.imul(h ^ (Math.round(v * 1000) | 0), 16777619) >>> 0;
  };
  for (let i = 0; i < 120 * 40; i++) {
    stepGame(w, DT, inputAt(i, input));
    const s = bossOf(w);
    const b = s === null ? -1 : s.id;
    mix(b > 0 ? (w.x[b] ?? 0) : 0);
    mix(b > 0 ? (w.hp[b] ?? 0) : 0);
    mix(s === null ? 0 : s.phase);
    for (let e = 1; e < w.cap; e++) {
      if (w.alive[e] !== 1) continue;
      const k = w.kind[e] ?? 0;
      if (k === Kind.BossHazard || k === Kind.BossPart || (s !== null && s.addIds.includes(e))) {
        mix(e);
        mix(w.x[e] ?? 0);
        mix(w.y[e] ?? 0);
      }
    }
    mix(gs(w).score);
    mix(gs(w).lives);
  }
  return h;
}

describe('Insane determinism', () => {
  for (const id of ['warden', 'bastion', 'brood'] as BossId[]) {
    it(`${id}: two Insane runs hash equal, no Math.random`, () => {
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random in boss code');
      });
      const a = insaneHash(id);
      bus.clear();
      expect(insaneHash(id)).toBe(a);
    });
  }
});
