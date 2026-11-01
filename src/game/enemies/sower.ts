// Sower (docs/10 wave C): heads for the nearest arena boundary, then hugs it at 70 u/s circulating
// clockwise on screen (y down), and drops a Mine every 3.0 s at its position (6 live per Sower,
// 24 in total; a drop at a cap is skipped). State: w.t seconds since the last drop.
// GW3 roam (Ryan): after a hashed 12 to 18 s on the edge (spawn index and level seed, no PRNG) it
// turns, steers smoothly to within CENTRE_REACH of the arena centre, then back to the edge and
// orbits again; an inward turn comes at most once per LOOP_MIN_SEC. It keeps sowing throughout.
// State: w.a spawn index (-1 until its first step), the roam arrays below. Nothing allocates per step.
// Render contract: position and rotation only.
import { hash01 } from '../../core/rng';
import { confine, createConfineResult } from '../arena';
import { enemySpeedScale } from '../state';
import { moveTo, turnToward } from '../steer';
import { Kind, type World } from '../world';
import { dropMine } from './mine';
import type { EnemyDef } from './types';

export const def: EnemyDef = { kind: Kind.Sower, radius: 16, speed: 70, value: 180, colour: 'sower', hp: 4, geoms: 3 };

export const DROP_SEC = 3.0;
/** Distance from the wall (beyond the hitbox) inside which the Sower counts as hugging. */
export const HUG_MARGIN = 8;
/** Share of the wall ward push mixed into the tangent so the Sower keeps contact on curves. */
const HUG_PULL = 0.35;

/** Roam: edge orbit seconds per loop, ROAM_MIN_SEC plus up to ROAM_SPAN_SEC (hashed). */
export const ROAM_MIN_SEC = 12;
export const ROAM_SPAN_SEC = 6;
/** Inward turns are at least this far apart (s), so one full loop takes at least this long. */
export const LOOP_MIN_SEC = 20;
/** The inward leg ends within this distance of the arena centre (u). */
export const CENTRE_REACH = 150;
/** Turn rate while roaming (rad/s): smooth arcs, not snaps. */
export const ROAM_TURN = 2.5;
/** An inward leg blocked by an obstacle gives up after this many seconds and heads back out. */
export const INWARD_MAX_SEC = 12;

export const ROAM_EDGE = 0;
export const ROAM_IN = 1;
export const ROAM_OUT = 2;

const ROAM_SALT = 0x50e3a11d;

/** Pure: seconds on the edge in loop `loop` of the Sower with spawn index idx (12 to 18). */
export function edgeSeconds(seed: number, idx: number, loop: number): number {
  return ROAM_MIN_SEC + ROAM_SPAN_SEC * hash01((seed ^ ROAM_SALT) >>> 0, (idx * 4096 + loop) >>> 0);
}

/**
 * Pure: the roam phase after this step. legSec: seconds in the current phase; sinceTurn: seconds
 * since the last inward turn (or spawn); edgeSec: this loop's edge time; hugging: on the wall now;
 * centreDist: distance to the arena centre.
 */
export function nextRoamPhase(phase: number, legSec: number, sinceTurn: number, edgeSec: number, hugging: boolean, centreDist: number): number {
  if (phase === ROAM_EDGE) return hugging && legSec >= edgeSec && sinceTurn >= LOOP_MIN_SEC ? ROAM_IN : ROAM_EDGE;
  if (phase === ROAM_IN) return centreDist <= CENTRE_REACH || legSec >= INWARD_MAX_SEC ? ROAM_OUT : ROAM_IN;
  return hugging ? ROAM_EDGE : ROAM_OUT;
}

interface RoamState {
  phase: Uint8Array;
  leg: Float32Array;
  sinceTurn: Float32Array;
  loops: Int32Array;
  /** Sowers seen so far in this world (the next spawn index). */
  count: number;
}

const roams = new WeakMap<World, RoamState>();

function roamOf(w: World): RoamState {
  let r = roams.get(w);
  if (r === undefined || r.phase.length !== w.cap) {
    r = { phase: new Uint8Array(w.cap), leg: new Float32Array(w.cap), sinceTurn: new Float32Array(w.cap), loops: new Int32Array(w.cap), count: 0 };
    roams.set(w, r);
  }
  return r;
}

