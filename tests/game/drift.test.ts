// Release polish (docs/14 item 8): open drum drift. Cylinder levels with no obstacles drift every
// live entity and the ship along u at 40 u/s, bursting to 160 u/s for 1.2 s every 9 to 14 s.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import {
  advanceBursts,
  BURST_HOLD,
  BURST_LEN,
  BURST_RAMP,
  burstGap,
  burstWeight,
  createDrift,
  DRIFT_BASE,
  DRIFT_BURST,
  DRIFT_WARN,
  driftDir,
  driftSpeedAt,
  GAP_MAX,
  GAP_MIN,
} from '../../src/game/drift';
import * as grunt from '../../src/game/enemies/grunt';
import { stepGame } from '../../src/game/game';
import { SHIP_SPEED } from '../../src/game/ship';
import { gs } from '../../src/game/state';
import { deltaTo, inlineRectLevel, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const W = 1408;
const H = 896;

function drumPatch(seed = 7, obstacles: LevelDef['arena']['obstacles'] = []): Partial<LevelDef> {
  const base = inlineRectLevel(seed);
  return {
    seed,
    surface: 'cylinder',
    arena: { ...base.arena, shape: obstacles.length > 0 ? 'rectObstacles' : 'rect', width: W, height: H, obstacles },
  };
}

function drum(seed = 7): World {
  const { w } = makeGame(drumPatch(seed));
  gs(w).invulnerable = true;
  return w;
}

function moving(x: number): InputState {
  const i = idle();
  i.move = { active: x !== 0, x, y: 0 };
  return i;
}

/** Step until w.time reaches t. */
function runTo(w: World, t: number, input: InputState = idle()): void {
  while (w.time < t - 1e-9) stepGame(w, DT, input);
}

const d = { x: 0, y: 0 };
/** u displacement of entity id over one step. */
function stepU(w: World, id: number, input: InputState = idle()): number {
  const x0 = w.x[id] ?? 0;
  const y0 = w.y[id] ?? 0;
  stepGame(w, DT, input);
  deltaTo(w, x0, y0, w.x[id] ?? 0, w.y[id] ?? 0, d);
  return d.x;
}

describe('pure profile', () => {
  it('ramps in over 0.3 s, holds 160 u/s for 1.2 s, ramps out over 0.3 s', () => {
    expect(driftSpeedAt(-1)).toBe(DRIFT_BASE);
    expect(driftSpeedAt(0)).toBe(DRIFT_BASE);
    expect(driftSpeedAt(BURST_RAMP / 2)).toBeCloseTo((DRIFT_BASE + DRIFT_BURST) / 2, 9);
    expect(driftSpeedAt(BURST_RAMP)).toBe(DRIFT_BURST);
    expect(driftSpeedAt(BURST_RAMP + BURST_HOLD)).toBe(DRIFT_BURST);
    expect(driftSpeedAt(BURST_RAMP + BURST_HOLD + BURST_RAMP / 2)).toBeCloseTo((DRIFT_BASE + DRIFT_BURST) / 2, 9);
    expect(driftSpeedAt(BURST_LEN)).toBe(DRIFT_BASE);
    expect(burstWeight(BURST_LEN + 5)).toBe(0);
    expect(DRIFT_BASE).toBe(40);
    expect(DRIFT_BURST).toBe(160);
    expect(BURST_HOLD).toBe(1.2);
    expect(BURST_RAMP).toBe(0.3);
  });

  it('burst gaps are 9 to 14 s, hashed from the seed and stable', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (let k = 0; k < 20; k++) {
        const g = burstGap(seed, k);
        expect(g).toBeGreaterThanOrEqual(GAP_MIN);
        expect(g).toBeLessThan(GAP_MAX);
        expect(burstGap(seed, k)).toBe(g);
      }
    }
    expect(burstGap(7, 0)).not.toBe(burstGap(8, 0));
  });

  it('direction is fixed per level and both directions occur', () => {
    const dirs = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const v = driftDir(seed);
      expect(Math.abs(v)).toBe(1);
      expect(driftDir(seed)).toBe(v);
      dirs.add(v);
    }
    expect(dirs.size).toBe(2);
  });

  it('advanceBursts walks the schedule start to start', () => {
    const s = createDrift({ ...inlineRectLevel(9), ...drumPatch(9) });
    expect(s.burstAt).toBe(burstGap(9, 0));
    advanceBursts(s, s.burstAt + BURST_LEN);
    expect(s.k).toBe(1);
    expect(s.burstAt).toBeCloseTo(burstGap(9, 0) + burstGap(9, 1), 9);
  });
});

