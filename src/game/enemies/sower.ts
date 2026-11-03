// Sower (docs/10 wave C): heads for the nearest arena boundary, then hugs it at 70 u/s circulating
// clockwise on screen (y down), and drops a Mine every 3.0 s at its position (6 live per Sower,
// 24 in total; a drop at a cap is skipped). State: w.t seconds since the last drop.
// Roam (GW3, retimed GW4 for Ryan: the GW3 first dive came 20 s in, after most Sowers were shot):
// the first inward dive comes a hashed 6 to 10 s after spawn (its first live step), then a hashed
// 14 to 20 s after the previous dive, once it is back on the edge for at least EDGE_MIN_SEC. Times
// are hashed from the level seed, spawn index and loop (no PRNG). A dive steers smoothly to within
// CENTRE_REACH of the arena centre, then back out to the edge to orbit again. It keeps sowing.
// State: w.a spawn index (-1 until its first step), the roam arrays below. Nothing allocates per step.
// Render contract: position and rotation only.
import { hash01 } from '../../core/rng';
import { confineOn, createConfineResult } from '../arena';
import { enemySpeedScale } from '../state';
import { enrageTurn } from '../membrane';
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

/** First dive: FIRST_DIVE_MIN plus up to FIRST_DIVE_SPAN seconds after spawn (hashed). */
export const FIRST_DIVE_MIN = 6;
export const FIRST_DIVE_SPAN = 4;
/** Later dives: DIVE_GAP_MIN plus up to DIVE_GAP_SPAN seconds after the previous dive (hashed). */
export const DIVE_GAP_MIN = 14;
export const DIVE_GAP_SPAN = 6;
/** After the first dive the Sower orbits at least this long before the next one, so the return reads. */
export const EDGE_MIN_SEC = 2;
/** The inward leg ends within this distance of the arena centre (u). */
export const CENTRE_REACH = 150;
/** Turn rate while roaming (rad/s): smooth arcs, not snaps. */
export const ROAM_TURN = 2.5;
/** Speed multiplier on the inward leg: the dive reads as a rush and a well's pull cannot stall it. */
export const DIVE_SPEED_MUL = 1.35;
/** An inward leg blocked by an obstacle gives up after this many seconds and heads back out. */
export const INWARD_MAX_SEC = 12;

export const ROAM_EDGE = 0;
export const ROAM_IN = 1;
export const ROAM_OUT = 2;

const ROAM_SALT = 0x50e3a11d;

/**
 * Pure: seconds from the previous dive (or spawn, for loop 0) to dive number loop of the Sower with
 * spawn index idx: 6 to 10 for loop 0, 14 to 20 after.
 */
export function diveGapSeconds(seed: number, idx: number, loop: number): number {
  const h = hash01((seed ^ ROAM_SALT) >>> 0, (idx * 4096 + loop) >>> 0);
  return loop === 0 ? FIRST_DIVE_MIN + FIRST_DIVE_SPAN * h : DIVE_GAP_MIN + DIVE_GAP_SPAN * h;
}

/**
 * Pure: the roam phase after this step. legSec: seconds in the current phase; sinceDive: seconds
 * since the last dive (or spawn); gapSec: this loop's dive gap; minEdgeSec: least edge time before
 * the dive (0 for the first); hugging: on the wall now; centreDist: distance to the arena centre.
 */
export function nextRoamPhase(phase: number, legSec: number, sinceDive: number, gapSec: number, minEdgeSec: number, hugging: boolean, centreDist: number): number {
  if (phase === ROAM_EDGE) return sinceDive >= gapSec && legSec >= minEdgeSec ? ROAM_IN : ROAM_EDGE;
  if (phase === ROAM_IN) return centreDist <= CENTRE_REACH || legSec >= INWARD_MAX_SEC ? ROAM_OUT : ROAM_IN;
  return hugging ? ROAM_EDGE : ROAM_OUT;
}

