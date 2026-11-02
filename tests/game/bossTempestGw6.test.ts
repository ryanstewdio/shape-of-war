// Tempest GW6 (device retest on fb7dff2: Tempestlings dash "in a clumsy manner that is not
// threatening", "somewhat stay off walls but get stuck sometimes", fairness 5, target 4). Each dash
// aims at the ship's lead point (ship plus velocity times the dash travel time, clamped to the
// arena), the aim tracks through a 0.5 s wind up and locks at its end, the line stops wallClip from
// the walls, the part turns back to the ship within 0.2 s, slot 1 cuts across slot 0's line at its
// aim point, and a part near a wall or not moving steers to the centre for 0.6 s.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossHittable, damageBoss, livePart } from '../../src/game/bosses/core';
import { bossOf, type BossState } from '../../src/game/bosses/state';
import { CRACK_AT, TEMPESTLING } from '../../src/game/bosses/table';
import {
  clipRadius,
  createAimPoint,
  flankSide,
  leadAim,
  leadPoint,
  MARKER_SLACK,
  SLOT,
  stepTempestling,
  TEMPESTLING_SLOT as S,
  TempestMove,
  turnRate,
  turnToward,
  unstuckDue,
} from '../../src/game/bosses/tempest';
import { confine, isInside } from '../../src/game/arena';
import { createGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { ArenaDef } from '../../src/levelgen/leveldef';
import { generateLevel } from '../../src/levelgen/generator';
import { stateHash } from './bossGw2Helpers';
import { earlyBoss } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function bossState(w: World): BossState {
  const s = bossOf(w);
  if (s === null) throw new Error('no boss state');
  return s;
}

/** The real level 40 game, played until the Tempest is past its entrance, then cracked to its split. */
function splitLevel40(seed: number): World {
  const def = earlyBoss(generateLevel(seed, 40));
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

const at = (s: BossState, k: number, off: number): number => s.abl[k * SLOT + off] ?? 0;
const set = (s: BossState, k: number, off: number, v: number): void => {
  s.abl[k * SLOT + off] = v;
};

/** A split world with part 0 placed at (x, y) and the ship at (sx, sy) moving at (vx, vy); part 1 resting. */
function staged(x: number, y: number, sx: number, sy: number, vx: number, vy: number): { w: World; s: BossState; p: number } {
  const w = splitLevel40(1);
  const s = bossState(w);
  const p = livePart(w, s, 0);
  expect(p).toBeGreaterThan(0);
  w.x[p] = x;
  w.y[p] = y;
  w.x[0] = sx;
  w.y[0] = sy;
  w.vx[0] = vx;
  w.vy[0] = vy;
  set(s, 1, S.move, TempestMove.Rest);
  set(s, 1, S.timer, 5);
  return { w, s, p };
}

describe('tempestling gw6 pure rules', () => {
  it('wind up 0.5 s, turn within 0.2 s, dash lines clipped 60 u, unstuck numbers', () => {
    expect(TEMPESTLING.windupSec).toBe(0.5);
    expect(TEMPESTLING.turnSec).toBe(0.2);
    expect(turnRate() * 0.2).toBeCloseTo(1.5 * Math.PI, 9); // a half turn well inside 0.2 s
    expect(clipRadius(27)).toBe(87);
    expect(TEMPESTLING.nearWall).toBe(140);
    expect(TEMPESTLING.stuckMove).toBe(40);
    expect(TEMPESTLING.stuckWindow).toBe(1);
    expect(TEMPESTLING.unstuckSec).toBe(0.6);
  });

  it('leadPoint: the ship plus velocity times the travel time (and the extra wind up left)', () => {
    const out = createAimPoint();
    leadPoint(-300, 0, 0, 0, 0, 0, 462, 0.3, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    for (const extra of [0, 0.25, 0.5]) {
      leadPoint(-300, 0, 0, 0, 0, 200, 462, extra, out);
      const t = extra + Math.hypot(out.x + 300, out.y) / 462;
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.y).toBeCloseTo(200 * t, 1);
      expect(out.y).toBeGreaterThan(200 * (extra + 300 / 462) - 1e-9);
    }
  });

  it('leadAim clamps the lead point inside the arena, margin from every wall', () => {
    const w = createGame(generateLevel(42, 40));
    const arena = w.level.arena;
    const out = createAimPoint();
    leadAim(arena, 0, 0, arena.width / 2 - 100, 0, 900, 0, 462, 0.5, 87, out);
    expect(isInside(arena, out.x, out.y, 87 - 1e-6)).toBe(true);
    expect(out.x).toBeLessThan(arena.width / 2 - 86);
  });

  it('turnToward turns the short way, at most maxStep', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25, 9);
    expect(turnToward(0, -1, 0.25)).toBeCloseTo(-0.25, 9);
    expect(turnToward(3, -3, 1)).toBeCloseTo(-3, 9); // across pi, the short way
    expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1, 9);
  });

  it('unstuckDue: near a wall for 1 s, or under 40 u moved over a closed 1 s window', () => {
    expect(unstuckDue(0.99, -1)).toBe(false);
    expect(unstuckDue(1, -1)).toBe(true);
    expect(unstuckDue(0, 39)).toBe(true);
    expect(unstuckDue(0, 41)).toBe(false);
    expect(unstuckDue(0, -1)).toBe(false);
  });

  it('flankSide picks the quarter turn nearer slot 1', () => {
    expect(flankSide(0, 1)).toBe(1);
    expect(flankSide(0, -1)).toBe(-1);
    expect(flankSide(3, -3)).toBe(1);
  });
});

