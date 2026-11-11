// Warden fury (glow-warden-fury, Ryan 2026-11-11). When the Warden's shield bar empties the sim
// reports fury 1 (a 4.5 s invincible break) then fury 2 (enraged), with furyT the seconds into the
// stage, and a dash charge aim (dashAim seconds left, -1 when not aiming, along dashHeading).
// Break: the drawn body shakes (sines of furyT, never the PRNG), flashes between its blue and
// white faster and faster while its colour crosses to hot red, and corner spikes grow out of the
// shell. Enraged: hot red, spikes at full length, a slow 1 Hz pulse. The aim is a thin red dashed
// line from the Warden to the arena edge, blinking. Every colour comes from the palette (already
// through applyNeon). Pure maths, no pixi, no PRNG, no allocation.
import type { ArenaDef } from '../levelgen/leveldef';
import type { ShapeLayer, ShapeSpec } from './shapeSpecs';
import { mixRgb } from './mapFx';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Break length in seconds (the sim's invincible break). */
export const FURY_BREAK_SEC = 4.5;
/** Shake amplitude in arena units, and its two incommensurate rates (rad/s). */
export const FURY_SHAKE_U = 4;
export const FURY_SHAKE_WX = 53;
export const FURY_SHAKE_WY = 41;
/** Blue and white flash rate at the start and at the end of the break (Hz). */
export const FURY_FLASH_HZ0 = 2;
export const FURY_FLASH_HZ1 = 11;
/** Share of white mixed in on a flash. */
export const FURY_FLASH_WHITE = 0.8;
/** Share the palette red is lifted toward white: hot, not dark (as enrage.ts). */
export const FURY_HOT_LIFT = 0.12;
/** Enraged pulse rate (Hz) and its alpha range. */
export const FURY_PULSE_HZ = 1;
export const FURY_PULSE_MIN = 0.6;
/** Spikes: count (one per hexagon corner), base and full tip radius (x body radius), half base angle. */
export const FURY_SPIKES = 6;
export const FURY_SPIKE_BASE = 0.86;
export const FURY_SPIKE_TIP = 1.5;
export const FURY_SPIKE_HALF = 0.2;
/** Glow multiplier while enraged, and the extra at a break flash. */
export const FURY_GLOW = 1.35;
export const FURY_FLASH_GLOW = 0.5;
/** Dash aim: dash and gap length (arena units), blink rate (Hz), line width and alpha. */
export const AIM_DASH_U = 26;
export const AIM_GAP_U = 18;
export const AIM_BLINK_HZ = 6;
export const AIM_WIDTH = 3;
export const AIM_ALPHA = 0.85;
/** Longest aim line on a cylinder, where u wraps (x arena width): never meets itself. */
export const AIM_WRAP_SHARE = 0.5;

/** Pure: the fury stage as 0, 1 or 2 from an optional view field. */
export function furyStage(fury: number | undefined): 0 | 1 | 2 {
  return fury === 1 ? 1 : fury === 2 ? 2 : 0;
}

/** Pure: progress 0 to 1 through the break (1 once enraged, 0 with no fury). */
export function furyProgress(stage: number, furyT: number): number {
  if (stage === 2) return 1;
  if (stage !== 1) return 0;
  return clamp01(fin(furyT, 0) / FURY_BREAK_SEC);
}

/** Pure: the body shake offset at furyT into out (break only, else 0). About FURY_SHAKE_U. */
export function furyShake(stage: number, furyT: number, out: { x: number; y: number }): { x: number; y: number } {
  if (stage !== 1) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const t = fin(furyT, 0);
  out.x = FURY_SHAKE_U * Math.sin(t * FURY_SHAKE_WX);
  out.y = FURY_SHAKE_U * Math.sin(t * FURY_SHAKE_WY + 1.3);
  return out;
}

/** Pure: the red share 0 to 1 of the body colour (smoothstep over the break, 1 enraged). */
export function furyRedMix(stage: number, furyT: number): number {
  const p = furyProgress(stage, furyT);
  return p * p * (3 - 2 * p);
}

/** Pure: 1 while the break flash is on white, 0 otherwise. The rate climbs FURY_FLASH_HZ0 to HZ1. */
export function furyFlash(stage: number, furyT: number): number {
  if (stage !== 1) return 0;
  const t = Math.max(0, Math.min(FURY_BREAK_SEC, fin(furyT, 0)));
  const cycles = FURY_FLASH_HZ0 * t + ((FURY_FLASH_HZ1 - FURY_FLASH_HZ0) * t * t) / (2 * FURY_BREAK_SEC);
  return cycles - Math.floor(cycles) < 0.5 ? 1 : 0;
}

/** Pure: hot red from the palette red. */
export function furyHotRed(red: number): number {
  return mixRgb(red, 0xffffff, FURY_HOT_LIFT);
}

/** Pure: the body tint: blue crossing to hot red, flashing white during the break. */
export function furyTint(stage: number, furyT: number, blue: number, red: number): number {
  const base = mixRgb(blue, furyHotRed(red), furyRedMix(stage, furyT));
  return furyFlash(stage, furyT) === 1 ? mixRgb(base, 0xffffff, FURY_FLASH_WHITE) : base;
}

/** Pure: spike length share 0 to 1 (ease out over the break, full enraged). */
export function furySpikeLen(stage: number, furyT: number): number {
  const p = furyProgress(stage, furyT);
  return 1 - (1 - p) * (1 - p);
}

/** Pure: body alpha multiplier: the enraged slow pulse FURY_PULSE_MIN to 1, else 1. */
export function furyPulseAlpha(stage: number, furyT: number): number {
  if (stage !== 2) return 1;
  const c = Math.cos(2 * Math.PI * FURY_PULSE_HZ * fin(furyT, 0));
  return FURY_PULSE_MIN + (1 - FURY_PULSE_MIN) * (0.5 + 0.5 * c);
}

/** Pure: body glow multiplier for the stage (brighter on a flash, hot while enraged). */
export function furyGlowMul(stage: number, furyT: number): number {
  if (stage === 2) return FURY_GLOW;
  if (stage === 1) return 1 + (FURY_GLOW - 1) * furyRedMix(stage, furyT) + FURY_FLASH_GLOW * furyFlash(stage, furyT);
  return 1;
}

/**
 * Pure: spike k as a triangle about the origin into out[0..5] (base left, tip, base right), body
 * radius R, rotation rot, length share len. The spikes sit on the hexagon corners between plates.
 */
export function furySpike(k: number, rot: number, R: number, len: number, out: Float32Array): Float32Array {
  const a = rot + (k * Math.PI * 2) / FURY_SPIKES;
  const rb = FURY_SPIKE_BASE * R;
  const rt = rb + (FURY_SPIKE_TIP * R - rb) * clamp01(fin(len, 0));
  out[0] = Math.cos(a - FURY_SPIKE_HALF) * rb;
  out[1] = Math.sin(a - FURY_SPIKE_HALF) * rb;
  out[2] = Math.cos(a) * rt;
  out[3] = Math.sin(a) * rt;
  out[4] = Math.cos(a + FURY_SPIKE_HALF) * rb;
  out[5] = Math.sin(a + FURY_SPIKE_HALF) * rb;
  return out;
}

/**
 * Pure: the spec with every baked colour turned to white (null), so the view tint colours the
 * whole body. Allocates: call only when the cached fury context is rebuilt, never per frame.
 */
export function whiteSpec(spec: ShapeSpec): ShapeSpec {
  const layers: ShapeLayer[] = spec.layers.map((l) => ({ ...l, colour: null }));
  return { tint: null, radius: spec.radius, layers };
}

/** Pure: true while the aim line shows (dashAim seconds left, -1 or absent when not aiming). */
export function aimOn(dashAim: number | undefined): boolean {
  return dashAim !== undefined && Number.isFinite(dashAim) && dashAim >= 0;
}

/** Pure: blink alpha of the aim line at render time t: on and off at AIM_BLINK_HZ. */
export function aimBlink(t: number): number {
  const c = AIM_BLINK_HZ * fin(t, 0);
  return c - Math.floor(c) < 0.6 ? AIM_ALPHA : AIM_ALPHA * 0.25;
}

/** Ray length from inside a box of half extents hw, hh at (x, y) along (dx, dy). */
function rayBox(x: number, y: number, dx: number, dy: number, hw: number, hh: number): number {
  let d = Number.POSITIVE_INFINITY;
  if (dx > 1e-9) d = Math.min(d, (hw - x) / dx);
  else if (dx < -1e-9) d = Math.min(d, (-hw - x) / dx);
  if (dy > 1e-9) d = Math.min(d, (hh - y) / dy);
  else if (dy < -1e-9) d = Math.min(d, (-hh - y) / dy);
  return d;
}

/** Ray length from inside a circle of radius r at (x, y) along the unit (dx, dy). */
function rayCircle(x: number, y: number, dx: number, dy: number, r: number): number {
  const b = x * dx + y * dy;
  const c = x * x + y * y - r * r;
  const disc = b * b - c;
  return disc > 0 ? -b + Math.sqrt(disc) : 0;
}

/**
 * Pure: distance from (x, y) along heading to the arena edge. The arena is centred on the origin;
 * circle and hexagon arenas use the circle of radius width / 2, the rest the bounding box. With
 * wrapU (a cylinder) u never ends, so only the rims at plus or minus height / 2 stop the line,
 * capped at AIM_WRAP_SHARE of the width. Never negative.
 */
export function aimLength(x: number, y: number, heading: number, arena: Pick<ArenaDef, 'shape' | 'width' | 'height'>, wrapU: boolean): number {
  const h = fin(heading, 0);
  const dx = Math.cos(h);
  const dy = Math.sin(h);
  const px = fin(x, 0);
  const py = fin(y, 0);
  let d: number;
  if (wrapU) {
    const cap = AIM_WRAP_SHARE * arena.width;
    const hh = arena.height / 2;
    const dv = dy > 1e-9 ? (hh - py) / dy : dy < -1e-9 ? (-hh - py) / dy : Number.POSITIVE_INFINITY;
    d = Math.min(cap, dv);
  } else if (arena.shape === 'circle' || arena.shape === 'hexagon') {
    d = rayCircle(px, py, dx, dy, arena.width / 2);
  } else {
    d = rayBox(px, py, dx, dy, arena.width / 2, arena.height / 2);
  }
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** Pure: the aim line end point into out (the Warden at x, y along heading to the arena edge). */
export function aimEnd(x: number, y: number, heading: number, arena: Pick<ArenaDef, 'shape' | 'width' | 'height'>, wrapU: boolean, out: { x: number; y: number }): { x: number; y: number } {
  const d = aimLength(x, y, heading, arena, wrapU);
  out.x = fin(x, 0) + Math.cos(fin(heading, 0)) * d;
  out.y = fin(y, 0) + Math.sin(fin(heading, 0)) * d;
  return out;
}
