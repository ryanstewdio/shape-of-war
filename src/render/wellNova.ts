// Supernova well (v31, look GW2 "whirlpool"). On 'sim:wellNova' a gravity well becomes a whirlpool
// of white gas and dust (hsl 0 0 95 percent, the Bulwark shield white) spiralling inward and
// clockwise on screen (y down), fast near the core and slow at the rim: WHIRL_BANDS layered
// translucent log spiral bands with bright dashes flowing down them, WHIRL_MOTES dust motes on log
// spiral paths that fall into the core and respawn at the rim, and WHIRL_SPARKS multicolour shimmer
// sparks riding the same flow. The outer edge reaches the sim pull radius, so no ring is drawn. A
// bright white core flare. Before the nova a calm small swirl turns at the well. Everything is a
// pure function of the well id and the draw clock (hash01, never the PRNG); the renderer owns the
// one shared Graphics.
import type { Bus, EventKey } from '../core/events';
import { hash01, hslToRgbInt } from './color';
import { mixRgb } from './mapFx';
import type { PaletteKey } from './neon';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

/** Live novas at once (wells on screen are capped at 3; one spare). */
export const NOVA_SLOTS = 4;
/** The whirlpool white: hsl 0 0 95 percent, like the Bulwark shield. */
export const NOVA_WHITE: number = hslToRgbInt(0, 0, 0.95);
/** Eruption flare: the whirlpool grows in over this many seconds. */
export const NOVA_GROW_SEC = 0.35;
/** Particles a nova may add in all (dust motes plus shimmer sparks), and its Graphics rebuilds per frame. */
export const NOVA_ADDED_PARTICLES_MAX = 96;
export const NOVA_DRAWS_PER_WELL = 1;

// Whirlpool flow. A point at radius share u (0 core, 1 rim) sits at radius
// reach * (WHIRL_CORE + (1 - WHIRL_CORE) * u) and angle
// base + WHIRL_CW * (WHIRL_SPIN * t + WHIRL_TWIST * ln(1 / (WHIRL_CORE + (1 - WHIRL_CORE) * u))),
// a log spiral. Matter falls from u = 1 to u = 0 at a steady radial speed over WHIRL_INFALL_SEC, so
// its angular speed is WHIRL_SPIN + WHIRL_TWIST * (1 - WHIRL_CORE) / WHIRL_INFALL_SEC / share:
// 1 rad/s at the rim, rising past 4 rad/s at the core.

/** Clockwise on screen: with y pointing down, an increasing atan2 angle turns clockwise. */
export const WHIRL_CW = 1;
/** Core radius share: the flow ends at this share of the reach. */
export const WHIRL_CORE = 0.12;
/** Seconds a mote takes from the rim to the core. */
export const WHIRL_INFALL_SEC = 2;
/** Rigid turn of the whole pattern (rad/s). */
export const WHIRL_SPIN = 0.5;
/** Log spiral winding: chosen so the rim turns at 1 rad/s in all. */
export const WHIRL_TWIST = ((1 - WHIRL_SPIN) * WHIRL_INFALL_SEC) / (1 - WHIRL_CORE);
/** Layered translucent spiral bands, points per band, bright dashes flowing down each band. */
export const WHIRL_BANDS = 4;
export const WHIRL_BAND_PTS = 16;
export const WHIRL_DASHES = 3;
/** Dash length as a share of the rim to core path. */
export const WHIRL_DASH_U = 0.14;
/** Dust motes and multicolour shimmer sparks per nova. */
export const WHIRL_MOTES = 72;
export const WHIRL_SPARKS = 16;
/** Calm pre nova swirl: bands, motes, reach (x the well radius) and flow rate (x the nova flow). */
export const CALM_BANDS = 2;
export const CALM_MOTES = 10;
export const CALM_REACH = 2.2;
export const CALM_RATE = 0.3;

// Colour cycle

