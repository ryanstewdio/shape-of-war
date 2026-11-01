// Tempest GW4 (device gate GW4, build a1bbf1c: Tempestlings "no dashing, just pursuing the ship",
// fairness 3). These tests play the real level 40 boss fight from the generator through the real
// step loop: the boss enters, the body is cracked to its split, then a scripted ship circles without
// firing (shielded, drone on Collect) and each Tempestling must make at least 3 committed dashes of
// at least 200 u in 20 s, each after its own lane marker. Root cause on main: the pincer came about
// every 9 s (the body's phase 3 dashEvery of chase plus a 2.5 s flank wait that always ran out
// against a circling ship), and on an obstacle floor rayToWall's bisection could promise a line past
// an obstacle, so the marked dash stopped short. Chase 165 u/s, wind up 0.7 s with the marker.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossHittable, damageBoss, livePart } from '../../src/game/bosses/core';
import { bossOf, type BossState } from '../../src/game/bosses/state';
import { CRACK_AT, TEMPESTLING } from '../../src/game/bosses/table';
import { firstDashClock, RAY_STEP, rayToWall, SLOT, tempestlingDashEvery, tempestlingSpeed, TempestMove } from '../../src/game/bosses/tempest';
import { HazardType } from '../../src/game/bosses/types';
import { isInside } from '../../src/game/arena';
import { createGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { generateLevel } from '../../src/levelgen/generator';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

/** Seeds 1 and 2 put level 40 on a circle floor, seed 42 on a rect floor with obstacles. */
const SEEDS = [1, 2, 3, 7, 42, 12345];
const FIGHT_SEC = 20;

function bossState(w: World): BossState {
  const s = bossOf(w);
  if (s === null) throw new Error('no boss state');
  return s;
}

/** The real level 40 game, played until the Tempest is past its entrance, then cracked to its split. */
function splitLevel40(seed: number): World {
  const def = generateLevel(seed, 40);
  expect(def.boss?.id).toBe('tempest');
  const w = createGame({ ...def, drone: 'collect' }); // no drone shot touches the parts
  gs(w).invulnerable = true;
  const input = idle();
  let id = -1;
  for (let i = 0; i < 120 * 120 && id < 0; i++) {
    stepGame(w, DT, input);
    id = bossHittable(w);
  }
  expect(id).toBeGreaterThan(0);
  const s = bossState(w);
  w.hp[id] = Math.floor(s.maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
  expect(s.split).toBe(true);
  return w;
}

/** The ship circles: a stick turning at 1.2 rad/s, never aiming (no shots). */
function circle(step: number, out: InputState): InputState {
  const t = step * DT * 1.2;
  out.move.active = true;
  out.move.x = Math.cos(t);
  out.move.y = Math.sin(t);
  out.aim.active = false;
  return out;
}

function isMarker(w: World, s: BossState, m: number): boolean {
  return m > 0 && w.alive[m] === 1 && w.kind[m] === Kind.BossHazard && w.a[m] === HazardType.Lane && s.hzMarker[m] === 1;
}

interface PartTrace {
  dashes: number[];
  unmarked: number;
  windups: number[];
}

function fight(seed: number): PartTrace[] {
  const w = splitLevel40(seed);
  const s = bossState(w);
  const parts = [livePart(w, s, 0), livePart(w, s, 1)];
  const out: PartTrace[] = [0, 1].map(() => ({ dashes: [], unmarked: 0, windups: [] }));
  const prev = [TempestMove.Lap, TempestMove.Lap];
  const marked = [false, false];
  const wStart = [0, 0];
  const sx = [0, 0];
  const sy = [0, 0];
  const input = idle();
  for (let i = 0; i < 120 * FIGHT_SEC; i++) {
    stepGame(w, DT, circle(i, input));
    const t = (i + 1) * DT;
    for (let k = 0; k < 2; k++) {
      const p = parts[k] ?? -1;
      expect(w.alive[p]).toBe(1); // nothing damages them
      const tr = out[k] as PartTrace;
      const st = (s.abl[k * SLOT] ?? 0) as TempestMove;
      const was = prev[k] as TempestMove;
      if (st === TempestMove.Windup && was !== TempestMove.Windup) {
        marked[k] = isMarker(w, s, s.abl[k * SLOT + 7] ?? -1);
        wStart[k] = t;
      }
      if (st === TempestMove.Windup && !isMarker(w, s, s.abl[k * SLOT + 7] ?? -1)) {
        // The marker may only expire in the wind up's last step.
        if ((s.abl[k * SLOT + 1] ?? 0) > DT + 0.02) marked[k] = false;
      }
      if (st === TempestMove.Dash && was !== TempestMove.Dash) {
        if (was !== TempestMove.Windup || !marked[k]) tr.unmarked++;
        tr.windups.push(t - (wStart[k] ?? 0));
        sx[k] = w.x[p] ?? 0;
        sy[k] = w.y[p] ?? 0;
      }
      if (was === TempestMove.Dash && st !== TempestMove.Dash) {
        tr.dashes.push(Math.hypot((w.x[p] ?? 0) - (sx[k] ?? 0), (w.y[p] ?? 0) - (sy[k] ?? 0)));
      }
      prev[k] = st;
    }
  }
  return out;
}

describe('tempestling gw4 rules', () => {
  it('chase 165 u/s, a 0.7 s wind up, dashEvery (2.6 s since GW5) of chase between pincers, the first 1.5 s after the split', () => {
    expect(tempestlingSpeed()).toBe(165);
    expect(TEMPESTLING.windupSec).toBe(0.7);
    expect(tempestlingDashEvery()).toBe(TEMPESTLING.dashEvery);
    expect(firstDashClock(tempestlingDashEvery())).toBeCloseTo(TEMPESTLING.dashEvery - 1.5, 9);
    expect(TEMPESTLING.dashMin).toBe(200);
  });

  it('rayToWall stops at the first obstacle on the line, not past it', () => {
    const w = createGame(generateLevel(42, 40));
    const arena = w.level.arena;
    expect(arena.shape).toBe('rectObstacles');
    let checked = 0;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const len = rayToWall(w, 0, 0, a, 27);
      if (!isInside(arena, 0, 0, 27)) continue;
      checked++;
      for (let d = 0; d <= len; d += RAY_STEP / 2) expect(isInside(arena, Math.cos(a) * d, Math.sin(a) * d, 27)).toBe(true);
    }
    expect(checked).toBe(64);
  });
});

describe('tempestlings dash in the real level 40 fight (GW4)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: each makes at least 3 marked committed dashes of 200 u or more in 20 s`, () => {
      const parts = fight(seed);
      for (const tr of parts) {
        expect(tr.unmarked).toBe(0);
        const long = tr.dashes.filter((d) => d >= TEMPESTLING.dashMin);
        expect(long.length).toBeGreaterThanOrEqual(3);
        for (const wu of tr.windups) expect(wu).toBeGreaterThan(TEMPESTLING.windupSec - DT - 1e-6);
      }
    });
  }

  it('determinism: two real level 40 split fights hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const w = splitLevel40(42);
      const input = idle();
      let h = 1;
      for (let i = 0; i < 120 * FIGHT_SEC; i++) {
        stepGame(w, DT, circle(i, input));
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      return h;
    };
    expect(once()).toBe(once());
  });
});
