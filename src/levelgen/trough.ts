// Trough ("half drum") maps for the generator and validator (trough wave, Ryan 2026-11-10). The
// arena is a flat rect with walls; the ground is a valley across the width (src/core/trough.ts):
// gentle at the floor u = 0, steep at the left and right rims. Gravity pulls the ship only. The
// maps keep the steep rims clear: obstacles and wells sit on the floor band, fixed spawn points
// are pulled in from the rims so enemies arrive across the valley. Pure: no PRNG, no DOM.
import { TROUGH_MIN_LEVEL, troughX } from '../core/trough';
import { bossForLevel } from './boss';
import { round1 } from './leveldef';
import type { ArenaDef, GravityWellDef, HazardDef, Obstacle, SpawnEntry, Vec2, WaveDef } from './leveldef';

/** Salt of the trough stream, mulberry32(deriveSeed(seed, TROUGH_SALT)). ASCII "TRGH". */
export const TROUGH_SALT = 0x54524748;
/** Chance a trough candidate (eligible and not a drum) is drawn trough, before the no repeat rule. */
export const TROUGH_CHANCE = 0.24;
/** A trough arena is at least this wide for its height (a wider open floor). */
export const TROUGH_MIN_ASPECT = 1.5;
/** Most obstacles on a trough level. */
export const TROUGH_MAX_OBSTACLES = 2;
/** Most gravity wells on a trough level. */
export const TROUGH_MAX_WELLS = 1;
/** Floor band: obstacle corners and wells keep |troughX| at most this (the rims stay clear). */
export const TROUGH_FLOOR_X = 0.55;
/** Fixed spawn points and spawners keep |troughX| at most this. */
export const TROUGH_SPAWN_X = 0.75;
/** Fixed spawn points are pulled toward the floor by this factor on x (no draw). */
export const TROUGH_SPAWN_SQUEEZE = 0.75;
/** Ring radius of a pulled spawn point that would land too close to an obstacle (as the generator's fallback). */
export const TROUGH_FALLBACK_RING_RADIUS = 300;

export { TROUGH_MIN_LEVEL };

/** True when level n may be a trough: TROUGH_MIN_LEVEL and up and not a boss level. */
export function troughEligible(levelIndex: number): boolean {
  return Number.isInteger(levelIndex) && levelIndex >= TROUGH_MIN_LEVEL && bossForLevel(levelIndex) === null;
}

/**
 * Trough levels never come two in a row: level n is a trough exactly when it is a candidate and
 * the run of consecutive candidates ending at n has odd length (the first of a run is a trough,
 * the next is not, and so on). candidate(m) is pure. Walks back to the first non candidate.
 */
export function troughFromCandidates(levelIndex: number, candidate: (m: number) => boolean): boolean {
  let run = 0;
  for (let m = levelIndex; m >= 1 && candidate(m); m--) run++;
  return run % 2 === 1;
}

/** The floor band of an arena as a narrower rect: obstacles and wells are placed inside it. */
export function troughFloorArena(arena: ArenaDef): ArenaDef {
  return { ...arena, width: round1(TROUGH_FLOOR_X * arena.width) };
}

const onFloor = (p: Vec2, width: number): boolean => Math.abs(troughX(p.x, width)) <= TROUGH_FLOOR_X + 1e-9;
const inSpawnBand = (p: Vec2, width: number): boolean => Math.abs(troughX(p.x, width)) <= TROUGH_SPAWN_X + 1e-9;

function obstacleCornersOf(o: Obstacle): Vec2[] {
  const hw = o.w / 2;
  const hh = o.h / 2;
  return [
    { x: o.cx - hw, y: o.cy - hh },
    { x: o.cx + hw, y: o.cy - hh },
    { x: o.cx + hw, y: o.cy + hh },
    { x: o.cx - hw, y: o.cy + hh },
  ];
}

/**
 * One fixed spawn entry pulled toward the floor: x times TROUGH_SPAWN_SQUEEZE (0.1 grid). If the
 * pulled point fails ok (an obstacle or the spawn clearance), the entry becomes a ring spawn at
 * TROUGH_FALLBACK_RING_RADIUS at the point's bearing. Ring entries are unchanged. No draw.
 */
export function troughEntry(e: SpawnEntry, ok: (p: Vec2) => boolean): SpawnEntry {
  if (e.mode !== 'fixed') return e;
  const p = { x: round1(e.x * TROUGH_SPAWN_SQUEEZE) + 0, y: e.y };
  if (ok(p)) return { ...e, x: p.x };
  const deg = Math.round((Math.atan2(p.y, p.x) * 180) / Math.PI);
  return { ...e, mode: 'ring', x: 0, y: 0, angleDeg: ((deg % 360) + 360) % 360, radius: TROUGH_FALLBACK_RING_RADIUS };
}

/** troughEntry on every entry of every wave. Returns new waves; the input is not changed. */
export function troughWaves(waves: readonly WaveDef[], ok: (p: Vec2) => boolean): WaveDef[] {
  return waves.map((w) => ({ ...w, entries: w.entries.map((e) => troughEntry(e, ok)) }));
}

/**
 * Trough hazards from drawn hazards, no draw: the first well on the floor band only (at most
 * TROUGH_MAX_WELLS), and the spawners inside the spawn band. Dropping hazards breaks no rule.
 */
export function troughHazards(h: HazardDef, width: number): HazardDef {
  const wells: GravityWellDef[] = h.wells.filter((w) => onFloor(w, width)).slice(0, TROUGH_MAX_WELLS);
  return { wells, spawners: h.spawners.filter((s) => inSpawnBand(s, width)) };
}

/**
 * The trough map rules (validator TR2 and Free Play FP7): shape rect or rectObstacles, at most
 * TROUGH_MAX_OBSTACLES obstacles with every corner on the floor band, at most TROUGH_MAX_WELLS
 * wells on the floor band, spawners and fixed spawn entries inside the spawn band. Messages only.
 */
export function troughMapErrors(arena: ArenaDef, hazards: HazardDef, entries: readonly SpawnEntry[]): string[] {
  const out: string[] = [];
  const W = arena.width;
  if (arena.shape !== 'rect' && arena.shape !== 'rectObstacles') out.push(`trough arena shape ${String(arena.shape)}, want rect or rectObstacles`);
  const n = arena.obstacles.length;
  if (n > TROUGH_MAX_OBSTACLES) out.push(`trough has ${n} obstacles, want 0 to ${TROUGH_MAX_OBSTACLES}`);
  arena.obstacles.forEach((o, i) => {
    if (!obstacleCornersOf(o).every((p) => onFloor(p, W))) out.push(`trough obstacle ${i} reaches the rim (beyond |x| ${TROUGH_FLOOR_X})`);
  });
  if (hazards.wells.length > TROUGH_MAX_WELLS) out.push(`trough has ${hazards.wells.length} gravity wells, want 0 to ${TROUGH_MAX_WELLS}`);
  hazards.wells.forEach((w, i) => {
    if (!onFloor(w, W)) out.push(`trough well ${i} on the rim (beyond |x| ${TROUGH_FLOOR_X})`);
  });
  hazards.spawners.forEach((s, i) => {
    if (!inSpawnBand(s, W)) out.push(`trough spawner ${i} beyond |x| ${TROUGH_SPAWN_X}`);
  });
  let bad = 0;
  for (const e of entries) if (e.mode === 'fixed' && !inSpawnBand(e, W)) bad++;
  if (bad > 0) out.push(`trough has ${bad} fixed spawn entries beyond |x| ${TROUGH_SPAWN_X}`);
  return out;
}