describe('lead aim and line lock', () => {
  it('the dash locks on the lead point at the wind up end, not on the ship', () => {
    const { w, s, p } = staged(-300, 0, 0, 0, 0, 220);
    set(s, 0, S.move, TempestMove.Windup);
    set(s, 0, S.timer, DT);
    set(s, 0, S.mark, -1);
    stepTempestling(w, p, DT);
    expect(at(s, 0, S.move)).toBe(TempestMove.Dash);
    const lead = leadAim(w.level.arena, -300, 0, 0, 0, 0, 220, TEMPESTLING.dashSpeed, 0, clipRadius(w.radius[p] ?? 0), createAimPoint());
    const want = Math.atan2(lead.y, lead.x + 300);
    expect(at(s, 0, S.heading)).toBeCloseTo(want, 6);
    expect(Math.abs(at(s, 0, S.heading) - Math.atan2(0, 300))).toBeGreaterThan(0.2); // led, not aimed at the ship
    expect(lead.y).toBeGreaterThan(100);
  });

  it('the aim tracks the lead point during the wind up, with the wind up left added', () => {
    const { w, s, p } = staged(-300, 0, 0, 0, 0, 150);
    set(s, 0, S.move, TempestMove.Windup);
    set(s, 0, S.timer, MARKER_SLACK); // no marker here: a wind up this short keeps going without one
    set(s, 0, S.mark, -1);
    stepTempestling(w, p, DT);
    expect(at(s, 0, S.move)).toBe(TempestMove.Windup);
    const lead = leadAim(w.level.arena, -300, 0, 0, 0, 0, 150, TEMPESTLING.dashSpeed, MARKER_SLACK - DT, clipRadius(w.radius[p] ?? 0), createAimPoint());
    expect(at(s, 0, S.heading)).toBeCloseTo(Math.atan2(lead.y, lead.x + 300), 6);
    expect(w.rot[p]).toBeCloseTo(at(s, 0, S.heading), 6); // rot is float32
  });

  it('once locked the dash keeps its line whatever the ship does, and ends 60 u off the walls', () => {
    const { w, s, p } = staged(-300, 0, 0, 0, 0, 220);
    set(s, 0, S.move, TempestMove.Windup);
    set(s, 0, S.timer, DT);
    set(s, 0, S.mark, -1);
    stepTempestling(w, p, DT);
    const h = at(s, 0, S.heading);
    const len = at(s, 0, S.len);
    expect(len).toBeGreaterThan(TEMPESTLING.dashMin);
    const x0 = w.x[p] ?? 0;
    const y0 = w.y[p] ?? 0;
    let steps = 0;
    while (at(s, 0, S.move) === TempestMove.Dash && steps < 1000) {
      w.x[0] = 200 * Math.cos(steps); // the ship jumps about
      w.y[0] = -200 * Math.sin(steps);
      w.vx[0] = -300;
      w.vy[0] = 100;
      stepTempestling(w, p, DT);
      expect(at(s, 0, S.heading)).toBe(h);
      steps++;
    }
    expect(at(s, 0, S.move)).toBe(TempestMove.Rest);
    const dx = (w.x[p] ?? 0) - x0;
    const dy = (w.y[p] ?? 0) - y0;
    expect(Math.atan2(dy, dx)).toBeCloseTo(h, 4);
    expect(Math.hypot(dx, dy)).toBeCloseTo(len, 3);
    expect(isInside(w.level.arena, w.x[p] ?? 0, w.y[p] ?? 0, clipRadius(w.radius[p] ?? 0) - 1e-6)).toBe(true);
  });
});

