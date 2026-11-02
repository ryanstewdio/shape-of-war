// G6 item j: nova snake glints on the live path. Runs the real game step on real generated levels
// with wells and, each 60 Hz render frame, the exact bookkeeping the renderer runs (novaSnakeSync,
// novaSnakeBody, novaSnakeGlints): every snake a nova well releases is tracked and has a non empty
// glint draw list on every frame of its life, with no dependence on the spawn event reaching the
// renderer, and normal snakes never get glints.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { spawnSnake } from '../../src/game/enemies/snake';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs, SNAKE_SEGMENTS, SNAKE_SLOTS } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import { V2_GEN_CONFIG, type LevelDef } from '../../src/levelgen/leveldef';
import { hash01 } from '../../src/render/color';
import { createNovaSnakeState, NOVA_SNAKE_GLINTS, NOVA_SNAKE_GLINTS_MAX, resetNovaSnakeState } from '../../src/render/novaSnake';
import { GLINT_STRIDE, novaSnakeBody, novaSnakeGlints, novaSnakeSync, trackedHeads } from '../../src/render/novaSnakeLive';
import { DT, idle, makeGame } from '../game/helpers';

afterEach(() => bus.clear());

const HEAD = Kind.SnakeHead as number;

function wellLevels(n: number): LevelDef[] {
  const out: LevelDef[] = [];
  for (let seed = 11; out.length < n && seed < 400; seed += 37) {
    for (let level = 1; level <= 30 && out.length < n; level++) {
      const def = generateLevel(seed, level, V2_GEN_CONFIG);
      if (def.hazards.wells.length > 0) out.push(def);
    }
  }
  return out;
}

/** Live heads whose slot a well owns, straight from the sim. */
function simNovaHeads(w: World): number[] {
  const g = gs(w);
  const out: number[] = [];
  for (let s = 0; s < SNAKE_SLOTS; s++) {
    const h = g.snakeHead[s] ?? -1;
    if (h > 0 && (g.snakeWell[s] ?? -1) >= 0 && w.alive[h] === 1 && w.kind[h] === HEAD) out.push(h);
  }
  return out;
}

const pts = new Float32Array((SNAKE_SEGMENTS + 1) * 2);
const list = new Float32Array(NOVA_SNAKE_GLINTS_MAX * GLINT_STRIDE);

/** The renderer's per snake work: body, then the glint list. Returns the glint count. */
function glintsFor(w: World, head: number, timeSec: number): number {
  const g = gs(w);
  const n = novaSnakeBody(w, g, head, SNAKE_SEGMENTS, 0.5, 0, pts);
  const slot = w.a[head] ?? -1;
  const well = g.snakeWell[slot] ?? -1;
  const hasWell = well >= 0 && w.alive[well] === 1;
  return novaSnakeGlints(pts, n, head, hash01(head), timeSec, hasWell, w.x[well] ?? 0, w.y[well] ?? 0, list);
}

describe('nova snake glints on the live path (G6 item j)', () => {
  const levels = wellLevels(6);

  it.each(levels.map((d, i) => [i, d] as const))('level %i: every released snake has glints for its whole life', (_i, def) => {
    const w = createGame(def, { vibrate: () => undefined });
    setInvulnerable(w, true);
    // No renderer bus subscription on purpose: tracking must not depend on the spawn event.
    let releases = 0;
    bus.on('sim:wellSpawn', () => releases++);
    const s = createNovaSnakeState();
    let novaFrames = 0;
    let t = 0;
    for (let f = 0; f < 60 * 22; f++) {
      stepGame(w, DT, idle());
      stepGame(w, DT, idle());
      t += 2 * DT;
      // A reset (retry) between frames clears the set; the next sync must bring it all back.
      if (f % 97 === 0) resetNovaSnakeState(s);
      novaSnakeSync(s, w, gs(w), SNAKE_SLOTS, HEAD);
      const want = simNovaHeads(w).sort((a, b) => a - b);
      expect(trackedHeads(s).sort((a, b) => a - b)).toEqual(want);
      for (const head of want) {
        novaFrames++;
        expect(glintsFor(w, head, t)).toBeGreaterThanOrEqual(NOVA_SNAKE_GLINTS / 2);
      }
    }
    expect(releases).toBeGreaterThan(0);
    expect(novaFrames).toBeGreaterThan(60);
  });

  it('a snake from the spawner (no well) is never tracked', () => {
    const { w } = makeGame();
    const head = spawnSnake(w, 100, 100, 0);
    expect(head).toBeGreaterThan(0);
    const s = createNovaSnakeState();
    novaSnakeSync(s, w, gs(w), SNAKE_SLOTS, HEAD);
    expect(trackedHeads(s)).toEqual([]);
    // Once a well owns its slot it is a nova snake, from that frame on.
    gs(w).snakeWell[w.a[head] ?? 0] = 3;
    novaSnakeSync(s, w, gs(w), SNAKE_SLOTS, HEAD);
    expect(trackedHeads(s)).toEqual([head]);
  });

  it('the body is the head then every live segment, and the list is bounded', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    const head = spawnSnake(w, -400, 200, 0);
    for (let i = 0; i < 60; i++) stepGame(w, DT, idle());
    expect(w.alive[head]).toBe(1);
    const n = novaSnakeBody(w, gs(w), head, SNAKE_SEGMENTS, 1, 0, pts);
    expect(n).toBe(SNAKE_SEGMENTS + 1);
    expect(pts[0]).toBeCloseTo(w.x[head] ?? 0, 6);
    expect(pts[1]).toBeCloseTo(w.y[head] ?? 0, 6);
    const c = novaSnakeGlints(pts, n, head, hash01(head), 1.5, true, pts[0] ?? 0, (pts[1] ?? 0) + 50, list);
    expect(c).toBeGreaterThan(NOVA_SNAKE_GLINTS / 2);
    expect(c).toBeLessThanOrEqual(NOVA_SNAKE_GLINTS_MAX);
    for (let q = 0; q < c; q++) {
      expect(list[q * GLINT_STRIDE + 2]).toBeGreaterThan(0.2);
      expect(list[q * GLINT_STRIDE + 5]).toBeGreaterThan(0.01);
      expect(list[q * GLINT_STRIDE + 5]).toBeLessThanOrEqual(1);
    }
  });
});
