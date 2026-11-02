// Cylinder simulation core (V3-H C0, D13): the world holds its surface, positions wrap once per
// step, the spatial hash wraps on u, the rims collide and the u walls do not exist, steering and
// bullets work across the seam, and a cylinder run is deterministic.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { confineOn } from '../../src/game/arena';
import { spawnBullet, stepBulletPool } from '../../src/game/bullets';
import { CELL, createGrid, queryCircle, queryCircleInto, rebuild, type GridEntities } from '../../src/game/collide';
import * as grunt from '../../src/game/enemies/grunt';
import { stepGame } from '../../src/game/game';
import { SHIP_RADIUS } from '../../src/game/ship';
import { deltaTo, inlineRectLevel, Kind, surfaceOf, type World } from '../../src/game/world';
import { createWorld } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

const W = 1408; // 22 hash cells
const H = 896;

function cylPatch(): Partial<LevelDef> {
  const base = inlineRectLevel(7);
  return { surface: 'cylinder', arena: { ...base.arena, width: W, height: H } };
}

function cylGame(): World {
  const { w } = makeGame(cylPatch());
  return w;
}

function moving(x: number, y: number, ax = 0, ay = 0): InputState {
  const i = idle();
  i.move = { active: x !== 0 || y !== 0, x, y };
  i.aim = { active: ax !== 0 || ay !== 0, x: ax, y: ay };
  return i;
}

function place(w: World, id: number, x: number, y: number): void {
  w.x[id] = x;
  w.y[id] = y;
  w.prevX[id] = x;
  w.prevY[id] = y;
}

describe('world surface', () => {
  it('defaults to flat and reads level.surface', () => {
    expect(surfaceOf(makeGame().w).kind).toBe('flat');
    const w = cylGame();
    expect(surfaceOf(w).kind).toBe('cylinder');
    expect(surfaceOf(w).width).toBe(W);
    const d = { x: 0, y: 0 };
    deltaTo(w, W / 2 - 5, 1, -W / 2 + 5, 4, d);
    expect(d).toEqual({ x: 10, y: 3 });
  });

  it('a level with no surface field builds a flat world', () => {
    const lvl: LevelDef = { ...inlineRectLevel(3) };
    delete (lvl as { surface?: string }).surface;
    expect(createWorld(lvl).surface.kind).toBe('flat');
  });

  it('throws in dev when a cylinder width is not a multiple of the hash cell', () => {
    const base = inlineRectLevel(7);
    expect(() => createWorld({ ...base, surface: 'cylinder' })).toThrow(/multiple/);
  });
});

describe('ship on the cylinder', () => {
  it('flies across the seam five times with continuous position', () => {
    const w = cylGame();
    w.ship.invuln = 1e9;
    w.drift.active = false; // pure ship speed: open drum drift has its own tests (drift.test.ts)
    const right = moving(1, 0);
    let crossings = 0;
    let steps = 0;
    const d = { x: 0, y: 0 };
    while (crossings < 5 && steps < 4000) {
      const px = w.x[0] ?? 0;
      const py = w.y[0] ?? 0;
      stepGame(w, DT, right);
      steps++;
      const x = w.x[0] ?? 0;
      expect(x).toBeGreaterThanOrEqual(-W / 2);
      expect(x).toBeLessThanOrEqual(W / 2);
      deltaTo(w, px, py, x, w.y[0] ?? 0, d);
      expect(d.x).toBeCloseTo(420 * DT, 3); // never a jump in delta terms
      expect(d.y).toBe(0);
      if (x < px) crossings++;
    }
    expect(crossings).toBe(5);
  });

  it('has no u wall: x never clamps at plus or minus (W/2 minus r)', () => {
    const w = cylGame();
    w.ship.invuln = 1e9;
    place(w, 0, W / 2 - SHIP_RADIUS - 1, 0);
    for (let i = 0; i < 10; i++) stepGame(w, DT, moving(1, 0));
    expect(w.x[0] ?? 0).toBeLessThan(0); // came round the other side
    expect(w.vx[0]).toBeCloseTo(420, 3); // no slide, full speed
  });

  it('collides with the top and bottom rims', () => {
    const w = cylGame();
    w.ship.invuln = 1e9;
    for (let i = 0; i < 360; i++) stepGame(w, DT, moving(0, 1));
    expect(w.y[0]).toBeCloseTo(H / 2 - SHIP_RADIUS, 4);
    expect(w.vy[0]).toBe(0); // velocity into the rim dropped (slide)
    for (let i = 0; i < 720; i++) stepGame(w, DT, moving(0, -1));
    expect(w.y[0]).toBeCloseTo(-H / 2 + SHIP_RADIUS, 4);
  });
});

describe('confineOn', () => {
  const s = createWorld({ ...inlineRectLevel(1), ...cylPatch() } as LevelDef).surface;
  const arena = { ...inlineRectLevel(1).arena, width: W, height: H };

  it('wraps u without a hit and clamps v at the rims with an inward normal', () => {
    const a = confineOn(s, arena, W / 2 + 20, 0, 10);
    expect(a.hit).toBe(false);
    expect(a.x).toBe(-W / 2 + 20);
    const b = confineOn(s, arena, 0, H / 2 + 5, 10);
    expect(b.hit).toBe(true);
    expect(b.y).toBe(H / 2 - 10);
    expect(b.ny).toBe(-1);
  });

  it('pushes out of an obstacle seen across the seam', () => {
    const obsArena = {
      ...arena,
      shape: 'rectObstacles' as const,
      obstacles: [{ cx: W / 2 - 20, cy: 0, w: 40, h: 100 }],
    };
    // Box spans u in [W/2 - 40, W/2]; a circle just past the seam at u = -W/2 + 4 overlaps it.
    const r = confineOn(s, obsArena, -W / 2 + 4, 0, 10);
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(-W / 2 + 10, 6);
  });
});