/** Roam phase of a Sower (ROAM_EDGE before its first step). */
export function roamPhase(w: World, id: number): number {
  return roamOf(w).phase[id] ?? ROAM_EDGE;
}

/** Spawn index of a Sower, -1 before its first step. */
export function spawnIndex(w: World, id: number): number {
  return w.a[id] ?? -1;
}

const probe = createConfineResult();
const dir = { x: 0, y: 0 };

/**
 * Writes the unit travel direction for a Sower at (x, y) with radius r into out: clockwise along
 * the wall when within HUG_MARGIN of it, else toward the nearest boundary. Returns true when hugging.
 */
export function sowerDirection(w: World, x: number, y: number, r: number, out: { x: number; y: number }): boolean {
  const arena = w.level.arena;
  const p = confine(arena, x, y, r + HUG_MARGIN, probe);
  let dx: number;
  let dy: number;
  let hugging = false;
  if (p.hit) {
    // Inward normal n; clockwise tangent on a y down screen is (ny, -nx).
    dx = p.ny - p.nx * HUG_PULL;
    dy = -p.nx - p.ny * HUG_PULL;
    hugging = true;
  } else if (arena.shape === 'circle' || arena.shape === 'hexagon') {
    dx = x;
    dy = y;
  } else {
    const gapX = arena.width / 2 - Math.abs(x);
    const gapY = arena.height / 2 - Math.abs(y);
    if (gapX < gapY) {
      dx = x >= 0 ? 1 : -1;
      dy = 0;
    } else {
      dx = 0;
      dy = y >= 0 ? 1 : -1;
    }
  }
  const l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-9) {
    out.x = 1;
    out.y = 0;
  } else {
    out.x = dx / l;
    out.y = dy / l;
  }
  return hugging;
}

export function step(w: World, id: number, dt: number): void {
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  const st = roamOf(w);
  if ((w.a[id] ?? -1) < 0) {
    w.a[id] = st.count++;
    st.phase[id] = ROAM_EDGE;
    st.leg[id] = 0;
    st.sinceTurn[id] = 0;
    st.loops[id] = 0;
  }
  const leg = (st.leg[id] ?? 0) + dt;
  const since = (st.sinceTurn[id] ?? 0) + dt;
  const phase = st.phase[id] ?? ROAM_EDGE;
  const hugging = sowerDirection(w, x, y, w.radius[id] ?? def.radius, dir);
  const edge = edgeSeconds(w.level.seed, w.a[id] ?? 0, st.loops[id] ?? 0);
  const next = nextRoamPhase(phase, leg, since, edge, hugging, Math.sqrt(x * x + y * y));
  st.leg[id] = next === phase ? leg : 0;
  st.sinceTurn[id] = next === ROAM_IN && phase === ROAM_EDGE ? 0 : since;
  if (next === ROAM_EDGE && phase === ROAM_OUT) st.loops[id] = (st.loops[id] ?? 0) + 1;
  st.phase[id] = next;
  const s = def.speed * enemySpeedScale(w) * dt;
  if (next === ROAM_EDGE) {
    moveTo(w, id, x + dir.x * s, y + dir.y * s);
    w.rot[id] = Math.atan2(dir.y, dir.x);
  } else {
    // In: toward the centre. Out: toward the nearest wall (sowerDirection off the wall).
    const target = next === ROAM_IN ? Math.atan2(-y, -x) : Math.atan2(dir.y, dir.x);
    const heading = turnToward(w.rot[id] ?? 0, target, ROAM_TURN * dt);
    moveTo(w, id, x + Math.cos(heading) * s, y + Math.sin(heading) * s);
    w.rot[id] = heading;
  }
  let t = (w.t[id] ?? 0) + dt;
  if (t >= DROP_SEC) {
    t -= DROP_SEC;
    dropMine(w, id, w.x[id] ?? 0, w.y[id] ?? 0);
  }
  w.t[id] = t;
}
