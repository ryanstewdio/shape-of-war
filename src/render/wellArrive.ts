// Look GW2: gravity well arrival and nova snake emergence. On 'sim:wellArrive' { id, x, y, inSec }
// a ring of white dust converges on (x, y), tightening over inSec and turning clockwise, then
// flashes as the well appears. On 'sim:wellSpawn' a bright burst flares at the well centre with an
// expanding ring, and a short trail follows the snake head that crawled out, so the snake reads as
// emerging from the well. Small fixed state and pure maths; the renderer owns the Graphics.
import type { Bus, EventKey } from '../core/events';
import { hash01 } from './color';
import { WHIRL_CW } from './wellNova';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Live arrivals at once. */
export const ARRIVE_SLOTS = 4;
/** Dust points on the converging ring. */
export const ARRIVE_DOTS = 28;
/** Ring radius at the telegraph start and at the end (the well's body radius). */
export const ARRIVE_R0 = 120;
export const ARRIVE_R1 = 24;
/** Turns (radians) the ring makes while it tightens, clockwise on screen. */
export const ARRIVE_TURN = 2.6;
/** Flash seconds once the well appears. */
export const ARRIVE_FLASH_SEC = 0.35;
/** Fallback telegraph length when inSec is missing or not positive. */
export const ARRIVE_DEFAULT_SEC = 1;

export interface ArriveState {
  /** Seconds since the telegraph started, Infinity for a free slot. */
  readonly age: Float64Array;
  readonly inSec: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly id: Int32Array;
}

export function createArriveState(): ArriveState {
  return {
    age: new Float64Array(ARRIVE_SLOTS).fill(Number.POSITIVE_INFINITY),
    inSec: new Float64Array(ARRIVE_SLOTS).fill(ARRIVE_DEFAULT_SEC),
    x: new Float64Array(ARRIVE_SLOTS),
    y: new Float64Array(ARRIVE_SLOTS),
    id: new Int32Array(ARRIVE_SLOTS),
  };
}

export function resetArriveState(s: ArriveState): void {
  s.age.fill(Number.POSITIVE_INFINITY);
}

/** Pick a free slot, or the oldest when all are live. */
function slotOf(age: Float64Array): number {
  let k = 0;
  for (let j = 0; j < age.length; j++) {
    if (!Number.isFinite(age[j] ?? 0)) return j;
    if ((age[j] ?? 0) > (age[k] ?? 0)) k = j;
  }
  return k;
}

/** Record an arrival telegraph. Returns the slot. */
export function arriveEvent(s: ArriveState, id: number, x: number, y: number, inSec: number): number {
  const k = slotOf(s.age);
  s.age[k] = 0;
  s.inSec[k] = inSec > 0 && Number.isFinite(inSec) ? inSec : ARRIVE_DEFAULT_SEC;
  s.x[k] = fin(x, 0);
  s.y[k] = fin(y, 0);
  s.id[k] = Number.isInteger(id) ? id : 0;
  return k;
}

/** Age live slots; free a slot once its flash is over. */
export function stepArrive(s: ArriveState, dt: number): void {
  const d = Math.max(0, fin(dt, 0));
  for (let k = 0; k < ARRIVE_SLOTS; k++) {
    const a = s.age[k] ?? Infinity;
    if (!Number.isFinite(a)) continue;
    const n = a + d;
    s.age[k] = n > (s.inSec[k] ?? 0) + ARRIVE_FLASH_SEC ? Number.POSITIVE_INFINITY : n;
  }
}

/** Pure: true while any arrival slot is live. */
export function arriveAny(s: ArriveState): boolean {
  for (let k = 0; k < ARRIVE_SLOTS; k++) if (Number.isFinite(s.age[k] ?? Infinity)) return true;
  return false;
}

/** Pure: telegraph progress 0 to 1 at age of inSec. */
export function arriveProgress(age: number, inSec: number): number {
  const T = inSec > 0 ? inSec : ARRIVE_DEFAULT_SEC;
  return Math.max(0, Math.min(1, fin(age, 0) / T));
}