/** The hue ring the shimmer cycles through: palette keys, so the cycle follows applyNeon. */
export const NOVA_HUE_KEYS: readonly PaletteKey[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'];
export const NOVA_HUES = NOVA_HUE_KEYS.length;
/** One full trip round the hue ring per this many seconds. */
export const NOVA_CYCLE_SEC = 2;
/** The well turns from its red to the tornado over this many seconds after the eruption. */
export const NOVA_SHIFT_SEC = 1;

/** Pure: the cycle stop colours under a palette, written into out (NOVA_HUES entries). */
export function novaCycleStops(pal: Readonly<Record<PaletteKey, number>>, out: Uint32Array): Uint32Array {
  for (let k = 0; k < NOVA_HUES; k++) {
    const key = NOVA_HUE_KEYS[k];
    if (key !== undefined) out[k] = pal[key];
  }
  return out;
}

/**
 * Pure: the cycle colour at position u (0 core to 1 tip, any real wraps) at timeSec: the ring is
 * laid once along u and slides one full turn per NOVA_CYCLE_SEC. Neighbouring stops blend.
 */
export function novaCycleColour(stops: Uint32Array, u: number, timeSec: number): number {
  const n = stops.length;
  if (n === 0) return 0xffffff;
  const p = fin(u, 0) + fin(timeSec, 0) / NOVA_CYCLE_SEC;
  const v = (p - Math.floor(p)) * n;
  const i = Math.floor(v) % n;
  return mixRgb(stops[i] ?? 0, stops[(i + 1) % n] ?? 0, v - Math.floor(v));
}

/** Pure: share 0 (the well's red) to 1 (full cycle) at age seconds after the eruption, eased. */
export function novaShift(age: number): number {
  const u = Math.max(0, Math.min(1, fin(age, NOVA_SHIFT_SEC) / NOVA_SHIFT_SEC));
  return u * u * (3 - 2 * u);
}

/** Pure: a nova colour: the base red mixed into the cycle colour at u by the shift share. */
export function novaColour(stops: Uint32Array, base: number, u: number, timeSec: number, shift: number): number {
  return mixRgb(base, novaCycleColour(stops, u, timeSec), shift);
}

/** Pure: brightness pulse 0.35 to 1 of fleck k at timeSec (each fleck beats on its own). */
export function novaPulse(timeSec: number, k: number): number {
  const t = fin(timeSec, 0);
  return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (5 + (k % 5)) + k * 2.1));
}

/** Pure: core flare 0 to 1 at age seconds: a white burst at the eruption, then a quick heartbeat. */
export function novaCoreFlare(age: number, timeSec: number): number {
  const a = Math.max(0, fin(age, 0));
  const burst = Math.exp(-a * 3);
  const beat = 0.5 + 0.5 * Math.sin(fin(timeSec, 0) * 9);
  return Math.min(1, 0.55 + 0.25 * beat + 0.45 * burst);
}

/** Pure: the hue ring stop index of shimmer particle seq: the ring in turn, so every hue shows. */
export function novaShimmerHue(seq: number): number {
  return (((seq | 0) % NOVA_HUES) + NOVA_HUES) % NOVA_HUES;
}

/** Pure: the tornado colour at the shift share: the well red turning to the tornado white. */
export function novaWhite(base: number, shift: number): number {
  return mixRgb(base, NOVA_WHITE, Math.max(0, Math.min(1, fin(shift, 1))));
}

/** Pure: stream particle seq's colour: its hue ring stop (sliding with the cycle) from the red. */
export function novaStreamColour(stops: Uint32Array, base: number, seq: number, timeSec: number, shift: number): number {
  const n = stops.length;
  if (n === 0) return base;
  const u = (novaShimmerHue(seq) + 0.5) / NOVA_HUES;
  return novaColour(stops, base, u - fin(timeSec, 0) / NOVA_CYCLE_SEC, timeSec, shift);
}

/** Pure: particles one nova adds at most: the dust motes plus the shimmer sparks. */
export function novaAddedParticles(): number {
  return WHIRL_MOTES + WHIRL_SPARKS;
}

export interface NovaState {
  /** Seconds since the eruption, or Infinity for a free slot. */
  readonly age: Float64Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Entity index of the well once matched, -1 before. */
  readonly idx: Int32Array;
  /** Numeric id from the payload, or -1 when the id was not a number. */
  readonly wantId: Int32Array;
  /** 1 when the slot's well was drawn this frame. */
  readonly seen: Uint8Array;
}

export function createNovaState(): NovaState {
  return {
    age: new Float64Array(NOVA_SLOTS).fill(Number.POSITIVE_INFINITY),
    x: new Float64Array(NOVA_SLOTS),
    y: new Float64Array(NOVA_SLOTS),
    idx: new Int32Array(NOVA_SLOTS).fill(-1),
    wantId: new Int32Array(NOVA_SLOTS).fill(-1),
    seen: new Uint8Array(NOVA_SLOTS),
  };
}