describe('bullets across the seam', () => {
  it('a bullet pool on the cylinder wraps instead of dying at the u wall', () => {
    const w = cylGame();
    const p = w.bullets;
    const id = spawnBullet(p, W / 2 - 5, 0, 1400, 0, 1.2);
    stepBulletPool(p, w.level.arena, DT, w.surface);
    expect(p.alive[id]).toBe(1);
    expect(p.x[id] ?? 0).toBeLessThan(0);
    const rim = spawnBullet(p, 0, H / 2 - 5, 0, 1400, 1.2);
    stepBulletPool(p, w.level.arena, DT, w.surface);
    expect(p.alive[rim]).toBe(0); // the rims still stop bullets
  });

  it('a bullet fired across the seam hits a target on the other side', () => {
    const w = cylGame();
    w.ship.invuln = 1e9;
    place(w, 0, W / 2 - 40, 0);
    const g = put(w, grunt.def, -W / 2 + 60, 0);
    let killed = false;
    for (let i = 0; i < 30 && !killed; i++) {
      stepGame(w, DT, moving(0, 0, 1, 0));
      killed = w.alive[g] !== 1 || w.kind[g] !== Kind.Grunt; // a geom may reuse the slot
    }
    expect(killed).toBe(true);
  });
});

describe('enemies seek across the seam', () => {
  it('a grunt just past the seam closes the short way round', () => {
    const w = cylGame();
    w.ship.invuln = 1e9;
    place(w, 0, W / 2 - 30, 0);
    const g = put(w, grunt.def, -W / 2 + 200, 0);
    const d = { x: 0, y: 0 };
    deltaTo(w, w.x[g] ?? 0, 0, w.x[0] ?? 0, 0, d);
    const before = Math.abs(d.x);
    stepGame(w, DT, idle());
    deltaTo(w, w.x[g] ?? 0, 0, w.x[0] ?? 0, 0, d);
    expect(Math.abs(d.x)).toBeLessThan(before);
    expect(w.x[g] ?? 0).toBeLessThan(-W / 2 + 200); // moved toward minus u, across the seam
  });
});

describe('spatial hash on the cylinder', () => {
  function ents(xs: number[]): GridEntities {
    const n = xs.length;
    return {
      cap: n,
      alive: new Uint8Array(n).fill(1),
      x: Float32Array.from(xs),
      y: new Float32Array(n),
      radius: new Float32Array(n).fill(4),
    };
  }

  it('has exactly W / CELL columns', () => {
    expect(createGrid(W, H, 4, true).cols).toBe(W / CELL);
  });

  it('finds neighbours across the seam both ways', () => {
    const e = ents([W / 2 - 6, -W / 2 + 6, 0]);
    const g = createGrid(W, H, 3, true);
    rebuild(g, e);
    const out = new Int32Array(8);
    let n = queryCircleInto(g, e, W / 2 - 6, 0, 10, out);
    expect(Array.from(out.subarray(0, n)).sort()).toEqual([0, 1]);
    n = queryCircleInto(g, e, -W / 2 + 6, 0, 10, out);
    expect(Array.from(out.subarray(0, n)).sort()).toEqual([0, 1]);
    const seen: number[] = [];
    queryCircle(g, e, W / 2 - 1, 0, 8, (id) => seen.push(id));
    expect(seen.sort()).toEqual([0, 1]);
  });

  it('a flat grid does not see across the arena', () => {
    const e = ents([W / 2 - 6, -W / 2 + 6]);
    const g = createGrid(W, H, 2);
    rebuild(g, e);
    const out = new Int32Array(8);
    expect(queryCircleInto(g, e, W / 2 - 6, 0, 10, out)).toBe(1);
  });

  it('indexes positions just outside the canonical range and never double counts a huge query', () => {
    const e = ents([W / 2 + 3, 100]);
    const g = createGrid(W, H, 2, true);
    rebuild(g, e);
    const out = new Int32Array(8);
    expect(queryCircleInto(g, e, -W / 2 + 1, 0, 8, out)).toBe(1);
    expect(queryCircleInto(g, e, 0, 0, W, out)).toBe(2);
  });
});

describe('determinism on the cylinder', () => {
  function run(): number[] {
    const { w } = makeGame({ ...cylPatch(), waves: { ...inlineRectLevel(7).waves, budgetStart: 6, budgetEnd: 14, intervalStartSec: 1, intervalEndSec: 1 } });
    w.ship.invuln = 1e9;
    for (let i = 0; i < 8; i++) put(w, grunt.def, -W / 2 + 20 + i * 170, (i - 4) * 90);
    const trace: number[] = [];
    for (let s = 0; s < 1800; s++) {
      const a = s * 0.013;
      stepGame(w, DT, moving(Math.cos(a), Math.sin(a * 0.7), Math.sin(a), Math.cos(a)));
      if (s % 60 === 0) {
        let h = 0x811c9dc5;
        for (let id = 0; id < w.cap; id++) {
          if (w.alive[id] !== 1) continue;
          h = Math.imul(h ^ Math.round((w.x[id] ?? 0) * 1000), 0x01000193) >>> 0;
          h = Math.imul(h ^ Math.round((w.y[id] ?? 0) * 1000), 0x01000193) >>> 0;
        }
        trace.push(h, w.bullets.liveCount);
      }
    }
    return trace;
  }

  it('same level and input log give the same trace', () => {
    expect(run()).toEqual(run());
  });
});
