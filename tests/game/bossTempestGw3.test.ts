// Tempest GW3 (device gate GW3: "after splitting the smaller Tempests are non threatening ... aim a
// path but abandon it and keep floating near the edge"): big Tempest hit points plus 15 percent;
// Tempestlings chase at 1.4x the body's speed, every marker is followed by a committed dash of at
// least 200 u at about 420 u/s, they keep 150 u from the walls between dashes, run the storm attack
// at full rate and flank the ship from opposite sides (slot 0 leads a pincer).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss, livePart } from '../../src/game/bosses/core';
import { BOSS_TABLE, CRACK_AT, TEMPEST, TEMPESTLING } from '../../src/game/bosses/table';
import { bearingGap, firstDashClock, flankBearing, markerClearedEarly, pincerReady, SLOT, tempestlingSpeed, TempestMove } from '../../src/game/bosses/tempest';
import { HazardType } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { bs, bossGame, enter, park } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const HALF_W = 700;
const HALF_H = 450;

/** The ship drifts round a loose loop near the centre (shielded, so it never dies). */
function wander(step: number, out: InputState): InputState {
  const t = step * DT;
  out.move.active = true;
  out.move.x = Math.cos(t * 0.6) * 0.35;
  out.move.y = Math.sin(t * 0.9) * 0.35;
  return out;
}

function splitGame(): World {
  const w = bossGame('tempest', { par: 1000 }, {}, true);
  park(w, 0, 0);
  const id = enter(w);
  w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
  expect(bs(w).split).toBe(true);
  return w;
}

function wallDist(w: World, p: number): number {
  return Math.min(HALF_W - Math.abs(w.x[p] ?? 0), HALF_H - Math.abs(w.y[p] ?? 0));
}

interface Trace {
  markers: number;
  dashes: number[];
  abandoned: number;
  minWall: number;
  maxChase: number;
  maxDash: number;
  flankGaps: number[];
}