/** Pure: ring radius at progress p: from ARRIVE_R0 to ARRIVE_R1, tightening faster at the end. */
export function arriveRadius(p: number): number {
  const q = 1 - Math.max(0, Math.min(1, fin(p, 1)));
  return ARRIVE_R1 + (ARRIVE_R0 - ARRIVE_R1) * Math.sqrt(q) * q;
}

/** Pure: flash 0 to 1: zero during the telegraph, 1 as the well appears, gone after ARRIVE_FLASH_SEC. */
export function arriveFlash(age: number, inSec: number): number {
  const t = fin(age, 0) - (inSec > 0 ? inSec : ARRIVE_DEFAULT_SEC);
  if (t < 0 || t > ARRIVE_FLASH_SEC) return 0;
  return 1 - t / ARRIVE_FLASH_SEC;
}

export interface DustPoint {
  x: number;
  y: number;
  /** Alpha 0 to 1. */
  a: number;
}

/**
 * Pure: dust point k of well id on the converging ring at progress p, about the origin. Points are
 * spread round the ring with a hashed radial wobble and turn clockwise as the ring tightens; they
 * brighten as it closes.
 */
export function arriveDot(id: number, k: number, p: number, out: DustPoint): DustPoint {
  const seed = (id | 0) * 613 + (k | 0) * 37;
  const q = Math.max(0, Math.min(1, fin(p, 0)));
  const ang = (k * Math.PI * 2) / ARRIVE_DOTS + hash01(seed + 1) * 0.3 + WHIRL_CW * ARRIVE_TURN * q;
  const r = arriveRadius(q) * (0.9 + 0.2 * hash01(seed + 2));
  out.x = Math.cos(ang) * r;
  out.y = Math.sin(ang) * r;
  out.a = Math.min(1, 0.25 + 0.75 * q) * (0.6 + 0.4 * hash01(seed + 3));
  return out;
}

// Snake emergence

/** Live emergences at once, their life, and trail points kept per emergence. */
export const EMERGE_SLOTS = 4;
export const EMERGE_LIFE = 0.9;
export const EMERGE_TRAIL = 10;
/** A snake head within this distance of the well centre in the first frames is the one that emerged. */
export const EMERGE_MATCH_R = 90;
/** Matching stops after this many seconds (the head has crawled away or never showed). */
export const EMERGE_MATCH_SEC = 0.25;
/** Burst ring radius at the end of the life. */
export const EMERGE_RING_R = 70;

export interface EmergeState {
  readonly age: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Entity index of the matched snake head, -1 before. */
  readonly head: Int32Array;
  /** Trail points: EMERGE_TRAIL x, y pairs per slot (newest last), and the count filled. */
  readonly trail: Float32Array;
  readonly count: Int32Array;
}

export function createEmergeState(): EmergeState {
  return {
    age: new Float64Array(EMERGE_SLOTS).fill(Number.POSITIVE_INFINITY),
    x: new Float64Array(EMERGE_SLOTS),
    y: new Float64Array(EMERGE_SLOTS),
    head: new Int32Array(EMERGE_SLOTS).fill(-1),
    trail: new Float32Array(EMERGE_SLOTS * EMERGE_TRAIL * 2),
    count: new Int32Array(EMERGE_SLOTS),
  };
}

export function resetEmergeState(s: EmergeState): void {
  s.age.fill(Number.POSITIVE_INFINITY);
  s.head.fill(-1);
  s.count.fill(0);
}

/** Record an emergence at the well centre (x, y). Returns the slot. */
export function emergeEvent(s: EmergeState, x: number, y: number): number {
  const k = slotOf(s.age);
  s.age[k] = 0;
  s.x[k] = fin(x, 0);
  s.y[k] = fin(y, 0);
  s.head[k] = -1;
  s.count[k] = 0;
  return k;
}