interface RoamState {
  phase: Uint8Array;
  leg: Float32Array;
  sinceTurn: Float32Array;
  loops: Int32Array;
  /** Inward leg slide side while pressed against an obstacle (0 none, 1 cw, -1 ccw). */
  slide: Int8Array;
  /** Sowers seen so far in this world (the next spawn index). */
  count: number;
}

const roams = new WeakMap<World, RoamState>();

function roamOf(w: World): RoamState {
  let r = roams.get(w);
  if (r === undefined || r.phase.length !== w.cap) {
    r = { phase: new Uint8Array(w.cap), leg: new Float32Array(w.cap), sinceTurn: new Float32Array(w.cap), loops: new Int32Array(w.cap), slide: new Int8Array(w.cap), count: 0 };
    roams.set(w, r);
  }
  return r;
}

/** Roam phase of a Sower (ROAM_EDGE before its first step). */
export function roamPhase(w: World, id: number): number {
  return roamOf(w).phase[id] ?? ROAM_EDGE;
}

/**
 * True while a Sower is off the edge on a dive, inward or back out. Wells do not pull it then (like
 * a dashing Charger), so a well cannot stall the dive or trap the return (GW4).
 */
export function isRoaming(w: World, id: number): boolean {
  return (w.a[id] ?? -1) >= 0 && (roamOf(w).phase[id] ?? ROAM_EDGE) !== ROAM_EDGE;
}

/** Spawn index of a Sower, -1 before its first step. */
export function spawnIndex(w: World, id: number): number {
  return w.a[id] ?? -1;
}

const probe = createConfineResult();
const dir = { x: 0, y: 0 };
/** Scratch for the offset to the arena centre (u 0, v 0), reached the short way across the seam. */
const cd = { x: 0, y: 0 };
const inward: InwardResult = { heading: 0, side: 0 };

/**
 * Writes the unit travel direction for a Sower at (x, y) with radius r into out: clockwise along
 * the wall when within HUG_MARGIN of it, else toward the nearest boundary. Returns true when hugging.
 */