/** Run secs after the split and watch both parts' move states, positions and speeds. */
function trace(secs: number): Trace {
  const w = splitGame();
  const s = bs(w);
  const parts = [livePart(w, s, 0), livePart(w, s, 1)];
  const prevState = [0, 0];
  const start = [0, 0, 0, 0];
  const px = parts.map((p) => w.x[p] ?? 0);
  const py = parts.map((p) => w.y[p] ?? 0);
  const chaseFor = [0, 0];
  const out: Trace = { markers: 0, dashes: [], abandoned: 0, minWall: Infinity, maxChase: 0, maxDash: 0, flankGaps: [] };
  const input = idle();
  for (let i = 0; i < 120 * secs; i++) {
    stepGame(w, DT, wander(i, input));
    for (let k = 0; k < 2; k++) {
      const p = parts[k] ?? -1;
      expect(w.alive[p]).toBe(1);
      const st = s.abl[k * SLOT] ?? 0;
      const x = w.x[p] ?? 0;
      const y = w.y[p] ?? 0;
      const v = Math.hypot(x - (px[k] ?? 0), y - (py[k] ?? 0)) / DT;
      px[k] = x;
      py[k] = y;
      const was = prevState[k] ?? 0;
      if (st === TempestMove.Windup && was !== TempestMove.Windup) {
        out.markers++;
        start[k * 2] = x;
        start[k * 2 + 1] = y;
        const o = parts[1 - k] ?? -1;
        const sx = w.x[0] ?? 0;
        const sy = w.y[0] ?? 0;
        const d = Math.atan2(y - sy, x - sx) - Math.atan2((w.y[o] ?? 0) - sy, (w.x[o] ?? 0) - sx);
        out.flankGaps.push(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
      }
      if (was === TempestMove.Windup && st === TempestMove.Lap) out.abandoned++;
      if (was === TempestMove.Dash && st !== TempestMove.Dash) {
        out.dashes.push(Math.hypot(x - (start[k * 2] ?? 0), y - (start[k * 2 + 1] ?? 0)));
      }
      if (st === TempestMove.Dash && was === TempestMove.Dash) out.maxDash = Math.max(out.maxDash, v);
      chaseFor[k] = st === TempestMove.Lap && was === TempestMove.Lap ? (chaseFor[k] ?? 0) + DT : 0;
      if (st === TempestMove.Lap && was === TempestMove.Lap) out.maxChase = Math.max(out.maxChase, v);
      // Between dashes: once out of the wall band (0.8 s covers the way back from a wall at 196 u/s).
      if ((chaseFor[k] ?? 0) > 0.8 && i * DT > 1) out.minWall = Math.min(out.minWall, wallDist(w, p));
      prevState[k] = st;
    }
  }
  return out;
}

describe('tempest gw3 pure rules', () => {
  it('big Tempest hit points plus 15 percent, speed ratio 1.4, full rate, opposite flanks', () => {
    expect(BOSS_TABLE.tempest.hp).toBe(Math.round(900 * 1.15));
    expect(tempestlingSpeed() / TEMPEST.lapSpeed).toBeCloseTo(1.4, 9);
    expect(TEMPESTLING.rate).toBe(1);
    expect(TEMPESTLING.dashSpeed).toBe(420);
    expect(TEMPESTLING.wallKeep).toBe(150);
    expect(flankBearing(0.5, 0)).toBe(0.5);
    expect(flankBearing(0.5, 1)).toBeCloseTo(0.5 - Math.PI, 9);
    expect(markerClearedEarly(0.01)).toBe(false); // a marker expires 0.01 s before its wind up ends
    expect(markerClearedEarly(0.4)).toBe(true);
    expect(firstDashClock(4)).toBe(4 - TEMPESTLING.firstDash);
    expect(bearingGap(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(pincerReady(Math.PI * 0.6, 0)).toBe(true);
    expect(pincerReady(0.3, 0.2)).toBe(false);
    expect(pincerReady(0.3, TEMPESTLING.flankWait)).toBe(true);
  });
});

describe('tempestlings gw3', () => {
  const t = trace(40);

  it('every marker is followed by a committed dash of at least 200 u', () => {
    expect(t.markers).toBeGreaterThanOrEqual(12);
    expect(t.abandoned).toBe(0);
    expect(t.dashes.length).toBeGreaterThanOrEqual(t.markers - 2); // the last ones may still be under way
    for (const d of t.dashes) expect(d).toBeGreaterThanOrEqual(200);
  });

  it('dash at about 420 u/s, chase at 1.4x the body lap speed', () => {
    expect(t.maxDash).toBeCloseTo(TEMPESTLING.dashSpeed, 0);
    expect(t.maxChase).toBeLessThanOrEqual(tempestlingSpeed() + 0.5);
    expect(t.maxChase).toBeGreaterThan(tempestlingSpeed() - 0.5);
    expect(t.maxChase / TEMPEST.lapSpeed).toBeCloseTo(1.4, 2);
  });

  it('keeps at least 150 u from the walls between dashes (no edge drifting)', () => {
    expect(t.minWall).toBeGreaterThanOrEqual(TEMPESTLING.wallKeep - 1);
  });

  it('flanks: at each wind up the two sit on opposite sides of the ship', () => {
    expect(t.flankGaps.length).toBeGreaterThan(0);
    for (const g of t.flankGaps) expect(g).toBeGreaterThan(Math.PI / 2);
  });

  it('every marker is a lane marker inside the hazard cap', () => {
    const w = splitGame();
    let peak = 0;
    for (let i = 0; i < 120 * 12; i++) {
      stepGame(w, DT, idle());
      let n = 0;
      for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Lane) n++;
      peak = Math.max(peak, n);
    }
    expect(peak).toBeGreaterThanOrEqual(1);
  });

  it('determinism: two 40 s wandering runs after the split hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const w = splitGame();
      const input = idle();
      let h = 1;
      for (let i = 0; i < 120 * 40; i++) {
        stepGame(w, DT, wander(i, input));
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      return h;
    };
    expect(once()).toBe(once());
  });
});