/** Push a trail point for slot k, dropping the oldest when full. */
export function emergePush(s: EmergeState, k: number, x: number, y: number): void {
  const base = k * EMERGE_TRAIL * 2;
  let n = s.count[k] ?? 0;
  if (n >= EMERGE_TRAIL) {
    s.trail.copyWithin(base, base + 2, base + EMERGE_TRAIL * 2);
    n = EMERGE_TRAIL - 1;
  }
  s.trail[base + n * 2] = x;
  s.trail[base + n * 2 + 1] = y;
  s.count[k] = n + 1;
}

/**
 * Snake head entity i is drawn at (x, y): follow it if a slot already tracks it, else claim the
 * nearest unmatched young slot within EMERGE_MATCH_R. Returns the slot or -1.
 */
export function emergeTrack(s: EmergeState, i: number, x: number, y: number): number {
  for (let k = 0; k < EMERGE_SLOTS; k++) {
    if (s.head[k] === i && Number.isFinite(s.age[k] ?? Infinity)) {
      emergePush(s, k, x, y);
      return k;
    }
  }
  let best = -1;
  let bestD = EMERGE_MATCH_R * EMERGE_MATCH_R;
  for (let k = 0; k < EMERGE_SLOTS; k++) {
    const a = s.age[k] ?? Infinity;
    if (!(a <= EMERGE_MATCH_SEC) || (s.head[k] ?? -1) >= 0) continue;
    const dx = x - (s.x[k] ?? 0);
    const dy = y - (s.y[k] ?? 0);
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = k;
    }
  }
  if (best >= 0) {
    s.head[best] = i;
    emergePush(s, best, s.x[best] ?? x, s.y[best] ?? y);
    emergePush(s, best, x, y);
  }
  return best;
}

export function stepEmerge(s: EmergeState, dt: number): void {
  const d = Math.max(0, fin(dt, 0));
  for (let k = 0; k < EMERGE_SLOTS; k++) {
    const a = s.age[k] ?? Infinity;
    if (!Number.isFinite(a)) continue;
    const n = a + d;
    if (n > EMERGE_LIFE) {
      s.age[k] = Number.POSITIVE_INFINITY;
      s.head[k] = -1;
      s.count[k] = 0;
    } else s.age[k] = n;
  }
}

export function emergeAny(s: EmergeState): boolean {
  for (let k = 0; k < EMERGE_SLOTS; k++) if (Number.isFinite(s.age[k] ?? Infinity)) return true;
  return false;
}

/** Pure: burst flash 0 to 1 at age: full at once, quick decay. */
export function emergeFlash(age: number): number {
  const a = fin(age, EMERGE_LIFE);
  return a < 0 || a > EMERGE_LIFE ? 0 : Math.exp(-a * 5) * (1 - a / EMERGE_LIFE);
}

/** Pure: burst ring radius at age, growing to EMERGE_RING_R over the life. */
export function emergeRing(age: number): number {
  const u = Math.max(0, Math.min(1, fin(age, 0) / EMERGE_LIFE));
  return 8 + (EMERGE_RING_R - 8) * (1 - (1 - u) * (1 - u));
}

/** Pure: trail alpha 0 to 1 at age: fades out over the life. */
export function emergeTrailAlpha(age: number): number {
  const u = Math.max(0, Math.min(1, fin(age, EMERGE_LIFE) / EMERGE_LIFE));
  return 1 - u;
}

// Bus

export const WELL_ARRIVE_EVENT = 'sim:wellArrive';
export const WELL_SPAWN_EVENT = 'sim:wellSpawn';
type ArriveKey = Extract<EventKey, typeof WELL_ARRIVE_EVENT>;
type SpawnKey = Extract<EventKey, typeof WELL_SPAWN_EVENT>;

export function onWellArrive(b: Bus, h: (id: number, x: number, y: number, inSec: number) => void): () => void {
  return b.on<ArriveKey>(WELL_ARRIVE_EVENT, (p) => h(p.id, p.x, p.y, p.inSec));
}

export function onWellSpawn(b: Bus, h: (id: number, x: number, y: number) => void): () => void {
  return b.on<SpawnKey>(WELL_SPAWN_EVENT, (p) => h(p.id, p.x, p.y));
}
