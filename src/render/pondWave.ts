// Pond ripples, render side (T4: a wave starts only when a super nova Gravity well is destroyed).
// Pure state and maths, no pixi.js, no PRNG. There is no telegraph: on 'sim:ripple' the wave
// starts at once. The lead crest sits exactly on POND_WAVE_SPEED x age (the sim push front) and
// has the sim band's shape (cos squared, half width POND_WAVE_WIDTH); two trailing crests follow
// it like water, fading to nothing at POND_WAVE_LIFE. The wave is a render time displacement added
// on top of the grid (lattice nodes or the v1 grid trace), never integrated, so the grid is
// exactly flat after it. On drums the distance wraps across the seam (period = drum width).
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH } from '../core/pondRipple';

/** Live pond waves at once. A fourth replaces the oldest. */
export const MAX_POND_WAVES = 3;
/** Crests per wave: the lead crest plus two trailing ones. */
export const POND_CRESTS = 3;
/** Distance between trailing crests, arena units: one crest a second at the wave speed. */
export const POND_WAVELENGTH = POND_WAVE_WIDTH * 2.25;
/** Each trailing crest carries this share of the one ahead of it. */
export const POND_TRAIL_DECAY = 0.6;
/** Peak radial displacement at strength 0 and strength 1, arena units (T4: three times T3). */
export const POND_AMP_MIN = 40;
export const POND_AMP_MAX = 80;
/** Lift out of the floor under tilt, as a multiple of the radial displacement. */
export const POND_LIFT_MUL = 1.2;
/** Seconds the lead crest takes to reach full height, so a wave never pops in. */
export const POND_ATTACK_SEC = 0.12;
/** Crest height (arena units, before the lift multiple) at which a lattice line is fully white. */
export const POND_GLOW_REF = POND_AMP_MIN;

/** Waveform reach ahead of the lead crest and behind it, arena units (both ends are zeros). */
const AHEAD = POND_WAVE_WIDTH;
const BEHIND = POND_WAVE_WIDTH + (POND_CRESTS - 1) * POND_WAVELENGTH;

export interface PondWave {
  x: number;
  y: number;
  age: number;
  strength: number;
}

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

function clampStrength(s: number): number {
  const v = fin(s, 0);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Index of the oldest entry. */
function oldest(list: readonly { age: number }[]): number {
  let k = 0;
  for (let i = 1; i < list.length; i++) if ((list[i]?.age ?? 0) > (list[k]?.age ?? 0)) k = i;
  return k;
}

/** Start a pond wave at (x, y) at once. At MAX_POND_WAVES the oldest goes. */
export function addPondWave(list: PondWave[], x: number, y: number, strength: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (list.length >= MAX_POND_WAVES) list.splice(oldest(list), 1);
  list.push({ x, y, age: 0, strength: clampStrength(strength) });
}

/** Age waves and drop finished ones, in place. */
export function stepPondWaves(list: PondWave[], dt: number): void {
  const d = Math.max(0, fin(dt, 0));
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i];
    if (!w) continue;
    w.age += d;
    if (w.age >= POND_WAVE_LIFE) list.splice(i, 1);
  }
}

/** Pure: radius of the lead crest at an age, the same front the sim pushes with. */
export function pondFrontRadius(age: number): number {
  return Math.max(0, fin(age, 0)) * POND_WAVE_SPEED;
}

/** Pure: distance of crest k (0 lead) behind the lead crest. */
export function pondCrestOffset(k: number): number {
  return k <= 0 ? 0 : POND_WAVE_WIDTH + (k - 0.25) * POND_WAVELENGTH;
}

/** Pure: radius of crest k (0 lead) at an age, or a negative value before it has formed. */
export function pondCrestRadius(age: number, k: number): number {
  return pondFrontRadius(age) - pondCrestOffset(k);
}

/** Pure: amplitude share left at an age: a short attack, then 1 - u squared to 0 at the life. */
export function pondFade(age: number): number {
  const a = fin(age, 0);
  if (!(a > 0) || a >= POND_WAVE_LIFE) return 0;
  const u = a / POND_WAVE_LIFE;
  const attack = a < POND_ATTACK_SEC ? a / POND_ATTACK_SEC : 1;
  return attack * (1 - u * u);
}

/** Pure: peak displacement of a wave with this strength, before fading, arena units. */
export function pondAmp(strength: number): number {
  return POND_AMP_MIN + (POND_AMP_MAX - POND_AMP_MIN) * clampStrength(strength);
}

/**
 * Pure: the wave train at signed distance delta from the lead crest (positive ahead). The lead
 * crest is the sim band, cos squared over plus or minus POND_WAVE_WIDTH (1 on the front, 0 at the
 * band edges). Behind the band a trough pulls the floor back in, then two trailing crests one
 * POND_WAVELENGTH apart, each POND_TRAIL_DECAY of the one ahead. Zero outside the reach; the
 * value is continuous everywhere.
 */
export function pondProfile(delta: number): number {
  if (!(delta < AHEAD) || !(delta > -BEHIND)) return 0;
  if (delta > -POND_WAVE_WIDTH) {
    const c = Math.cos((Math.PI / 2) * (delta / POND_WAVE_WIDTH));
    return c * c;
  }
  const t = (-delta - POND_WAVE_WIDTH) / POND_WAVELENGTH;
  return -Math.pow(POND_TRAIL_DECAY, t + 0.25) * Math.sin(2 * Math.PI * t);
}

