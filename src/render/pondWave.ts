// Tester 3 pond ripples, render side. Pure state and maths, no pixi.js, no PRNG.
// 'sim:rippleWarn' starts a telegraph at the drop point: a ring that tightens and pulses for
// RIPPLE_WARN_SEC. 'sim:ripple' starts a pond wave: a lead crest whose radius is exactly
// POND_WAVE_SPEED x age (the sim push front) with two trailing crests behind it like water, fading
// to nothing at POND_WAVE_LIFE. The wave is a render time displacement added on top of the grid
// (lattice nodes or the v1 grid trace), never integrated, so the grid is exactly flat after it.
import { POND_WAVE_LIFE, POND_WAVE_SPEED, POND_WAVE_WIDTH, RIPPLE_WARN_SEC } from '../core/pondRipple';

/** Live pond waves at once. A fourth replaces the oldest. */
export const MAX_POND_WAVES = 3;
/** Live telegraphs at once. */
export const MAX_POND_WARNS = 3;
/** Crests per wave: the lead crest plus two trailing ones. */
export const POND_CRESTS = 3;
/** Distance between crests, arena units. Wider than the explosion ripple band. */
export const POND_WAVELENGTH = POND_WAVE_WIDTH * 1.5;
/** Each trailing crest carries this share of the one ahead of it. */
export const POND_TRAIL_DECAY = 0.6;
/** Peak radial displacement at strength 0 and strength 1, arena units. */
export const POND_AMP_MIN = 10;
export const POND_AMP_MAX = 26;
/** Lift out of the floor under tilt, as a multiple of the radial displacement. */
export const POND_LIFT_MUL = 1.2;
/** Seconds the lead crest takes to reach full height, so a wave never pops in. */
export const POND_ATTACK_SEC = 0.12;
/** Telegraph ring radius at the start and at the drop. */
export const WARN_R0 = 150;
export const WARN_R1 = 18;
/** Telegraph pulses per second. */
export const WARN_PULSE_HZ = 4;

/** Waveform reach ahead of the lead crest and behind it, in wavelengths (zero crossings). */
const AHEAD = 0.25;
const BEHIND = POND_CRESTS - 1 + 0.25;

export interface PondWave {
  x: number;
  y: number;
  age: number;
  strength: number;
}

export interface PondWarn {
  x: number;
  y: number;
  age: number;
  life: number;
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

/** Start a pond wave at (x, y). At MAX_POND_WAVES the oldest goes. */
export function addPondWave(list: PondWave[], x: number, y: number, strength: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (list.length >= MAX_POND_WAVES) list.splice(oldest(list), 1);
  list.push({ x, y, age: 0, strength: clampStrength(strength) });
}

/** Start a telegraph at (x, y) lasting inSec (RIPPLE_WARN_SEC when missing). */
export function addPondWarn(list: PondWarn[], x: number, y: number, inSec: number, strength: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (list.length >= MAX_POND_WARNS) list.splice(oldest(list), 1);
  const life = inSec > 0 && Number.isFinite(inSec) ? inSec : RIPPLE_WARN_SEC;
  list.push({ x, y, age: 0, life, strength: clampStrength(strength) });
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

/** Age telegraphs and drop finished ones, in place. */
export function stepPondWarns(list: PondWarn[], dt: number): void {
  const d = Math.max(0, fin(dt, 0));
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i];
    if (!w) continue;
    w.age += d;
    if (w.age >= w.life) list.splice(i, 1);
  }
}

/** Pure: radius of the lead crest at an age, the same front the sim pushes with. */
export function pondFrontRadius(age: number): number {
  return Math.max(0, fin(age, 0)) * POND_WAVE_SPEED;
}

