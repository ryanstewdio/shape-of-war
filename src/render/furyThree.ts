// Fury three looks (glow-fury-three, Ryan 2026-11-11): Brood, Mirage and Gravitas. Swarm writes the
// view fields (fury, furyT, frenzy, tide, tideFlipIn); an absent field reads as off.
// Brood: no body fury. The Broodlings flash white once at the split and, once view.frenzy is true,
// burn hot green with red cores and a quick pulse.
// Mirage: the break shatters its mirror ring inward and flickers the body magenta to white; enraged it
// carries a flickering double image a few units off the body and a white hot edge.
// Gravitas: the break snaps the lattice inward and collapses the body to a point that swells back over
// the break; enraged it is violet with a spinning white ring, a ring flashes on the body before each
// tide flip and the pull ripples run outward while it pushes. After the split the ring, the tide flash
// and the ripples ride both halves.
// Colours come from the palette (already through applyNeon). Pure maths, no pixi, no PRNG. Only the
// spec builders allocate, and they run when a cached context is rebuilt, never per frame.
import type { ShapeLayer, ShapeSpec } from './shapeSpecs';
import type { EffectsTier } from './effects';
import { FURY_BREAK_SEC, FURY_FLASH_WHITE, furyFlash, furyProgress } from './wardenFury';
import { mixRgb } from './mapFx';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(v: number): number {
  const s = clamp01(v);
  return s * s * (3 - 2 * s);
}

// View fields ------------------------------------------------------------------------------------

/** Pure: true only when the view says the Broodlings are enraged (absent reads as off). */
export function frenzyOn(frenzy: boolean | undefined): boolean {
  return frenzy === true;
}

/** Pure: the tide as 1 pull, -1 push or 0 off from an optional view field. */
export function tideOf(tide: number | undefined): -1 | 0 | 1 {
  return tide === 1 ? 1 : tide === -1 ? -1 : 0;
}

/** Pure: seconds to the next tide flip, -1 when none (absent, negative or not finite). */
export function flipInOf(v: number | undefined): number {
  return v !== undefined && Number.isFinite(v) && v >= 0 ? v : -1;
}

// Brood ------------------------------------------------------------------------------------------

/** Length of the one white flash of the Broodlings at the split (s). */
export const BROOD_SPLIT_FLASH_SEC = 0.22;
/** Frenzy pulse rate (Hz), scale swing and glow range. */
export const FRENZY_PULSE_HZ = 4;
export const FRENZY_SCALE = 0.1;
export const FRENZY_GLOW0 = 1.3;
export const FRENZY_GLOW1 = 0.7;
/** Width share of the white hot inner line of the frenzied Broodling outline. */
export const FRENZY_HOT_LINE = 0.45;

/** Pure: true while the split flash shows (age seconds since the split). */
export function broodSplitFlash(age: number): boolean {
  return age >= 0 && age < BROOD_SPLIT_FLASH_SEC;
}

/** Pure: 0 to 1 frenzy pulse at timeSec, phase offset by seed (0 to 1) so the three do not beat as one. */
export function frenzyPulse(timeSec: number, seed: number): number {
  const c = Math.cos(2 * Math.PI * (FRENZY_PULSE_HZ * fin(timeSec, 0) + fin(seed, 0)));
  return 0.5 + 0.5 * c;
}

/** Pure: scale multiplier of a frenzied Broodling at pulse p. */
export function frenzyScale(p: number): number {
  return 1 + FRENZY_SCALE * clamp01(fin(p, 0));
}

/** Pure: glow multiplier of a frenzied Broodling at pulse p. */
export function frenzyGlow(p: number): number {
  return FRENZY_GLOW0 + FRENZY_GLOW1 * clamp01(fin(p, 0));
}

/**
 * Pure: the frenzied Broodling spec from the normal one (broodlingSpec): the pod (the yellow layer)
 * turns red and solid, the body and nose fill harder in the green, and the body outline gets a thin
 * white hot inner line, so it reads hot green with a red core. Allocates: cache build only.
 */
export function frenzySpec(spec: ShapeSpec): ShapeSpec {
  const layers: ShapeLayer[] = [];
  let first: ShapeLayer | null = null;
  for (const l of spec.layers) {
    if (l.colour === 'yellow') {
      layers.push({ ...l, colour: 'red', fill: Math.max(0.95, l.fill), glow: true });
      continue;
    }
    if (first === null) first = l;
    layers.push({ ...l, fill: Math.min(0.6, Math.max(0.32, l.fill * 1.6)) });
  }
  if (first !== null) layers.push({ ...first, colour: 'white', fill: 0, glow: false, width: first.width * FRENZY_HOT_LINE });
  return { tint: spec.tint, radius: spec.radius, layers };
}