/** Pure: outer and inner radius of the band a wave touches at an age. */
export function pondReach(age: number): { inner: number; outer: number } {
  const f = pondFrontRadius(age);
  return { inner: Math.max(0, f - BEHIND), outer: f + AHEAD };
}

export interface PondOut {
  x: number;
  y: number;
  /** Lift out of the floor (tilt), arena units. */
  z: number;
  /** Crest height summed over the waves (before the lift multiple), arena units. Drives the glow. */
  h: number;
}

/** Pure: an x offset wrapped into [-period / 2, period / 2) when period is positive (drum seam). */
export function wrapDelta(dx: number, period: number): number {
  if (!(period > 0)) return dx;
  const half = period / 2;
  if (dx >= -half && dx < half) return dx;
  return dx - period * Math.floor((dx + half) / period);
}

/**
 * Pure: displacement of one point by every live wave, written into out (radial, lift and crest
 * height). wrap is the drum width on cylinder levels (0 elsewhere): the shorter way round counts.
 */
export function pondDisplace(px: number, py: number, list: readonly PondWave[], out: PondOut, wrap: number = 0): void {
  let dx = 0;
  let dy = 0;
  let dh = 0;
  for (const w of list) {
    const fade = pondFade(w.age);
    if (fade <= 0) continue;
    const ox = wrapDelta(px - w.x, wrap);
    const oy = py - w.y;
    const d2 = ox * ox + oy * oy;
    const front = pondFrontRadius(w.age);
    const outer = front + AHEAD;
    if (d2 >= outer * outer) continue;
    const inner = front - BEHIND;
    if (inner > 0 && d2 <= inner * inner) continue;
    const d = Math.sqrt(d2);
    const h = pondAmp(w.strength) * fade * pondProfile(d - front);
    dh += h;
    if (d < 1e-3) continue;
    const m = h / d;
    dx += ox * m;
    dy += oy * m;
  }
  out.x = dx;
  out.y = dy;
  out.z = dh * POND_LIFT_MUL;
  out.h = dh;
}

/** Pure: how far a lattice line burns toward white at a crest height, 0 to 1 (troughs stay dark). */
export function pondGlow(h: number): number {
  if (!(h > 0)) return 0;
  const g = h / POND_GLOW_REF;
  return g > 1 ? 1 : g;
}

const scratch: PondOut = { x: 0, y: 0, z: 0, h: 0 };

/**
 * Add the wave displacement to node positions in place (x, y pairs) for the first `free` nodes,
 * the rest positions read from restX and restY. When lift is given, add the lift too; when glow
 * is given, write each node's pondGlow (0 to 1) into it. Pinned wall ends (index free and above)
 * never move. wrap is the drum width on cylinder levels. Allocates nothing.
 */
export function addPondToNodes(
  pos: Float32Array,
  restX: Float32Array,
  restY: Float32Array,
  free: number,
  list: readonly PondWave[],
  lift: Float32Array | null,
  glow: Float32Array | null = null,
  wrap: number = 0,
): void {
  if (list.length === 0) return;
  const n = Math.min(free, pos.length >> 1, restX.length, restY.length);
  for (let i = 0; i < n; i++) {
    pondDisplace(restX[i] ?? 0, restY[i] ?? 0, list, scratch, wrap);
    pos[2 * i] = (pos[2 * i] ?? 0) + scratch.x;
    pos[2 * i + 1] = (pos[2 * i + 1] ?? 0) + scratch.y;
    if (lift && i < lift.length) lift[i] = (lift[i] ?? 0) + scratch.z;
    if (glow && i < glow.length) glow[i] = pondGlow(scratch.h);
  }
}

/** Pure: crest k's height share right now (0 to 1): fade, trail decay and strength over the max. */
export function crestLevel(w: Readonly<PondWave>, k: number): number {
  if (pondCrestRadius(w.age, k) <= 0) return 0;
  return (pondFade(w.age) * Math.pow(POND_TRAIL_DECAY, k) * pondAmp(w.strength)) / POND_AMP_MAX;
}

/** Pure: crest outline alpha for crest k of a wave, so the rings read on every tier and tilt. */
export function crestAlpha(w: Readonly<PondWave>, k: number): number {
  const l = crestLevel(w, k);
  return l > 0 ? 0.25 + 0.65 * l : 0;
}

/** Pure: how far crest k's outline is lifted toward white (0 grid colour, 1 white). */
export function crestWhite(w: Readonly<PondWave>, k: number): number {
  const l = crestLevel(w, k);
  return l > 0 ? 0.35 + 0.65 * l : 0;
}

/** Dev only: seconds between hand fired pond drops with ?dev=1&pond=1 (main.ts strips it otherwise). */
export const DEV_POND_PERIOD = 4.5;

/** Pure: the ?pond=1 dev knob. True only for pond=1 exactly. */
export function parsePondKnob(search: string): boolean {
  return new URLSearchParams(search).get('pond') === '1';
}

/** Pure: the n-th dev drop point in a w x h arena centred on the origin, cycling 4 spots, always strength 1. */
export function devPondDrop(n: number, w: number, h: number): { x: number; y: number; strength: number } {
  const k = ((Math.floor(fin(n, 0)) % 4) + 4) % 4;
  const fx = [0, -0.25, 0.25, 0.1][k] ?? 0;
  const fy = [0, -0.2, 0.15, 0.25][k] ?? 0;
  return { x: fx * w, y: fy * h, strength: 1 };
}