/** Pure: radius of crest k (0 lead) at an age, or a negative value before it has formed. */
export function pondCrestRadius(age: number, k: number): number {
  return pondFrontRadius(age) - k * POND_WAVELENGTH;
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
 * Pure: the wave train at signed distance delta from the lead crest (positive ahead). A cosine
 * of the wavelength under an envelope that is 1 at the lead crest and falls by POND_TRAIL_DECAY
 * per crest behind it, zero outside [-BEHIND, AHEAD] wavelengths (both ends are zero crossings,
 * so the shape is continuous).
 */
export function pondProfile(delta: number): number {
  const x = delta / POND_WAVELENGTH;
  if (!(x > -BEHIND) || !(x < AHEAD)) return 0;
  const env = x >= 0 ? 1 : Math.pow(POND_TRAIL_DECAY, -x);
  return env * Math.cos(2 * Math.PI * x);
}

/** Pure: outer and inner radius of the band a wave touches at an age. */
export function pondReach(age: number): { inner: number; outer: number } {
  const f = pondFrontRadius(age);
  return { inner: Math.max(0, f - BEHIND * POND_WAVELENGTH), outer: f + AHEAD * POND_WAVELENGTH };
}

export interface PondOut {
  x: number;
  y: number;
  /** Lift out of the floor (tilt), arena units. */
  z: number;
}

/** Pure: displacement of one point by every live wave, written into out (radial plus lift). */
export function pondDisplace(px: number, py: number, list: readonly PondWave[], out: PondOut): void {
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (const w of list) {
    const fade = pondFade(w.age);
    if (fade <= 0) continue;
    const ox = px - w.x;
    const oy = py - w.y;
    const d2 = ox * ox + oy * oy;
    const front = pondFrontRadius(w.age);
    const outer = front + AHEAD * POND_WAVELENGTH;
    if (d2 >= outer * outer) continue;
    const inner = front - BEHIND * POND_WAVELENGTH;
    if (inner > 0 && d2 <= inner * inner) continue;
    const d = Math.sqrt(d2);
    const h = pondAmp(w.strength) * fade * pondProfile(d - front);
    dz += h * POND_LIFT_MUL;
    if (d < 1e-3) continue;
    const m = h / d;
    dx += ox * m;
    dy += oy * m;
  }
  out.x = dx;
  out.y = dy;
  out.z = dz;
}

const scratch: PondOut = { x: 0, y: 0, z: 0 };

/**
 * Add the wave displacement to node positions in place (x, y pairs) for the first `free` nodes,
 * the rest positions read from restX and restY. When lift is given, add the lift too. Pinned
 * wall ends (index free and above) never move. Allocates nothing.
 */
export function addPondToNodes(
  pos: Float32Array,
  restX: Float32Array,
  restY: Float32Array,
  free: number,
  list: readonly PondWave[],
  lift: Float32Array | null,
): void {
  if (list.length === 0) return;
  const n = Math.min(free, pos.length >> 1, restX.length, restY.length);
  for (let i = 0; i < n; i++) {
    pondDisplace(restX[i] ?? 0, restY[i] ?? 0, list, scratch);
    pos[2 * i] = (pos[2 * i] ?? 0) + scratch.x;
    pos[2 * i + 1] = (pos[2 * i + 1] ?? 0) + scratch.y;
    if (lift && i < lift.length) lift[i] = (lift[i] ?? 0) + scratch.z;
  }
}

/** Pure: telegraph progress 0 to 1 over its life. */
export function warnProgress(w: Readonly<PondWarn>): number {
  if (!(w.life > 0)) return 1;
  const p = w.age / w.life;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** Pure: telegraph ring radius, tightening from WARN_R0 to WARN_R1 with an ease in. */
export function warnRadius(p: number): number {
  const t = p < 0 ? 0 : p > 1 ? 1 : p;
  return WARN_R0 + (WARN_R1 - WARN_R0) * t * t;
}

/** Pure: telegraph alpha, a pulse that quickens and brightens toward the drop. 0 to 1. */
export function warnAlpha(w: Readonly<PondWarn>): number {
  const p = warnProgress(w);
  const pulse = 0.5 + 0.5 * Math.cos(2 * Math.PI * WARN_PULSE_HZ * w.age * (1 + p));
  return (0.35 + 0.35 * p) * (0.55 + 0.45 * pulse) * (0.6 + 0.4 * w.strength);
}

/** Pure: crest outline alpha for crest k of a wave, so the rings read on every tier and tilt. */
export function crestAlpha(w: Readonly<PondWave>, k: number): number {
  if (pondCrestRadius(w.age, k) <= 0) return 0;
  return 0.5 * pondFade(w.age) * Math.pow(POND_TRAIL_DECAY, k) * (0.6 + 0.4 * w.strength);
}

/** Dev only: seconds between hand fired pond drops with ?dev=1&pond=1 (main.ts strips it otherwise). */
export const DEV_POND_PERIOD = 4.5;

/** Pure: the ?pond=1 dev knob. True only for pond=1 exactly. */
export function parsePondKnob(search: string): boolean {
  return new URLSearchParams(search).get('pond') === '1';
}

/** Pure: the n-th dev drop point and strength in a w x h arena centred on the origin, cycling 4 spots. */
export function devPondDrop(n: number, w: number, h: number): { x: number; y: number; strength: number } {
  const k = ((Math.floor(fin(n, 0)) % 4) + 4) % 4;
  const fx = [0, -0.25, 0.25, 0.1][k] ?? 0;
  const fy = [0, -0.2, 0.15, 0.25][k] ?? 0;
  const s = [1, 0.5, 0.8, 0.2][k] ?? 1;
  return { x: fx * w, y: fy * h, strength: s };
}