// Mirage -----------------------------------------------------------------------------------------

/** Share of white the break mixes into the magenta as it goes (on top of the flicker). */
export const MIRAGE_BREAK_WHITE = 0.3;
/** Enraged body: the magenta lifted this far toward white. */
export const MIRAGE_HOT_LIFT = 0.15;
/** Inward shatter: shard counts per tier, speeds (u/s) and life (s). */
export const MIRAGE_SHARDS: Readonly<Record<EffectsTier, number>> = { low: 10, standard: 24, high: 36 };
export const MIRAGE_SHARD_SPEED: readonly [number, number] = [140, 260];
export const MIRAGE_SHARD_LIFE: readonly [number, number] = [0.35, 0.6];
/** Shards per live mirror image on top of the ring (low, else). */
export const MIRROR_SHARDS_LOW = 4;
export const MIRROR_SHARDS = 10;
/** Double image: offset (arena units) and its swing, flicker alpha range. */
export const ECHO_U = 7;
export const ECHO_SWING = 0.35;
export const ECHO_ALPHA: readonly [number, number] = [0.22, 0.6];
/** White hot edge: width multiplier of the boss line and alpha. */
export const MIRAGE_EDGE_WIDTH = 0.9;
export const MIRAGE_EDGE_ALPHA = 0.85;

/** Pure: Mirage's body tint in fury: magenta flickering to white over the break, hot magenta enraged. */
export function mirageFuryTint(stage: number, furyT: number, magenta: number): number {
  if (stage === 2) return mixRgb(magenta, 0xffffff, MIRAGE_HOT_LIFT);
  if (stage !== 1) return magenta;
  const base = mixRgb(magenta, 0xffffff, MIRAGE_BREAK_WHITE * furyProgress(stage, furyT));
  return furyFlash(stage, furyT) === 1 ? mixRgb(base, 0xffffff, FURY_FLASH_WHITE) : base;
}

/** Pure: shard count of the inward shatter for the effects tier, plus the live mirror images. */
export function mirageShardCount(t: EffectsTier, mirrors: number): number {
  const m = Math.max(0, Math.min(2, Math.floor(fin(mirrors, 0))));
  return MIRAGE_SHARDS[t] + m * (t === 'low' ? MIRROR_SHARDS_LOW : MIRROR_SHARDS);
}

/** Pure: the double image offset at timeSec into out: about ECHO_U units, wandering, never the PRNG. */
export function mirageEchoOffset(timeSec: number, out: { x: number; y: number }): { x: number; y: number } {
  const t = fin(timeSec, 0);
  const a = t * 2.3 + 1.2 * Math.sin(t * 7.1);
  const r = ECHO_U * (1 - ECHO_SWING + ECHO_SWING * (0.5 + 0.5 * Math.sin(t * 13.7)));
  out.x = Math.cos(a) * r;
  out.y = Math.sin(a) * r;
  return out;
}

/** Pure: the double image alpha at timeSec: a quick uneven flicker within ECHO_ALPHA. */
export function mirageEchoAlpha(timeSec: number): number {
  const t = fin(timeSec, 0);
  const f = 0.5 + 0.3 * Math.sin(t * 31) + 0.2 * Math.sin(t * 53 + 1.7);
  return ECHO_ALPHA[0] + (ECHO_ALPHA[1] - ECHO_ALPHA[0]) * clamp01(f);
}

/** Pure: true while Mirage draws the double image and white edge (enraged). */
export function mirageEchoOn(stage: number): boolean {
  return stage === 2;
}

// Gravitas ---------------------------------------------------------------------------------------

/** Break collapse: seconds to fall to a point, seconds held there, the point's scale. */
export const GRAV_COLLAPSE_SEC = 0.3;
export const GRAV_HOLD_SEC = 0.25;
export const GRAV_POINT = 0.06;
/** Extra glow at the point (the collapsed body burns bright). */
export const GRAV_POINT_GLOW = 1.6;
/** Lattice snap: seconds of the inward kick and its strength as a multiple of the pull. */
export const GRAV_SNAP_SEC = 0.4;
export const GRAV_SNAP_MUL = 4;
/** Enraged: violet lifted this far toward white. */
export const GRAV_HOT_LIFT = 0.1;
/** Spinning white ring: radius share of the body, turns per second, arcs, arc span, width, alpha. */
export const GRAV_RING_R = 1.25;
export const GRAV_RING_HZ = 0.6;
export const GRAV_RING_ARCS = 3;
export const GRAV_RING_ARCS_LOW = 2;
export const GRAV_RING_SPAN = (80 * Math.PI) / 180;
export const GRAV_RING_WIDTH = 1.4;
export const GRAV_RING_ALPHA = 0.9;
/** Tide warning: seconds before a flip, blink rate at the start and at the flip (Hz), ring radius share. */
export const TIDE_WARN_SEC = 0.8;
export const TIDE_BLINK_HZ0 = 4;
export const TIDE_BLINK_HZ1 = 12;
export const TIDE_RING_R = 1.05;

