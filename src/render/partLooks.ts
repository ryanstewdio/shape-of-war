// Look v33 (GW1): the look registry of every boss part type and pickup kind, and the drone mode
// looks. Pure, no pixi.js import. Each entry names the spec index the part draws with (bossShapes.ts
// PART_SPEC_TYPES), whether its colours are baked (view tint white) or take the boss tint, and its
// motion (the Hornet buzz). Pickups name their spin; drone modes their colour key and glyph.
import type { DroneMode } from '../core/events';
import {
  PART_ANCHOR,
  PART_BROODLING,
  PART_GRAVITANT,
  PART_HORNET,
  PART_MIRROR,
  PART_POD,
  PART_TURRET,
  PART_TWIN,
  partSpecIndex,
} from './bossShapes';
import { mixRgb } from './mapFx';
import type { PaletteKey } from './neon';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

export type PartTint = 'boss' | 'accent' | 'baked';

export interface PartLook {
  readonly name: string;
  /** Spec index in PART_SPEC_TYPES, or -1 for the twin body (it draws as the Twins boss body). */
  readonly spec: number;
  /** boss: the boss tint; accent: the boss part accent (bossPartTint); baked: white, colours in the spec. */
  readonly tint: PartTint;
  /** Buzz jitter amplitude in u (0 for none). */
  readonly jitter: number;
}

/** One entry per sim PartType value (src/game/bosses/types.ts), indexed by the value. */
export const PART_LOOKS: readonly PartLook[] = [
  { name: 'pod', spec: partSpecIndex(PART_POD), tint: 'accent', jitter: 0 },
  { name: 'anchor', spec: partSpecIndex(PART_ANCHOR), tint: 'accent', jitter: 0 },
  { name: 'turret', spec: partSpecIndex(PART_TURRET), tint: 'accent', jitter: 0 },
  { name: 'twin', spec: -1, tint: 'boss', jitter: 0 },
  { name: 'broodling', spec: partSpecIndex(PART_BROODLING), tint: 'baked', jitter: 0 },
  { name: 'hornet', spec: partSpecIndex(PART_HORNET), tint: 'baked', jitter: 1.6 },
  { name: 'gravitant', spec: partSpecIndex(PART_GRAVITANT), tint: 'baked', jitter: 0 },
  { name: 'mirror', spec: partSpecIndex(PART_MIRROR), tint: 'baked', jitter: 0 },
];

/** Pure: the look of a part type (w.a); unknown values look like a pod. */
export function partLook(a: number): PartLook {
  return (Number.isInteger(a) && a >= 0 ? PART_LOOKS[a] : undefined) ?? (PART_LOOKS[PART_POD] as PartLook);
}

/** Pure: true for the twin body part type. */
export function isTwinLook(a: number): boolean {
  return a === PART_TWIN;
}

/** Hornet buzz: frequencies (Hz) of the two jitter axes. */
export const BUZZ_HZ: readonly [number, number] = [23, 29];

/**
 * Pure: the buzz offset of a part (w.a) at timeSec for its hash h (0 to 1), written into out. Two
 * fast incommensurate sines per axis, so the dart quivers like a wasp. 0 for parts without a buzz.
 */
export function partJitter(a: number, timeSec: number, h: number, out: { x: number; y: number }): { x: number; y: number } {
  const amp = partLook(a).jitter;
  if (amp <= 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const t = fin(timeSec, 0);
  const p = fin(h, 0) * 17;
  out.x = amp * (0.7 * Math.sin(t * BUZZ_HZ[0] * Math.PI * 2 + p) + 0.3 * Math.sin(t * 61 + p * 3));
  out.y = amp * (0.7 * Math.sin(t * BUZZ_HZ[1] * Math.PI * 2 + p * 2) + 0.3 * Math.sin(t * 53 + p * 5));
  return out;
}

// Pickups

export type PickupName = 'weapon' | 'drone';

export interface PickupLook {
  readonly name: PickupName;
  /** Spin, rad/s (the render clock). */
  readonly spin: number;
  /** Spin direction: the drone ring turns the other way to the weapon pickups. */
  readonly dir: 1 | -1;
}

/** Weapon pickups spin at PICKUP_SPIN in the renderer; the drone pickup ring turns the other way. */
export const PICKUP_LOOKS: Readonly<Record<PickupName, PickupLook>> = {
  weapon: { name: 'weapon', spin: 1.2, dir: 1 },
  drone: { name: 'drone', spin: 1.8, dir: -1 },
};

/** Pure: the drone pickup ring angle at timeSec for its hash h. */
export function dronePickupRot(timeSec: number, h: number): number {
  const l = PICKUP_LOOKS.drone;
  return l.dir * l.spin * fin(timeSec, 0) + fin(h, 0) * Math.PI * 2;
}

// Drone modes

export type DroneGlyph = 'H' | 'D' | 'R' | 'dots';

export interface DroneModeLook {
  /** Colour of the glyph and the ship ring. */
  readonly key: PaletteKey;
  readonly glyph: DroneGlyph;
}

export const DRONE_MODE_LOOKS: Readonly<Record<DroneMode, DroneModeLook>> = {
  homing: { key: 'homing', glyph: 'H' },
  detach: { key: 'orange', glyph: 'D' },
  rapid: { key: 'rapid', glyph: 'R' },
  double: { key: 'cyan', glyph: 'dots' },
};

/** Glyph box half height (u), its gap above the drone centre, and the ship ring radius (u). */
export const GLYPH_HALF = 4;
export const GLYPH_LIFT = 17;
export const MODE_RING_R = 22;

/**
 * Pure: the stroke segments of a glyph in a box of half height s centred on the origin, as flat
 * (x0, y0, x1, y1) quadruples. Letters are built from straight strokes (no fonts). The doubled dot
 * glyph returns no strokes: see glyphDots.
 */
export function glyphSegments(g: DroneGlyph, s: number): number[] {
  const w = s * 0.75;
  if (g === 'H') return [-w, -s, -w, s, w, -s, w, s, -w, 0, w, 0];
  if (g === 'D') return [-w, -s, -w, s, -w, -s, w * 0.4, -s, w * 0.4, -s, w, -s * 0.45, w, -s * 0.45, w, s * 0.45, w, s * 0.45, w * 0.4, s, w * 0.4, s, -w, s];
  if (g === 'R') return [-w, -s, -w, s, -w, -s, w, -s, w, -s, w, 0, w, 0, -w, 0, -w * 0.1, 0, w, s];
  return [];
}

/** Pure: the doubled dot glyph's dot centres (x, y pairs) and radius for half height s. */
export function glyphDots(s: number): { pts: readonly number[]; r: number } {
  return { pts: [-s * 0.6, 0, s * 0.6, 0], r: s * 0.42 };
}

/** Detach decoy pulse rate (Hz). */
export const DECOY_HZ = 3;

/** Pure: the detach decoy pulse 0 to 1 at timeSec. */
export function decoyPulse(timeSec: number): number {
  return 0.5 + 0.5 * Math.sin(fin(timeSec, 0) * DECOY_HZ * Math.PI * 2);
}

/** Pure: the decoy tint: red mixed toward orange by the pulse, so it reads red orange and alive. */
export function decoyTint(red: number, orange: number, timeSec: number): number {
  return mixRgb(red, orange, decoyPulse(timeSec));
}
