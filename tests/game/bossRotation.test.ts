// Release polish item 7: long fights stay varied. Every boss cycles a three pattern bullet rotation
// (aimed fan, radial burst, pincer) on top of its signature attack, one escalation per phase, and no
// pattern repeats more than twice in a row. Determinism: two runs of each boss on its own level, the
// rotation on, hash equal, with Math.random stubbed to throw.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss } from '../../src/game/bosses/core';
import {
  Pattern,
  patternAt,
  patternBullets,
  patternHeading,
  repeatsAtMostTwice,
  rotationEvery,
  rotationSpeed,
} from '../../src/game/bosses/rotation';
import { bossOf, type BossState } from '../../src/game/bosses/state';
import { bossNominalLevel, ROTATION, SHOT_VOLLEY_MAX } from '../../src/game/bosses/table';
import { ENEMY_BULLET_SPEED_MAX, enemyBulletsOf } from '../../src/game/enemyBullets';
import { createGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { bs, bossGame, bossLevel, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const DEG = Math.PI / 180;

function wrap(a: number): number {
  let v = a;
  while (v > Math.PI) v -= 2 * Math.PI;
  while (v < -Math.PI) v += 2 * Math.PI;
  return v;
}

/** The rotation log oldest first. */
function logOf(s: BossState): number[] {
  const n = Math.min(s.rotCount, ROTATION.logSize);
  const out: number[] = [];
  for (let k = s.rotCount - n; k < s.rotCount; k++) out.push(s.rotLog[k % ROTATION.logSize] ?? -1);
  return out;
}

/** Hold the ship far from the boss (opposite corner region), so every due volley is in range. */
function holdFar(w: World, s: BossState): void {
  const b = s.split ? -1 : s.id;
  const bx = b > 0 ? (w.x[b] ?? 0) : 0;
  const by = b > 0 ? (w.y[b] ?? 0) : 0;
  park(w, bx > 0 ? -560 : 560, by > 0 ? -330 : 330);
}

describe('rotation (pure)', () => {
  it('cycles fan, burst, pincer and never repeats a pattern twice in a row', () => {
    const seq: number[] = [];
    for (let k = 0; k < 30; k++) seq.push(patternAt(k));
    expect(seq.slice(0, 3)).toEqual([Pattern.Fan, Pattern.Burst, Pattern.Pincer]);
    expect(new Set(seq).size).toBe(3);
    for (let k = 1; k < seq.length; k++) expect(seq[k]).not.toBe(seq[k - 1]);
    expect(repeatsAtMostTwice(seq, seq.length)).toBe(true);
    expect(repeatsAtMostTwice([0, 0, 1], 3)).toBe(true);
    expect(repeatsAtMostTwice([0, 0, 0], 3)).toBe(false);
  });

  it('one escalation per phase: one more bullet per side and shorter gaps', () => {
    for (let ph = 1; ph <= 4; ph++) {
      expect(patternBullets(Pattern.Fan, ph)).toBe(Math.min(SHOT_VOLLEY_MAX, ROTATION.fanBase + ph - 1));
      expect(patternBullets(Pattern.Burst, ph)).toBe(ROTATION.burstBase + ROTATION.burstPerPhase * (ph - 1));
      expect(patternBullets(Pattern.Pincer, ph)).toBe(2 * (ROTATION.pincerPairs + ph - 1));
      if (ph > 1) {
        expect(patternBullets(Pattern.Burst, ph)).toBeGreaterThan(patternBullets(Pattern.Burst, ph - 1));
        expect(patternBullets(Pattern.Pincer, ph)).toBeGreaterThan(patternBullets(Pattern.Pincer, ph - 1));
        for (let t = 1; t <= 4; t++) expect(rotationEvery(t, ph)).toBeLessThan(rotationEvery(t, ph - 1));
      }
    }
  });

  it('fan centred on the ship, burst leaves the ship between two bullets, pincer never on the bearing', () => {
    const b = 0.4;
    const fan = [0, 1, 2].map((k) => wrap(patternHeading(Pattern.Fan, b, k, 3) - b));
    expect(fan[1]).toBeCloseTo(0, 9);
    expect((fan[2] ?? 0) - (fan[1] ?? 0)).toBeCloseTo(ROTATION.fanSpreadDeg * DEG, 9);
    const n = patternBullets(Pattern.Burst, 1);
    let nearest = Math.PI;
    for (let k = 0; k < n; k++) nearest = Math.min(nearest, Math.abs(wrap(patternHeading(Pattern.Burst, b, k, n) - b)));
    expect(nearest).toBeCloseTo(Math.PI / n, 9);
    for (let ph = 1; ph <= 4; ph++) {
      const m = patternBullets(Pattern.Pincer, ph);
      for (let k = 0; k < m; k++) {
        expect(Math.abs(wrap(patternHeading(Pattern.Pincer, b, k, m) - b))).toBeGreaterThanOrEqual(ROTATION.pincerDeg * DEG - 1e-9);
      }
    }
  });

  it('speed follows the level scale and never passes the pool cap', () => {
    expect(rotationSpeed(1)).toBe(ROTATION.speed);
    expect(rotationSpeed(0.75)).toBeCloseTo(ROTATION.speed * 0.75, 9);
    expect(rotationSpeed(1.15)).toBeLessThanOrEqual(ENEMY_BULLET_SPEED_MAX);
  });
});

describe('rotation in the sim, every boss on its own level', () => {
  for (const id of BOSS_IDS) {
    it(`${id}: at least 3 distinct patterns in 60 s, none more than twice in a row, escalated in phase 2`, () => {
      const level = bossNominalLevel(BOSS_IDS.indexOf(id));
      const w = bossGame(id, { lives: 99, levelIndex: level }, {}, true, 0.25, true);
      enter(w);
      const s = bs(w);
      for (let i = 0; i < 120 * 60; i++) {
        holdFar(w, s);
        stepGame(w, DT, idle());
      }
      const log = logOf(s);
      expect(log.length).toBeGreaterThanOrEqual(3);
      expect(new Set(log).size).toBe(3);
      expect(repeatsAtMostTwice(log, log.length)).toBe(true);
      // Phase 2: the next fan carries one more bullet (the boss itself sets the phase).
      if (s.status !== 'alive' || s.split) return;
      s.open = true;
      damageBoss(w, Math.ceil(s.maxHp * 0.5) + 2, w.x[s.id] ?? 0, w.y[s.id] ?? 0, true);
      if (s.phase < 2) return; // a boss whose phase follows its parts (Bastion, Twins) keeps phase 1 here
      s.rotCount = 3 * Math.ceil(s.rotCount / 3); // next volley is a fan
      s.rotT = 0;
      const p = enemyBulletsOf(w);
      const was = new Uint8Array(p.cap);
      for (let i = 0; i < 120 * 10 && s.rotCount % 3 === 0; i++) {
        for (let e = 0; e < p.cap; e++) was[e] = p.alive[e] ?? 0;
        holdFar(w, s);
        stepGame(w, DT, idle());
        if (s.rotCount % 3 === 1) {
          let fresh = 0;
          for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1 && was[e] !== 1) fresh++;
          expect(fresh).toBeGreaterThanOrEqual(patternBullets(Pattern.Fan, s.phase));
        }
      }
    });
  }

  it('off by the test switch: no rotation volley fires', () => {
    const w = bossGame('warden', { levelIndex: 20 });
    enter(w);
    for (let i = 0; i < 120 * 30; i++) {
      holdFar(w, bs(w));
      stepGame(w, DT, idle());
    }
    expect(bs(w).rotCount).toBe(0);
  });
});

/** A scripted input log: wander and fire at the arena centre, with a bomb at 20 s. */
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

function hashRun(id: BossId): number[] {
  const level = bossNominalLevel(BOSS_IDS.indexOf(id));
  const w: World = createGame(bossLevel(id, { lives: 40, par: 6000, levelIndex: level }, 2), { vibrate: () => undefined });
  const out: number[] = [];
  const input = idle();
  let h = 0;
  for (let i = 0; i < 120 * 45; i++) {
    stepGame(w, DT, inputAt(i, input));
    const s = bossOf(w);
    const b = s === null ? -1 : s.id;
    h = (h * 31 + (b > 0 ? (w.x[b] ?? 0) * 7 + (w.y[b] ?? 0) * 13 + (w.hp[b] ?? 0) : 0)) % 1e9;
    const p = enemyBulletsOf(w);
    for (let e = 0; e < p.cap; e++) if (p.alive[e] === 1) h = (h + e * 3 + (p.x[e] ?? 0) + (p.y[e] ?? 0) * 5) % 1e9;
    for (let e = 1; e < w.cap; e++) if (w.alive[e] === 1 && (w.kind[e] === Kind.BossHazard || w.kind[e] === Kind.BossPart)) h = (h + e + (w.x[e] ?? 0)) % 1e9;
    if (i % 120 === 0) out.push(h, s === null ? -1 : s.rotCount, gs(w).lives, gs(w).score);
  }
  return out;
}

describe('determinism with scaling and the rotation on', () => {
  for (const id of BOSS_IDS) {
    it(`${id}: two runs on its own level hash equal, no Math.random`, () => {
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random called');
      });
      const a = hashRun(id);
      const b = hashRun(id);
      expect(a).toEqual(b);
      // The run is not empty: the hash moved. (Warden, seeking the ship, often stays inside the 300 u
      // shot range here, so the rotation firing is covered by the held at range test above.)
      expect(new Set(a.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(10);
    });
  }
});