/** Pure: the body scale multiplier over the break: falls to a point, holds, swells back by its end. */
export function gravitasCollapseScale(stage: number, furyT: number): number {
  if (stage !== 1) return 1;
  const t = Math.max(0, fin(furyT, 0));
  if (t < GRAV_COLLAPSE_SEC) {
    const p = t / GRAV_COLLAPSE_SEC;
    return 1 - (1 - GRAV_POINT) * p * p;
  }
  const s = t - GRAV_COLLAPSE_SEC - GRAV_HOLD_SEC;
  if (s <= 0) return GRAV_POINT;
  const span = Math.max(1e-6, FURY_BREAK_SEC - GRAV_COLLAPSE_SEC - GRAV_HOLD_SEC);
  return GRAV_POINT + (1 - GRAV_POINT) * smooth(s / span);
}

/** Pure: glow multiplier of the collapsing body: brightest at the point. */
export function gravitasCollapseGlow(scale: number): number {
  const s = clamp01(fin(scale, 1));
  return 1 + GRAV_POINT_GLOW * (1 - s);
}

/**
 * Pure: the extra lattice acceleration of the break snap (negative pulls in), from pull (the normal
 * pull, negative): GRAV_SNAP_MUL times it at the break start, fading to 0 by GRAV_SNAP_SEC.
 */
export function gravitasSnapAccel(stage: number, furyT: number, pull: number): number {
  if (stage !== 1) return 0;
  const t = Math.max(0, fin(furyT, 0));
  if (t >= GRAV_SNAP_SEC) return 0;
  const p = -Math.abs(fin(pull, 0));
  return p * GRAV_SNAP_MUL * (1 - t / GRAV_SNAP_SEC);
}

/** Pure: Gravitas's body tint in fury: violet flashing white over the break, hot violet enraged. */
export function gravitasFuryTint(stage: number, furyT: number, violet: number): number {
  if (stage === 2) return mixRgb(violet, 0xffffff, GRAV_HOT_LIFT);
  if (stage !== 1) return violet;
  return furyFlash(stage, furyT) === 1 ? mixRgb(violet, 0xffffff, FURY_FLASH_WHITE) : violet;
}

/** Pure: true while the spinning white ring shows (enraged). */
export function gravitasRingOn(stage: number): boolean {
  return stage === 2;
}

/** Pure: the ring's turn angle at timeSec (radians). */
export function gravitasRingAngle(timeSec: number): number {
  return 2 * Math.PI * GRAV_RING_HZ * fin(timeSec, 0);
}

/** Pure: arcs of the spinning ring for the tier (fewer on Low). */
export function gravitasRingArcs(t: EffectsTier): number {
  return t === 'low' ? GRAV_RING_ARCS_LOW : GRAV_RING_ARCS;
}

/** Pure: start angle of arc k of n at turn angle a (arcs spaced evenly, centred on their slot). */
export function gravitasArcStart(a: number, k: number, n: number): number {
  const m = Math.max(1, Math.floor(fin(n, 1)));
  return fin(a, 0) + (k * 2 * Math.PI) / m - GRAV_RING_SPAN / 2;
}

/**
 * Pure: the tide warning ring alpha 0 to 1 from tideFlipIn (seconds to the flip): off outside the
 * last TIDE_WARN_SEC, there a blink that quickens from TIDE_BLINK_HZ0 to HZ1 into the flip.
 */
export function tideFlash(flipIn: number): number {
  const f = fin(flipIn, -1);
  if (!(f >= 0) || f > TIDE_WARN_SEC) return 0;
  const e = TIDE_WARN_SEC - f; // seconds into the warning
  const cycles = TIDE_BLINK_HZ0 * e + ((TIDE_BLINK_HZ1 - TIDE_BLINK_HZ0) * e * e) / (2 * TIDE_WARN_SEC);
  const ph = cycles - Math.floor(cycles);
  return ph < 0.55 ? 1 : 0.2;
}

/** Pure: true while the pull ripples run outward (the tide pushes). */
export function ripplesOut(tide: number): boolean {
  return tide === -1;
}

/** Pure: a lattice pull acceleration turned by the tide: a push (sign flipped) while tide is -1. */
export function tideLatticeAccel(accel: number, tide: number): number {
  const a = fin(accel, 0);
  return tide === -1 ? -a : a;
}

