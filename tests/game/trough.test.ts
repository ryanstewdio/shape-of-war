// Trough wave (Ryan 2026-11-10): the ship alone is pulled downhill toward the valley floor along u,
// proportional to the shared profile slope, scaled by driftScale. Walls stay solid; nothing wraps.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { troughSlope } from '../../src/core/trough';
import { spawnBullet } from '../../src/game/bullets';
import * as grunt from '../../src/game/enemies/grunt';
import { createGame, freePlayLevelRules, stepGame, type GameOptions } from '../../src/game/game';
import { SHIP_RADIUS, SHIP_SPEED } from '../../src/game/ship';
import { gs } from '../../src/game/state';
import { freePlaySurfaceRules, isTrough, stepTrough, TROUGH_PULL, troughPullAt } from '../../src/game/trough';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put, quietLevel } from './helpers';

afterEach(() => bus.clear());

const W = 1400;
const H = 900;

function trough(opts: GameOptions = {}, patch: Partial<LevelDef> = {}): World {
  const { w } = makeGame({ surface: 'trough', ...patch }, opts);
  gs(w).invulnerable = true;
  return w;
}

function moving(x: number): InputState {
  const i = idle();
  i.move = { active: x !== 0, x, y: 0 };
  return i;
}

/** Ship x after one idle step from (x, y). */
function oneStep(w: World, x: number, y = 0): number {
  w.x[0] = x;
  w.y[0] = y;
  stepGame(w, DT, idle());
  return w.x[0] ?? 0;
}

describe('troughPullAt', () => {
  it('is zero at the valley floor', () => {
    expect(troughPullAt(0, W, 1)).toBe(0);
  });

  it('points downhill toward u = 0 on both halves', () => {
    expect(troughPullAt(300, W, 1)).toBeLessThan(0);
    expect(troughPullAt(-300, W, 1)).toBeGreaterThan(0);
    expect(troughPullAt(300, W, 1)).toBeCloseTo(-troughPullAt(-300, W, 1), 12);
  });

  it('is proportional to the profile slope', () => {
    for (const u of [50, 175, 350, 525, 690]) {
      expect(troughPullAt(u, W, 1)).toBeCloseTo(-troughSlope(u, W) * TROUGH_PULL, 9);
    }
  });

  it('is gentle near the bottom, moderate mid slope and strong at the rim', () => {
    const near = Math.abs(troughPullAt(W * 0.05, W, 1));
    const mid = Math.abs(troughPullAt(W * 0.25, W, 1));
    const rim = Math.abs(troughPullAt(W / 2, W, 1));
    expect(near).toBeLessThan(8);
    expect(mid).toBeGreaterThan(near * 10);
    expect(rim).toBeGreaterThan(mid * 2.5);
    expect(rim).toBeGreaterThan(220);
    expect(rim).toBeLessThan(260);
  });

  it('stays below the ship speed at every difficulty, so the rim is reachable', () => {
    for (const d of Object.values(DIFFICULTY)) {
      expect(Math.abs(troughPullAt(W / 2, W, d.driftScale))).toBeLessThan(SHIP_SPEED);
    }
  });

  it('scales linearly with the difficulty scale', () => {
    expect(troughPullAt(400, W, 1.6)).toBeCloseTo(troughPullAt(400, W, 1) * 1.6, 9);
  });
});

describe('stepTrough in the sim', () => {
  it('does not move an idle ship on the floor', () => {
    const w = trough();
    expect(oneStep(w, 0)).toBe(0);
  });

  it('pulls an idle ship downhill by pull x dt at mid slope and at the rim', () => {
    const w = trough();
    const mid = 350;
    expect(oneStep(w, mid)).toBeCloseTo(mid + troughPullAt(mid, W, 1) * DT, 3);
    const rim = -(W / 2 - SHIP_RADIUS);
    expect(oneStep(w, rim)).toBeCloseTo(rim + troughPullAt(rim, W, 1) * DT, 3);
    expect(w.x[0] ?? 0).toBeGreaterThan(rim);
  });

  it('settles an idle ship toward the floor over time', () => {
    const w = trough();
    w.x[0] = 600;
    for (let i = 0; i < 120 * 20; i++) stepGame(w, DT, idle());
    expect(Math.abs(w.x[0] ?? 0)).toBeLessThan(120);
  });

  it('lets a thrusting ship climb to the rim and stay there', () => {
    const w = trough();
    for (let i = 0; i < 120 * 4; i++) stepGame(w, DT, moving(1));
    // At the wall the stick is clamped and the pull shifts the ship in by pull x dt (about 2 u).
    const rimX = W / 2 - SHIP_RADIUS;
    expect(w.x[0] ?? 0).toBeLessThanOrEqual(rimX);
    expect(w.x[0] ?? 0).toBeGreaterThan(rimX + troughPullAt(rimX, W, 1) * DT - 0.01);
    // Release: the ship slides back down.
    for (let i = 0; i < 12; i++) stepGame(w, DT, idle());
    expect(w.x[0] ?? 0).toBeLessThan(W / 2 - SHIP_RADIUS - 10);
  });

  it('keeps the rim walls solid and never wraps', () => {
    const w = trough();
    for (let i = 0; i < 120 * 3; i++) stepGame(w, DT, moving(-1));
    expect(w.x[0] ?? 0).toBeGreaterThanOrEqual(-(W / 2 - SHIP_RADIUS));
    expect(w.x[0] ?? 0).toBeLessThan(-(W / 2 - SHIP_RADIUS) + 2);
    expect(w.surface.topology.wrapU).toBe(false);
  });

  it('scales the ship pull by the difficulty driftScale', () => {
    const x0 = 450;
    const normal = oneStep(trough(), x0) - x0;
    const insane = oneStep(trough({ difficulty: 'insane' }), x0) - x0;
    const easy = oneStep(trough({ difficulty: 'easy' }), x0) - x0;
    expect(insane).toBeCloseTo(normal * DIFFICULTY.insane.driftScale, 3);
    expect(easy).toBeCloseTo(normal * DIFFICULTY.easy.driftScale, 3);
  });

  it('does nothing while the ship is dead', () => {
    const w = trough();
    w.x[0] = 500;
    w.ship.active = false;
    stepTrough(w, DT);
    expect(w.x[0]).toBe(500);
  });
});