describe('which levels drift', () => {
  it('open drums only: not flat, not a drum with obstacles', () => {
    expect(drum().drift.active).toBe(true);
    expect(makeGame().w.drift.active).toBe(false);
    const ring = makeGame(drumPatch(7, [{ cx: 0, cy: 200, w: 300, h: 40 }])).w;
    expect(ring.drift.active).toBe(false);
  });

  it('a flat level ship stays put when idle', () => {
    const { w } = makeGame();
    for (let i = 0; i < 240; i++) stepGame(w, DT, idle());
    expect(w.x[0]).toBe(0);
  });
});

describe('drift in the sim', () => {
  it('drifts the idle ship at 40 u/s between bursts, in the level direction', () => {
    const w = drum();
    runTo(w, 1);
    expect(stepU(w, 0)).toBeCloseTo(w.drift.dir * DRIFT_BASE * DT, 4);
  });

  it('bursts to 160 u/s at the hashed time and back to 40 after', () => {
    const w = drum();
    const at = burstGap(7, 0);
    runTo(w, at - 0.5);
    expect(stepU(w, 0)).toBeCloseTo(w.drift.dir * DRIFT_BASE * DT, 4);
    runTo(w, at + BURST_RAMP + BURST_HOLD / 2);
    expect(stepU(w, 0)).toBeCloseTo(w.drift.dir * DRIFT_BURST * DT, 4);
    expect(w.drift.speed).toBe(DRIFT_BURST);
    runTo(w, at + BURST_LEN + 0.5);
    expect(stepU(w, 0)).toBeCloseTo(w.drift.dir * DRIFT_BASE * DT, 4);
    // The second burst follows 9 to 14 s after the first.
    const at2 = at + burstGap(7, 1);
    runTo(w, at2 + BURST_RAMP + 0.1);
    expect(w.drift.k).toBe(1);
    expect(w.drift.speed).toBe(DRIFT_BURST);
  });

  it('drifts enemies too', () => {
    const w = drum();
    runTo(w, 1);
    const id = put(w, grunt.def, 300, 300);
    // Grunt seeks the ship: compare against the same step with drift off.
    const other = drum();
    runTo(other, 1);
    const id2 = put(other, grunt.def, 300, 300);
    other.drift.active = false;
    stepGame(w, DT, idle());
    stepGame(other, DT, idle());
    // Both ships: one drifted by dir*40*DT, the grunt the same plus its seek step toward it.
    deltaTo(w, other.x[id2] ?? 0, other.y[id2] ?? 0, w.x[id] ?? 0, w.y[id] ?? 0, d);
    expect(d.x).toBeCloseTo(w.drift.dir * DRIFT_BASE * DT, 3);
  });

  it('the ship counters a full burst at full stick and makes headway', () => {
    const w = drum();
    const at = burstGap(7, 0);
    runTo(w, at + BURST_RAMP);
    const against = moving(-w.drift.dir);
    for (let i = 0; i < Math.round(BURST_HOLD / DT) - 2; i++) {
      const u = stepU(w, 0, against);
      expect(u * -w.drift.dir).toBeCloseTo((SHIP_SPEED - DRIFT_BURST) * DT, 3);
    }
  });

  it('telegraphs each burst once with sfx spawn, DRIFT_WARN s ahead', () => {
    const w = drum();
    const times: number[] = [];
    bus.on('sfx', (n) => {
      if (n === 'spawn') times.push(w.time);
    });
    const at = burstGap(7, 0);
    runTo(w, at + burstGap(7, 1) + BURST_LEN);
    expect(times.length).toBe(2);
    expect(times[0]).toBeCloseTo(at - DRIFT_WARN, 1);
  });

  it('is deterministic: two runs of the same seed match bit for bit', () => {
    const run = (): Float32Array => {
      const w = drum(11);
      put(w, grunt.def, 300, 300);
      put(w, grunt.def, -300, -200);
      for (let i = 0; i < 3000; i++) stepGame(w, DT, moving(i % 400 < 200 ? 1 : -1));
      return Float32Array.from(w.x);
    };
    expect(run()).toEqual(run());
  });
});