describe('unstuck rule', () => {
  it('near a wall for 1 s in the chase: steers toward the arena centre for 0.6 s', () => {
    const { w, s, p } = staged(0, 0, 0, 0, 0, 0);
    const arena = w.level.arena;
    const c = confine(arena, -1e5, 0, 120); // a point 120 u inside the wall
    w.x[p] = c.x;
    w.y[p] = c.y;
    w.x[0] = c.x + 200;
    w.y[0] = c.y;
    set(s, 0, S.move, TempestMove.Lap);
    set(s, 0, S.dash, 0);
    set(s, 0, S.near, TEMPESTLING.nearSec - DT / 2);
    set(s, 0, S.ancX, c.x - 500); // far, so the move window does not fire
    set(s, 0, S.ancY, c.y);
    stepTempestling(w, p, DT);
    expect(at(s, 0, S.unstuck)).toBeCloseTo(TEMPESTLING.unstuckSec, 9);
    let d = Math.hypot(w.x[p] ?? 0, w.y[p] ?? 0);
    let steps = 0;
    while (at(s, 0, S.unstuck) > 0 && steps < 200) {
      stepTempestling(w, p, DT);
      const d2 = Math.hypot(w.x[p] ?? 0, w.y[p] ?? 0);
      expect(d2).toBeLessThan(d); // closer to the arena centre every step
      d = d2;
      steps++;
    }
    expect(steps * DT).toBeCloseTo(TEMPESTLING.unstuckSec, 1);
  });

  it('under 40 u moved over the last 1 s of chase triggers it; 40 u or more does not', () => {
    for (const moved of [10, 100]) {
      const { w, s, p } = staged(0, 0, 300, 0, 0, 0);
      set(s, 0, S.move, TempestMove.Lap);
      set(s, 0, S.dash, 0);
      set(s, 0, S.win, TEMPESTLING.stuckWindow - DT / 2);
      set(s, 0, S.ancX, moved);
      set(s, 0, S.ancY, 0);
      stepTempestling(w, p, DT);
      expect(at(s, 0, S.unstuck) > 0).toBe(moved < TEMPESTLING.stuckMove);
      expect(at(s, 0, S.win)).toBe(0);
    }
  });
});

/**
 * Distance from (x, y) to the arena's outer wall (obstacles left out, as the brief's test reads):
 * exact for the rect floors, a 1 u search for the others.
 */
function wallGap(arena: ArenaDef, x: number, y: number): number {
  if (arena.shape === 'rect' || arena.shape === 'rectObstacles') return Math.min(arena.width / 2 - Math.abs(x), arena.height / 2 - Math.abs(y));
  let d = 0;
  while (d < arena.width && isInside(arena, x, y, d + 1)) d++;
  return d;
}

interface Gw6Trace {
  maxNear: number;
  dashes: number;
  turnChecks: number;
  turnMiss: number;
  pincers: number;
  crossOff: number;
  across: number[];
  endsNearWall: number;
}