describe('only the ship is pulled', () => {
  /** Same scene on a flat and a trough level; returns both worlds after n idle steps. */
  function pair(setup: (w: World) => void, n: number): [World, World] {
    const out: World[] = [];
    for (const surface of ['flat', 'trough'] as const) {
      const { w } = makeGame({ surface });
      gs(w).invulnerable = true;
      w.x[0] = 0; // ship on the floor: no pull on it in either world
      setup(w);
      for (let i = 0; i < n; i++) stepGame(w, DT, idle());
      out.push(w);
    }
    return [out[0] as World, out[1] as World];
  }

  it('leaves enemies on the slope exactly where the flat level would', () => {
    let id = -1;
    const [flat, tr] = pair((w) => {
      id = put(w, grunt.def, 550, 200);
    }, 60);
    expect(tr.x[id]).toBe(flat.x[id]);
    expect(tr.y[id]).toBe(flat.y[id]);
  });

  it('leaves player bullets on the slope exactly where the flat level would', () => {
    let b = -1;
    const [flat, tr] = pair((w) => {
      b = spawnBullet(w.bullets, 500, -200, 0, 300, 1);
    }, 30);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(tr.bullets.x[b]).toBe(flat.bullets.x[b]);
    expect(tr.bullets.y[b]).toBe(flat.bullets.y[b]);
  });
});

describe('flat and other levels unchanged', () => {
  it('flat levels never pull the ship', () => {
    const { w } = makeGame({ surface: 'flat' });
    gs(w).invulnerable = true;
    expect(oneStep(w, 500)).toBe(500);
  });

  it('isTrough reads the level surface', () => {
    expect(isTrough(quietLevel({ surface: 'trough' }))).toBe(true);
    expect(isTrough(quietLevel({ surface: 'flat' }))).toBe(false);
    expect(isTrough(quietLevel({ surface: 'cylinder' }))).toBe(false);
  });
});

describe('Free Play surface option', () => {
  const fp = (surface?: 'flat' | 'trough'): FreePlayConfig => ({ ...DEFAULT_FREE_PLAY, ...(surface ? { surface } : {}) });

  it('absent or flat leaves the level object unchanged', () => {
    const lv = quietLevel();
    expect(freePlaySurfaceRules(lv, fp())).toBe(lv);
    expect(freePlaySurfaceRules(lv, fp('flat'))).toBe(lv);
  });

  it('trough turns a flat arena into a trough without touching the input', () => {
    const lv = quietLevel({ surface: 'flat' });
    const out = freePlaySurfaceRules(lv, fp('trough'));
    expect(out.surface).toBe('trough');
    expect(lv.surface).toBe('flat');
  });

  it('a drum keeps its cylinder', () => {
    const lv = quietLevel({ surface: 'cylinder' });
    expect(freePlaySurfaceRules(lv, fp('trough'))).toBe(lv);
  });

  it('freePlayLevelRules carries the surface into the game', () => {
    expect(freePlayLevelRules(quietLevel(), fp('trough')).surface).toBe('trough');
    const w = createGame(quietLevel(), { freePlay: fp('trough') });
    expect(w.surface.kind).toBe('trough');
    const flat = createGame(quietLevel(), { freePlay: fp() });
    expect(flat.surface.kind).toBe('flat');
  });
});

describe('determinism', () => {
  function run(): number[] {
    const { w } = makeGame({ surface: 'trough', seed: 11 });
    gs(w).invulnerable = true;
    put(w, grunt.def, 400, 100);
    const trace: number[] = [];
    for (let i = 0; i < 600; i++) {
      const inp = moving(i % 240 < 120 ? 1 : -0.4);
      stepGame(w, DT, inp);
      trace.push(w.x[0] ?? 0, w.y[0] ?? 0);
    }
    return trace;
  }

  it('two runs are bit identical', () => {
    expect(run()).toEqual(run());
  });

  it('flat and trough levels have the same width', () => {
    expect(quietLevel().arena.width).toBe(W);
    expect(quietLevel().arena.height).toBe(H);
  });
});
