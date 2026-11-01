// GW2 nova snakes in real play. Ryan never saw a nova snake on device although wellSnakes.test.ts
// passes on a hand built well. These tests build real generated levels (V2 generator config, levels
// whose spec has a well), run the real step loop with a scripted idle ship and check that a snake
// emerges from the well that erupted and is live 4 s after the nova. They also pin the slot
// compaction fix: wellAge, wellNova and the nova ordinal move with wellIds when a well dies.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { killEnemy } from '../../src/game/combat';
import * as well from '../../src/game/enemies/gravitywell';
import { novaSecFor, wellInNova } from '../../src/game/enemies/gravitywell';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs, SNAKE_SLOTS } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import { V2_GEN_CONFIG, type LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

/** The first n generated levels (V2 config) whose spec has at least one Gravity well. */
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

/** Live nova snake heads (heads in a slot that a well owns). */
function novaHeads(w: World): number {
  const g = gs(w);
  let n = 0;
  for (let s = 0; s < SNAKE_SLOTS; s++) {
    const h = g.snakeHead[s] ?? -1;
    if (h > 0 && g.snakeWell[s] !== -1 && w.alive[h] === 1 && w.kind[h] === Kind.SnakeHead) n++;
  }
  return n;
}

describe('nova snakes in real generated levels (GW2)', () => {
  const levels = wellLevels(12);

  it('finds real levels with wells, busy ones included', () => {
    expect(levels.length).toBe(12);
    expect(levels.some((d) => d.hazards.wells.length >= 2)).toBe(true);
  });

  it.each(levels.map((d, i) => [i, d] as const))('level %i: a nova snake is live 4 s after the first nova', (_i, def) => {
    const w = createGame(def, { vibrate: () => undefined });
    setInvulnerable(w, true); // scripted idle ship: never dies, never clears the arena
    const g = gs(w);
    let t = 0;
    let novaAt = -1;
    let novaId = -1;
    let spawns = 0;
    bus.on('sim:wellNova', (e) => {
      if (novaAt < 0) {
        novaAt = t;
        novaId = e.id;
      }
    });
    bus.on('sim:wellSpawn', (e) => {
      expect(e.kind).toBe(Kind.SnakeHead);
      spawns++;
    });
    const input = idle();
    for (let i = 0; i < 120 * 20 && (novaAt < 0 || t < novaAt + 4); i++) {
      t += DT;
      stepGame(w, DT, input);
    }
    expect(novaAt).toBeGreaterThan(0);
    expect(t).toBeGreaterThanOrEqual(novaAt + 4 - 1e-6);
    expect(spawns).toBeGreaterThan(0);
    expect(novaHeads(w)).toBeGreaterThan(0);
    // The erupting well is still a well, still in nova, and owns a snake.
    expect(wellInNova(w, novaId)).toBe(true);
    expect(Array.from(g.snakeWell).some((v) => v > 0)).toBe(true);
  });
});

describe('well slot compaction keeps each well its own nova state (GW2)', () => {
  const BIG = { shape: 'rect' as const, width: 2400, height: 1400, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };

  function twoWells(): { w: World; a: number; b: number } {
    const { w } = makeGame({ arena: BIG });
    setInvulnerable(w, true);
    const g = gs(w);
    const a = put(w, well.def, -700, 300);
    g.wellIds[g.wellCount++] = a;
    const b = put(w, well.def, 700, -300);
    g.wellIds[g.wellCount++] = b;
    w.x[0] = 0;
    w.y[0] = 600;
    return { w, a, b };
  }

  it('a well in nova keeps its nova and age when an earlier slot dies', () => {
    const { w, a, b } = twoWells();
    const g = gs(w);
    // Erupt only slot 1 (b): give it the age to erupt now, keep slot 0 young.
    g.wellAge[1] = novaSecFor(w.level.seed, 1);
    stepGame(w, DT, idle());
    expect(wellInNova(w, b)).toBe(true);
    expect(wellInNova(w, a)).toBe(false);
    const ageB = g.wellAge[1] ?? 0;
    killEnemy(w, a, true);
    expect(g.wellCount).toBe(1);
    expect(g.wellIds[0]).toBe(b);
    expect(g.wellNova[0]).toBe(1);
    expect(g.wellAge[0]).toBe(ageB);
    expect(g.wellOrd[0]).toBe(1);
    expect(wellInNova(w, b)).toBe(true);
    // No second eruption event, and its snakes keep coming.
    let novas = 0;
    let spawns = 0;
    bus.on('sim:wellNova', () => novas++);
    bus.on('sim:wellSpawn', (e) => {
      if (e.id === b) spawns++;
    });
    for (let i = 0; i < 120 * 5; i++) stepGame(w, DT, idle());
    expect(novas).toBe(0);
    expect(spawns).toBe(1);
  });

  it('a young well moved down a slot keeps its own nova time (its ordinal), not the dead slot one', () => {
    const { w, a, b } = twoWells();
    const g = gs(w);
    for (let i = 0; i < 120; i++) stepGame(w, DT, idle()); // both 1 s old
    killEnemy(w, a, true);
    expect(g.wellIds[0]).toBe(b);
    let at = -1;
    let t = 1;
    bus.on('sim:wellNova', (e) => {
      if (e.id === b && at < 0) at = t;
    });
    for (let i = 0; i < 120 * 8; i++) {
      t += DT;
      stepGame(w, DT, idle());
    }
    expect(at).toBeCloseTo(novaSecFor(w.level.seed, 1), 1);
  });
});