export function sowerDirection(w: World, x: number, y: number, r: number, out: { x: number; y: number }): boolean {
  const arena = w.level.arena;
  const p = confineOn(w.surface, arena, x, y, r + HUG_MARGIN, probe);
  let dx: number;
  let dy: number;
  let hugging = false;
  if (p.hit) {
    // Inward normal n; clockwise tangent on a y down screen is (ny, -nx).
    dx = p.ny - p.nx * HUG_PULL;
    dy = -p.nx - p.ny * HUG_PULL;
    hugging = true;
  } else if (w.surface.topology.wrapU) {
    // Cylinder: no u wall, the only boundaries are the rims, so head for the nearer rim.
    dx = 0;
    dy = y >= 0 ? 1 : -1;
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

/** Result of inwardHeading: the target heading and the slide side to keep (0 none, 1 cw, -1 ccw). */
export interface InwardResult {
  heading: number;
  side: number;
}

/** Slide side look ahead: steps of SLIDE_STEP u, at most SLIDE_STEPS per side. */
const SLIDE_STEP = 48;
const SLIDE_STEPS = 10;

/** True when a Sower of radius r at (px, py) is clear of every boundary and can head along (dx, dy). */
function clearAt(w: World, px: number, py: number, r: number, dx: number, dy: number): boolean {
  const arena = w.level.arena;
  const sf = w.surface;
  if (confineOn(sf, arena, px, py, r, probe).hit) return false;
  return !confineOn(sf, arena, px + dx * (r + HUG_MARGIN), py + dy * (r + HUG_MARGIN), r + HUG_MARGIN, probe).hit;
}

/**
 * Pure: the slide side (1 clockwise, -1 counter clockwise) around the obstacle a Sower at (x, y)
 * presses into with inward normal (nx, ny) while heading (dx, dy): the side along whose tangent a
 * point SLIDE_STEP, 2 SLIDE_STEP, ... away first has a clear way on (the shorter way round).
 * Clockwise on a tie or when neither clears within SLIDE_STEPS.
 */
export function slideSide(w: World, x: number, y: number, r: number, nx: number, ny: number, dx: number, dy: number): number {
  // Clockwise tangent on a y down screen is (ny, -nx). Probe from just off the face.
  const ox = x + nx * HUG_MARGIN;
  const oy = y + ny * HUG_MARGIN;
  for (let k = 1; k <= SLIDE_STEPS; k++) {
    const l = k * SLIDE_STEP;
    if (clearAt(w, ox + ny * l, oy - nx * l, r, dx, dy)) return 1;
    if (clearAt(w, ox - ny * l, oy + nx * l, r, dx, dy)) return -1;
  }
  return 1;
}

/**
 * Heading of the inward leg from (x, y), into out: straight at the arena centre, but while that
 * presses into a boundary or obstacle within HUG_MARGIN it slides along it so it rounds the obstacle
 * instead of jamming on a corner (GW4: dives in obstacle arenas gave up short of the centre). The
 * slide side is picked on first contact (slideSide, the shorter way round) and kept while the
 * contact lasts (side in), so it never flips; out.side is 0 once the way to the centre is clear.
 */
export function inwardHeading(w: World, x: number, y: number, r: number, side: number, out: InwardResult): InwardResult {
  w.surface.delta(x, y, 0, 0, cd);
  const d = Math.sqrt(cd.x * cd.x + cd.y * cd.y);
  out.side = 0;
  if (d < 1e-9) {
    out.heading = 0;
    return out;
  }
  let dx = cd.x / d;
  let dy = cd.y / d;
  const p = confineOn(w.surface, w.level.arena, x, y, r + HUG_MARGIN, probe);
  if (p.hit && dx * p.nx + dy * p.ny < 0) {
    const nx = p.nx;
    const ny = p.ny;
    const s = side !== 0 ? side : slideSide(w, x, y, r, nx, ny, dx, dy);
    dx = s * ny;
    dy = -s * nx;
    out.side = s;
  }
  out.heading = Math.atan2(dy, dx);
  return out;
}

/** Distance from (x, y) to the arena centre, the short way across the seam. */
function centreDist(w: World, x: number, y: number): number {
  w.surface.delta(x, y, 0, 0, cd);
  return Math.sqrt(cd.x * cd.x + cd.y * cd.y);
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
    st.slide[id] = 0;
  }
  const leg = (st.leg[id] ?? 0) + dt;
  const since = (st.sinceTurn[id] ?? 0) + dt;
  const phase = st.phase[id] ?? ROAM_EDGE;
  const hugging = sowerDirection(w, x, y, w.radius[id] ?? def.radius, dir);
  const loop = st.loops[id] ?? 0;
  const gap = diveGapSeconds(w.level.seed, w.a[id] ?? 0, loop);
  const next = nextRoamPhase(phase, leg, since, gap, loop === 0 ? 0 : EDGE_MIN_SEC, hugging, centreDist(w, x, y));
  st.leg[id] = next === phase ? leg : 0;
  const dive = next === ROAM_IN && phase === ROAM_EDGE;
  st.sinceTurn[id] = dive ? 0 : since;
  if (dive) st.loops[id] = loop + 1;
  st.phase[id] = next;
  const s = def.speed * enemySpeedScale(w, id) * dt * (next === ROAM_IN ? DIVE_SPEED_MUL : 1);
  if (next === ROAM_EDGE) {
    moveTo(w, id, x + dir.x * s, y + dir.y * s);
    w.rot[id] = Math.atan2(dir.y, dir.x);
  } else {
    // In: toward the centre, sliding along an obstacle it presses into. Out: toward the nearest wall
    // (sowerDirection off the wall).
    let target = Math.atan2(dir.y, dir.x);
    if (next === ROAM_IN) {
      inwardHeading(w, x, y, w.radius[id] ?? def.radius, phase === ROAM_IN ? (st.slide[id] ?? 0) : 0, inward);
      target = inward.heading;
      st.slide[id] = inward.side;
    }
    const heading = turnToward(w.rot[id] ?? 0, target, ROAM_TURN * enrageTurn(w, id) * dt);
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