/** A real split fight: watch near wall stretches, dash ends, the post dash turn and pincer crosses. */
function watch(seed: number, secs: number, move: (i: number, out: InputState) => InputState): Gw6Trace {
  const w = splitLevel40(seed);
  const s = bossState(w);
  const arena = w.level.arena;
  const parts = [livePart(w, s, 0), livePart(w, s, 1)];
  const out: Gw6Trace = { maxNear: 0, dashes: 0, turnChecks: 0, turnMiss: 0, pincers: 0, crossOff: 0, across: [], endsNearWall: 0 };
  const near = [0, 0];
  const restFor = [-1, -1];
  const prev = [TempestMove.Lap, TempestMove.Lap];
  const input = idle();
  for (let i = 0; i < 120 * secs; i++) {
    stepGame(w, DT, move(i, input));
    const st = [at(s, 0, S.move), at(s, 1, S.move)];
    if (st[1] === TempestMove.Dash && prev[1] === TempestMove.Windup && at(s, 1, S.pair) === 1) {
      out.pincers++;
      // A pincer locked: slot 1 aims at the cut off point, cutOff across slot 0's line from its aim.
      const h0 = at(s, 0, S.heading);
      const ax = at(s, 1, S.aimX) - at(s, 0, S.aimX);
      const ay = at(s, 1, S.aimY) - at(s, 0, S.aimY);
      const across = Math.abs(-ax * Math.sin(h0) + ay * Math.cos(h0));
      const cr = clipRadius(w.radius[parts[1] ?? -1] ?? 0);
      const clamped = !isInside(arena, at(s, 0, S.aimX) - Math.sin(h0) * TEMPESTLING.cutOff, at(s, 0, S.aimY) + Math.cos(h0) * TEMPESTLING.cutOff, cr) || !isInside(arena, at(s, 0, S.aimX) + Math.sin(h0) * TEMPESTLING.cutOff, at(s, 0, S.aimY) - Math.cos(h0) * TEMPESTLING.cutOff, cr);
      if (!clamped && Math.abs(across - TEMPESTLING.cutOff) > 3) out.crossOff++; // float32 positions
      out.across.push(across);
    }
    for (let k = 0; k < 2; k++) {
      const p = parts[k] ?? -1;
      if (w.alive[p] !== 1) continue;
      const r = w.radius[p] ?? 0;
      near[k] = wallGap(arena, w.x[p] ?? 0, w.y[p] ?? 0) >= TEMPESTLING.nearWall ? 0 : (near[k] ?? 0) + DT;
      out.maxNear = Math.max(out.maxNear, near[k] ?? 0);
      if (prev[k] === TempestMove.Dash && st[k] === TempestMove.Rest) {
        out.dashes++;
        restFor[k] = 0;
        if (!isInside(arena, w.x[p] ?? 0, w.y[p] ?? 0, clipRadius(r) - 1)) out.endsNearWall++;
      } else if (st[k] === TempestMove.Rest && (restFor[k] ?? -1) >= 0) {
        restFor[k] = (restFor[k] ?? 0) + DT;
        if (Math.abs((restFor[k] ?? 0) - TEMPESTLING.turnSec) < DT / 2) {
          out.turnChecks++;
          const b = Math.atan2((w.y[0] ?? 0) - (w.y[p] ?? 0), (w.x[0] ?? 0) - (w.x[p] ?? 0));
          const miss = Math.abs(Math.atan2(Math.sin(b - (w.rot[p] ?? 0)), Math.cos(b - (w.rot[p] ?? 0))));
          // The invulnerable test ship may sit on the part, where the bearing to it is noise.
          const apart = Math.hypot((w.x[0] ?? 0) - (w.x[p] ?? 0), (w.y[0] ?? 0) - (w.y[p] ?? 0)) > 2 * r;
          if (apart && miss > 0.05) out.turnMiss++;
        }
      } else if (st[k] !== TempestMove.Rest) restFor[k] = -1;
      prev[k] = st[k] as TempestMove;
    }
  }
  return out;
}

describe('tempestlings in the real level 40 fight (GW6)', () => {
  it('rectObstacles floor (seed 42), 30 s: no part stays within 140 u of a wall over 1.5 s', () => {
    const w = createGame(generateLevel(42, 40));
    expect(w.level.arena.shape).toBe('rectObstacles');
    for (const move of [circle, (_i: number, o: InputState): InputState => o]) {
      const t = watch(42, 30, move);
      expect(t.maxNear).toBeLessThanOrEqual(1.5);
      expect(t.dashes).toBeGreaterThanOrEqual(6);
      expect(t.endsNearWall).toBe(0);
    }
  });

  for (const seed of [1, 2, 7]) {
    it(`seed ${seed}: dashes end 60 u off the walls, turn back to the ship within 0.2 s, pincer lines cross`, () => {
      const t = watch(seed, 30, circle);
      expect(t.maxNear).toBeLessThanOrEqual(1.5);
      expect(t.endsNearWall).toBe(0);
      expect(t.turnChecks).toBeGreaterThanOrEqual(4);
      expect(t.turnMiss).toBe(0);
      expect(t.pincers).toBeGreaterThanOrEqual(3);
      expect(t.crossOff).toBe(0);
      const cut = t.across.filter((a) => a >= TEMPESTLING.cutOff - 30).length;
      expect(cut * 2).toBeGreaterThanOrEqual(t.across.length);
    });
  }

  it('determinism: two real split fights on the obstacle floor hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const w = splitLevel40(42);
      const input = idle();
      let h = 1;
      for (let i = 0; i < 120 * 20; i++) {
        stepGame(w, DT, circle(i, input));
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      return h;
    };
    expect(once()).toBe(once());
  });
});
