// Leaver (forge-leaver, Ryan: "very similar to Weaver, but when killed it breaks into several smaller
// pieces with single colour fills that shimmer, which delay for 0.5 s, then pursue 6 percent faster
// than Weaver"). Original design: a yellow square, a green square frame turned 40 degrees over it,
// and a red square inside the frame.
//
// The Leaver moves exactly like the Weaver (weaver.step, same speed, dodge and cooldown) with 2 hit
// points. A scored kill calls splitLeaver (combat.ts killEnemy): up to SHARD_COUNT shards, two of
// each colour, flung SHARD_FLING u outward at hashed angles (hash01, no PRNG). A shard holds still
// (apart from the fling) for SHARD_HOLD_SEC, then chases the ship or a decoy at SHARD_SPEED_RATIO x
// the Weaver speed. Shards count against maxLiveEnemies: shards that do not fit are dropped. No
// split on unscored removal (bomb, death clear, a well eating it).
//
// Shard state (render contract): w.t seconds since the split, w.a the colour index (0 yellow,
// 1 green, 2 red), w.vx, w.vy the unit fling direction, w.rot the heading once chasing.
import { hash01 } from '../../core/rng';
import type { PaletteKey } from '../../render/neon';
import { enemySpeedScale, isWaveEnemy, spawnFromDef } from '../state';
import { moveTo, seekShip } from '../steer';
import { Kind, type World } from '../world';
import type { EnemyDef } from './types';
import * as weaver from './weaver';

export const def: EnemyDef = { kind: Kind.Leaver, radius: weaver.def.radius, speed: weaver.def.speed, value: weaver.def.value, colour: 'green', hp: 2, geoms: weaver.def.geoms };

/** The Leaver moves exactly like the Weaver. */
export const step = weaver.step;

export const SHARD_COUNT = 6;
/** Seconds a shard holds before it chases. */
export const SHARD_HOLD_SEC = 0.5;
/** Shard chase speed over the Weaver's. */
export const SHARD_SPEED_RATIO = 1.06;
/** Distance a shard is flung outward during the hold, u. */
export const SHARD_FLING = 40;
/** Seconds the fling takes (an ease out inside the hold). */
export const SHARD_FLING_SEC = 0.15;
/** Most a hashed angle strays from its even slot, radians (a third of the 60 degree slot). */
export const SHARD_JITTER = Math.PI / 9;
/** Shard colours by index: two of each, interleaved so a capped split still shows every colour. */
export const SHARD_COLOURS: readonly PaletteKey[] = ['yellow', 'green', 'red'];

export const shardDef: EnemyDef = {
  kind: Kind.LeaverShard,
  radius: 7,
  speed: weaver.def.speed * SHARD_SPEED_RATIO,
  value: weaver.def.value / 4,
  colour: 'yellow',
  hp: 1,
  geoms: 0,
};

/** Pure: palette key of shard colour index c (0 yellow, 1 green, 2 red). */
export function shardColour(c: number): PaletteKey {
  return SHARD_COLOURS[((c % 3) + 3) % 3] ?? 'yellow';
}

/** Pure: colour index of shard i of a split (0 to 5): yellow, green, red, yellow, green, red. */
export function shardColourIndex(i: number): number {
  return i % 3;
}

const SALT_ANGLE = 0x4c564152; // 'LVAR'

/**
 * Pure: the outward angle of shard i of a split keyed by (key, step). Six even slots from a hashed
 * base, each nudged by up to SHARD_JITTER. Same inputs, same angle.
 */
export function shardAngle(key: number, step: number, i: number): number {
  const k = (key ^ SALT_ANGLE) >>> 0;
  const base = hash01(k, step >>> 0) * Math.PI * 2;
  const jitter = (hash01(k, (step + 7919 * (i + 1)) >>> 0) * 2 - 1) * SHARD_JITTER;
  return base + (i * Math.PI * 2) / SHARD_COUNT + jitter;
}

/** Pure: fling progress at age t, 0 to 1 (ease out over SHARD_FLING_SEC). */
export function flingAt(t: number): number {
  if (!(t > 0)) return 0;
  if (t >= SHARD_FLING_SEC) return 1;
  const u = 1 - t / SHARD_FLING_SEC;
  return 1 - u * u;
}

/** Live wave enemies (the maxLiveEnemies count). */
function liveWaveEnemies(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && isWaveEnemy(w.kind[i] ?? 0)) n++;
  return n;
}

/**
 * A Leaver died at (x, y): release up to SHARD_COUNT shards, as many as maxLiveEnemies and the
 * entity pool allow. key is the dead Leaver's id. Returns the number of shards released.
 */
export function splitLeaver(w: World, x: number, y: number, key: number): number {
  const room = w.level.waves.maxLiveEnemies - liveWaveEnemies(w);
  const n = Math.min(SHARD_COUNT, room);
  let made = 0;
  for (let i = 0; i < n; i++) {
    const id = spawnFromDef(w, shardDef, x, y, 0);
    if (id < 0) break;
    const a = shardAngle(key, w.tick, i);
    w.vx[id] = Math.cos(a);
    w.vy[id] = Math.sin(a);
    w.rot[id] = a;
    w.t[id] = 0;
    w.a[id] = shardColourIndex(i);
    made++;
  }
  return made;
}

/** Shard step: the fling and hold, then the chase. */
export function stepShard(w: World, id: number, dt: number): void {
  const t0 = w.t[id] ?? 0;
  const t1 = t0 + dt;
  w.t[id] = t1;
  if (t0 < SHARD_HOLD_SEC) {
    const d = SHARD_FLING * (flingAt(t1) - flingAt(t0));
    if (d > 0) moveTo(w, id, (w.x[id] ?? 0) + (w.vx[id] ?? 0) * d, (w.y[id] ?? 0) + (w.vy[id] ?? 0) * d);
    if (t1 < SHARD_HOLD_SEC) return;
  }
  w.rot[id] = seekShip(w, id, shardDef.speed * enemySpeedScale(w, id), dt);
}

/** True when id is a shard still in its hold (render: shimmer harder, no heading). */
export function shardHolding(w: World, id: number): boolean {
  return w.kind[id] === Kind.LeaverShard && (w.t[id] ?? 0) < SHARD_HOLD_SEC;
}