export function resetNovaState(s: NovaState): void {
  s.age.fill(Number.POSITIVE_INFINITY);
  s.idx.fill(-1);
  s.wantId.fill(-1);
  s.seen.fill(0);
}

/** Record an eruption. Reuses the oldest slot when all are live. Returns the slot. */
export function novaEvent(s: NovaState, id: number, x: number, y: number): number {
  let k = 0;
  for (let j = 0; j < NOVA_SLOTS; j++) {
    if (!Number.isFinite(s.age[j] ?? 0)) {
      k = j;
      break;
    }
    if ((s.age[j] ?? 0) > (s.age[k] ?? 0)) k = j;
  }
  s.age[k] = 0;
  s.x[k] = fin(x, 0);
  s.y[k] = fin(y, 0);
  s.idx[k] = -1;
  s.wantId[k] = Number.isInteger(id) && id >= 0 ? id : -1;
  s.seen[k] = 0;
  return k;
}

/**
 * The slot of well entity i at (x, y) with radius r this frame, or -1. Matches a pending slot by
 * numeric id, else by position (within the radius plus 12 u), then marks it seen.
 */
export function novaSlotFor(s: NovaState, i: number, x: number, y: number, r: number): number {
  for (let k = 0; k < NOVA_SLOTS; k++) {
    if (!Number.isFinite(s.age[k] ?? Infinity)) continue;
    if (s.idx[k] === i) {
      s.seen[k] = 1;
      s.x[k] = x;
      s.y[k] = y;
      return k;
    }
  }
  for (let k = 0; k < NOVA_SLOTS; k++) {
    if (!Number.isFinite(s.age[k] ?? Infinity) || (s.idx[k] ?? -1) >= 0) continue;
    const want = s.wantId[k] ?? -1;
    const dx = x - (s.x[k] ?? 0);
    const dy = y - (s.y[k] ?? 0);
    const near = dx * dx + dy * dy <= (r + 12) * (r + 12);
    if (want === i || near) {
      s.idx[k] = i;
      s.seen[k] = 1;
      s.x[k] = x;
      s.y[k] = y;
      return k;
    }
  }
  return -1;
}

/** End of frame: age live slots, free any matched slot whose well was not drawn (it popped). */
export function stepNovaState(s: NovaState, dt: number): void {
  const d = fin(dt, 0);
  for (let k = 0; k < NOVA_SLOTS; k++) {
    const a = s.age[k] ?? Infinity;
    if (!Number.isFinite(a)) continue;
    // A pending slot waits up to 1 s for its well to show; a matched one dies with its well.
    if (((s.idx[k] ?? -1) >= 0 && s.seen[k] === 0) || ((s.idx[k] ?? -1) < 0 && a > 1)) {
      s.age[k] = Number.POSITIVE_INFINITY;
      s.idx[k] = -1;
      continue;
    }
    s.age[k] = a + d;
    s.seen[k] = 0;
  }
}

/** Pure: true while any slot is live. */
export function novaAny(s: NovaState): boolean {
  for (let k = 0; k < NOVA_SLOTS; k++) if (Number.isFinite(s.age[k] ?? Infinity)) return true;
  return false;
}

/** Pure: eruption growth 0 to 1 at age seconds (overshoots a touch, then settles at 1). */
export function novaGrow(age: number): number {
  const u = Math.max(0, Math.min(1, fin(age, NOVA_GROW_SEC) / NOVA_GROW_SEC));
  return u * (1 + 0.25 * Math.sin(u * Math.PI));
}

/** Pure: the radius share along the flow (0 core, 1 rim) as a fraction of the reach. */
export function whirlShare(u: number): number {
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  return WHIRL_CORE + (1 - WHIRL_CORE) * c;
}

/** Pure: radius of flow share u within reach. */
export function whirlRadius(u: number, reach: number): number {
  return Math.max(0, fin(reach, 0)) * whirlShare(u);
}

/** Pure: angle of flow share u at timeSec on the spiral that starts at base, flow rate rate. */
export function whirlAngle(u: number, timeSec: number, base: number, rate = 1): number {
  return fin(base, 0) + WHIRL_CW * (WHIRL_SPIN * fin(rate, 1) * fin(timeSec, 0) + WHIRL_TWIST * Math.log(1 / whirlShare(u)));
}

/** Pure: angular speed (rad/s, positive is clockwise on screen) of matter at flow share u. */
export function whirlOmega(u: number, rate = 1): number {
  const k = fin(rate, 1);
  return WHIRL_CW * k * (WHIRL_SPIN + (WHIRL_TWIST * (1 - WHIRL_CORE)) / WHIRL_INFALL_SEC / whirlShare(u));
}

/**
 * Pure: the screen turn from vector a to vector b: positive when b is clockwise of a on a y down
 * screen (the 2D cross product a x b).
 */
export function screenTurn(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** Pure: true when moving from a to b (both about the same centre) turns clockwise on screen. */
export function turnsClockwise(ax: number, ay: number, bx: number, by: number): boolean {
  return screenTurn(ax, ay, bx, by) > 0;
}

/**
 * Pure: spiral band `band` of `bands` around the origin written into out (WHIRL_BAND_PTS x, y
 * pairs, rim first, core last). Bands are spaced evenly round the turn. Allocates nothing.
 */
export function whirlBand(timeSec: number, band: number, bands: number, reach: number, out: Float32Array, rate = 1): Float32Array {
  const base = (band * Math.PI * 2) / Math.max(1, bands);
  for (let k = 0; k < WHIRL_BAND_PTS; k++) {
    const u = 1 - k / (WHIRL_BAND_PTS - 1);
    const r = whirlRadius(u, reach);
    const a = whirlAngle(u, timeSec, base, rate);
    out[k * 2] = Math.cos(a) * r;
    out[k * 2 + 1] = Math.sin(a) * r;
  }
  return out;
}

/** Pure: flow share of dash d on a band at timeSec: it slides from the rim to the core and wraps. */
export function whirlDashU(timeSec: number, band: number, d: number, rate = 1): number {
  const ph = (fin(timeSec, 0) * fin(rate, 1)) / WHIRL_INFALL_SEC + d / WHIRL_DASHES + band * 0.137;
  return 1 - (ph - Math.floor(ph));
}

export interface Mote {
  x: number;
  y: number;
  /** Flow share 0 (core) to 1 (rim). */
  u: number;
  /** Alpha 0 to 1: fades in at the rim, brightens toward the core, winks out at the core. */
  a: number;
}

/**
 * Pure: mote k of well id at timeSec within reach, about the origin. Each mote falls from the rim
 * to the core over WHIRL_INFALL_SEC / rate on its own log spiral, then respawns at the rim. The
 * phase and the spiral's start angle come from hash01 of the id and k (no PRNG).
 */
export function whirlMote(timeSec: number, id: number, k: number, reach: number, out: Mote, rate = 1): Mote {
  const seed = (id | 0) * 977 + (k | 0) * 131;
  const ph = (fin(timeSec, 0) * fin(rate, 1)) / WHIRL_INFALL_SEC + hash01(seed + 1);
  const u = 1 - (ph - Math.floor(ph));
  const base = hash01(seed + 2) * Math.PI * 2;
  const r = whirlRadius(u, reach) * (0.94 + 0.12 * hash01(seed + 3));
  const a = whirlAngle(u, timeSec, base, rate);
  out.x = Math.cos(a) * r;
  out.y = Math.sin(a) * r;
  out.u = u;
  const fadeIn = Math.min(1, (1 - u) * 8);
  const fadeOut = Math.min(1, u * 14);
  out.a = fadeIn * fadeOut * (0.35 + 0.65 * (1 - u));
  return out;
}

// Bus

export const WELL_NOVA_EVENT = 'sim:wellNova';
type NovaKey = Extract<EventKey, typeof WELL_NOVA_EVENT>;

function field(p: unknown, k: string): unknown {
  return typeof p === 'object' && p !== null ? (p as Record<string, unknown>)[k] : undefined;
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

export function onWellNova(b: Bus, h: (id: number, x: number, y: number) => void): () => void {
  return b.on<NovaKey>(WELL_NOVA_EVENT as NovaKey, (p: unknown) => h(num(field(p, 'id'), -1), num(field(p, 'x'), Number.NaN), num(field(p, 'y'), Number.NaN)));
}
