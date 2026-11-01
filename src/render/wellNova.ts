// Supernova well (v31, look GW2 "whirlpool"). On 'sim:wellNova' a gravity well becomes a whirlpool
// of white gas and dust (hsl 0 0 95 percent, the Bulwark shield white) spiralling inward and
// clockwise on screen (y down), fast near the core and slow at the rim: WHIRL_BANDS layered
// translucent log spiral bands with bright dashes flowing down them, WHIRL_MOTES dust motes on log
// spiral paths that fall into the core and respawn at the rim, and WHIRL_SPARKS multicolour shimmer
// sparks riding the same flow. The outer edge reaches the sim pull radius, so no ring is drawn. A
// bright white core flare. Before the nova a calm small swirl turns at the well. Everything is a
// pure function of the well id and the draw clock (hash01, never the PRNG); the renderer owns the
// one shared Graphics. GW3 fluid: soft white gas fills the space between the bands (layered filled
// spiral sectors, denser toward the core), the bands shear and wobble with low frequency noise,
// wisps peel off the band edges and stretch along the flow, and motes carry slight turbulence.
// GW4 fluid plus crystal: on Standard and High the gas, bands and wisps are one shader quad per nova
// (wellFluid.ts, wellFluidView.ts); Low keeps this geometry path. On every tier the coloured spark
// motes stay on top, steady, and the shimmer is NOVA_GLINTS gem glints (gemGlint.ts) popping in and
// out on the flow.
// GW5 galaxy: the nova flow runs at GALAXY_SPEED (1.3x, core and rim, every tier), the gas gathers
// into GALAXY_ARMS log spiral arms that turn with the flow (galaxyArmAngle), and twice the star
// dust: most motes start on an arm so they stream along it (whirlMote with arms), with a twinkle.
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
/** Particles a nova may add in all (dust motes, spark motes, wisps and glints), and its Graphics rebuilds per frame. */
export const NOVA_ADDED_PARTICLES_MAX = 192;
export const NOVA_DRAWS_PER_WELL = 1;

// Whirlpool flow. A point at radius share u (0 core, 1 rim) sits at radius
// reach * (WHIRL_CORE + (1 - WHIRL_CORE) * u) and angle
// base + WHIRL_CW * (WHIRL_SPIN * t + WHIRL_TWIST * ln(1 / (WHIRL_CORE + (1 - WHIRL_CORE) * u))),
// a log spiral. Matter falls from u = 1 to u = 0 at a steady radial speed over WHIRL_INFALL_SEC, so
// its angular speed is WHIRL_SPIN + WHIRL_TWIST * (1 - WHIRL_CORE) / WHIRL_INFALL_SEC / share:
// 1 rad/s at the rim, rising past 4 rad/s at the core.

/** Clockwise on screen: with y pointing down, an increasing atan2 angle turns clockwise. */
export const WHIRL_CW = 1;
/** GW6: the visual disc (gas, arms, dust, glints) is this share of the sim pull radius. */
export const WHIRL_VISUAL = 0.65;
/** GW6: alpha of the faint haze that hints the pull area between the visual disc and the pull radius. */
export const WHIRL_HAZE = 0.15;
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
/** Dust motes, multicolour shimmer sparks and peeling gas wisps per nova. */
export const WHIRL_MOTES = 128;
export const WHIRL_SPARKS = 16;
export const WHIRL_WISPS = 8;
/** GW4 gem glints per nova, their peak arm length (u) and the flow share band they pop in. */
export const NOVA_GLINTS = 8;
export const NOVA_GLINT_SIZE = 12;
export const NOVA_GLINT_U0 = 0.12;
export const NOVA_GLINT_U1 = 0.9;

// GW3 fluid flow. The bands and motes ride one shear field per well: a phase offset that grows from
// zero at the rim to WHIRL_SHEAR at the core and drifts with low frequency noise, so the inner flow
// leads and lags the outer flow like a real eddy instead of a rigid wheel. Each band also wobbles
// in radius (zero at the rim and the core, so the reach and the core stay exact), and each mote
// carries a little turbulence. Every amplitude is bounded below the base flow, so matter still turns
// clockwise and falls inward from frame to frame.

/** Peak shear phase offset at the core (rad). */
export const WHIRL_SHEAR = 0.35;
/** Shear noise clock (x rate) and its spread along the flow share. */
export const WHIRL_SHEAR_HZ = 0.3;
export const WHIRL_SHEAR_SPREAD = 0.9;
/** Peak band radius wobble (share of the radius), its clock (x rate) and its spread along the flow. */
export const WHIRL_WOBBLE = 0.05;
export const WHIRL_WOBBLE_HZ = 0.45;
export const WHIRL_WOBBLE_SPREAD = 0.8;
/** Mote turbulence: angle (rad) and radius share amplitudes and their clocks (x rate). */
export const WHIRL_TURB_A = 0.12;
export const WHIRL_TURB_R = 0.035;
export const WHIRL_TURB_HZ = 0.9;
/** Gas fill: layers per nova, points per sector edge, and per layer width (share of the band gap), inner reach (flow share) and alpha. */
export const WHIRL_GAS_LAYERS = 3;
export const WHIRL_GAS_PTS = 10;
export const WHIRL_GAS_WIDTH: readonly number[] = [0.92, 0.62, 0.34];
export const WHIRL_GAS_REACH: readonly number[] = [1, 0.78, 0.52];
export const WHIRL_GAS_ALPHA: readonly number[] = [0.1, 0.13, 0.17];
/** Wisps: life (s at rate 1), points per wisp, inward drag over a life (flow share) and peak stretch. */
export const WHIRL_WISP_SEC = 1.4;
export const WHIRL_WISP_PTS = 4;
export const WHIRL_WISP_DRAG = 0.3;
export const WHIRL_WISP_STRETCH = 0.2;
/** Calm pre nova swirl: bands, motes, reach (x the well radius) and flow rate (x the nova flow). */
export const CALM_BANDS = 2;
export const CALM_MOTES = 10;
export const CALM_REACH = 2.2;
export const CALM_RATE = 0.3;

// GW5 galaxy

/** Nova flow rate: 1.3x the GW4 flow at the core and the rim (the calm swirl keeps its own rate). */
export const GALAXY_SPEED = 1.3;
/** Logarithmic spiral arms of brighter gas (2 to 4), dust lanes between them. */
export const GALAXY_ARMS = 3;
/** Share of the dust motes that start on an arm (the rest fill the disc). */
export const GALAXY_ARM_SHARE = 0.75;
/** Angular spread (rad, full width) of the arm motes about the arm crest. */
export const GALAXY_ARM_SPREAD = 0.5;
/** Mote twinkle clock (Hz, base) and depth (share of the alpha). */
export const GALAXY_TWINKLE_HZ = 2.3;
export const GALAXY_TWINKLE = 0.45;

/** Pure: the fixed start angle (rad, 0 to 2 pi) of well id's first arm (hash01, never the PRNG). */
export function galaxyArmBase(id: number): number {
  return hash01(((id | 0) * 5179 + 71) | 0) * Math.PI * 2;
}

/**
 * Pure: the angle of arm j's crest at radius share s (WHIRL_CORE to 1, s = r / reach) at timeSec:
 * the same log spiral as the motes, turning rigidly at WHIRL_SPIN x rate, so motes started on the
 * arm stay on it as they fall in. The shader draws the same arms (uArm is this at s = 1, j = 0).
 */
export function galaxyArmAngle(j: number, s: number, timeSec: number, base: number, rate = GALAXY_SPEED, arms = GALAXY_ARMS): number {
  const sh = Math.max(WHIRL_CORE, Math.min(1, fin(s, 1)));
  const n = Math.max(1, arms | 0);
  return fin(base, 0) + ((j | 0) * Math.PI * 2) / n + WHIRL_CW * (WHIRL_SPIN * fin(rate, 1) * fin(timeSec, 0) + WHIRL_TWIST * Math.log(1 / sh));
}

/** Pure: the arm rotation uniform: arm 0's rim angle at timeSec wrapped to 0 to 2 pi (keeps the GPU trig small). */
export function galaxyArmUniform(timeSec: number, base: number, rate = GALAXY_SPEED): number {
  const a = galaxyArmAngle(0, 1, timeSec, base, rate);
  const t = Math.PI * 2;
  return a - Math.floor(a / t) * t;
}

/**
 * Pure: the arm crest strength 0 to 1 at angle theta and radius share s: 1 on an arm crest, 0 midway
 * between arms, the same profile the shader uses before its noise.
 */
export function galaxyArmWave(theta: number, s: number, timeSec: number, base: number, rate = GALAXY_SPEED, arms = GALAXY_ARMS): number {
  const n = Math.max(1, arms | 0);
  const d = fin(theta, 0) - galaxyArmAngle(0, s, timeSec, base, rate, n);
  return 0.5 + 0.5 * Math.cos(n * d);
}

/** Pure: twinkle multiplier (1 - GALAXY_TWINKLE to 1) of mote k of well id at timeSec. */
export function galaxyTwinkle(id: number, k: number, timeSec: number): number {
  const h = hash01(((id | 0) * 337 + (k | 0) * 59 + 3) | 0);
  const w = Math.sin(fin(timeSec, 0) * GALAXY_TWINKLE_HZ * (1 + 1.7 * h) * Math.PI * 2 + h * 40);
  const sharp = w > 0 ? w * w * w * w : 0;
  return 1 - GALAXY_TWINKLE + GALAXY_TWINKLE * sharp;
}

/** Pure: true when mote k starts on an arm (GALAXY_ARM_SHARE of the motes, spread evenly). */
export function galaxyArmMote(k: number): boolean {
  return (k | 0) % 4 !== 3;
}

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

/** Pure: particles one nova adds at most: the dust motes, the spark motes, the wisps (Low) and the glints. */
export function novaAddedParticles(): number {
  return WHIRL_MOTES + WHIRL_SPARKS + WHIRL_WISPS + NOVA_GLINTS;
}

/**
 * Pure: where a glint with hashed shares (a, b) sits in well id's flow at timeSec within reach,
 * about the origin, written into out: flow share NOVA_GLINT_U0 to NOVA_GLINT_U1 from b, on the
 * sheared spiral that starts at angle a x 2 pi, so it rides the flow for its short life.
 */
export function novaGlintSpot(a: number, b: number, timeSec: number, id: number, reach: number, out: { x: number; y: number }, rate = 1): { x: number; y: number } {
  const u = NOVA_GLINT_U0 + (NOVA_GLINT_U1 - NOVA_GLINT_U0) * Math.max(0, Math.min(1, fin(b, 0)));
  const r = whirlRadius(u, reach);
  const an = whirlFlowAngle(u, timeSec, fin(a, 0) * Math.PI * 2, id, rate);
  out.x = Math.cos(an) * r;
  out.y = Math.sin(an) * r;
  return out;
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
 * Pure: low frequency noise in [-1, 1] at x for a seed: two incommensurate sines whose phases come
 * from hash01 of the seed (never the PRNG). Its slope is at most FLOW_NOISE_SLOPE.
 */
export function flowNoise(seed: number, x: number): number {
  const v = fin(x, 0);
  const p0 = hash01(seed | 0) * Math.PI * 2;
  const p1 = hash01((seed | 0) + 1) * Math.PI * 2;
  return 0.6 * Math.sin(v + p0) + 0.4 * Math.sin(2.13 * v + p1);
}

/** The largest slope of flowNoise (d noise / d x). */
export const FLOW_NOISE_SLOPE = 0.6 + 0.4 * 2.13;

/**
 * Pure: the shear phase offset (rad, positive is clockwise) of well id at flow share u and timeSec:
 * zero at the rim, up to WHIRL_SHEAR at the core, drifting with the noise clock.
 */
export function whirlShear(id: number, u: number, timeSec: number, rate = 1): number {
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  const x = WHIRL_SHEAR_HZ * fin(rate, 1) * fin(timeSec, 0) + WHIRL_SHEAR_SPREAD * c;
  return WHIRL_CW * WHIRL_SHEAR * (1 - c) * flowNoise((id | 0) * 7919 + 101, x);
}

/**
 * Pure: band radius wobble of well id, band b at flow share u and timeSec, as a share of the radius:
 * zero at the rim and the core, at most WHIRL_WOBBLE between.
 */
export function whirlWobble(id: number, band: number, u: number, timeSec: number, rate = 1): number {
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  const x = WHIRL_WOBBLE_HZ * fin(rate, 1) * fin(timeSec, 0) + WHIRL_WOBBLE_SPREAD * c;
  return WHIRL_WOBBLE * Math.sin(Math.PI * c) * flowNoise((id | 0) * 7919 + (band | 0) * 37 + 211, x);
}

/** Pure: the fluid angle of flow share u: the log spiral plus the well's shear. */
export function whirlFlowAngle(u: number, timeSec: number, base: number, id: number, rate = 1): number {
  return whirlAngle(u, timeSec, base, rate) + whirlShear(id, u, timeSec, rate);
}

/** Pure: the fluid radius of flow share u on band b: the log spiral radius with the band wobble. */
export function whirlFlowRadius(u: number, reach: number, timeSec: number, id: number, band: number, rate = 1): number {
  return whirlRadius(u, reach) * (1 + whirlWobble(id, band, u, timeSec, rate));
}

/**
 * Pure: spiral band `band` of `bands` around the origin written into out (WHIRL_BAND_PTS x, y
 * pairs, rim first, core last). Bands are spaced evenly round the turn and ride the shear and
 * wobble of well id. Allocates nothing.
 */
export function whirlBand(timeSec: number, band: number, bands: number, reach: number, out: Float32Array, rate = 1, id = 0): Float32Array {
  const base = (band * Math.PI * 2) / Math.max(1, bands);
  for (let k = 0; k < WHIRL_BAND_PTS; k++) {
    const u = 1 - k / (WHIRL_BAND_PTS - 1);
    const r = whirlFlowRadius(u, reach, timeSec, id, band, rate);
    const a = whirlFlowAngle(u, timeSec, base, id, rate);
    out[k * 2] = Math.cos(a) * r;
    out[k * 2 + 1] = Math.sin(a) * r;
  }
  return out;
}

/** Pure: alpha of gas layer L (0 outer and widest, last inner and densest), within 0.10 to 0.25. */
export function whirlGasAlpha(layer: number): number {
  const L = Math.max(0, Math.min(WHIRL_GAS_LAYERS - 1, layer | 0));
  return WHIRL_GAS_ALPHA[L] ?? 0.1;
}

/** Pure: width of gas layer L at flow share u as a share of the band gap: tapered to a soft rim. */
export function whirlGasWidth(layer: number, u: number): number {
  const L = Math.max(0, Math.min(WHIRL_GAS_LAYERS - 1, layer | 0));
  const c = Math.max(0, Math.min(1, fin(u, 1)));
  return (WHIRL_GAS_WIDTH[L] ?? 0.5) * Math.min(1, 0.25 + (1 - c) * 3);
}

/**
 * Pure: the filled gas sector trailing band `band` of `bands` for layer L, around the origin,
 * written into out (WHIRL_GAS_PTS x 2 points as x, y pairs): the band edge from the layer's reach
 * to the core, then back out along the trailing edge, whirlGasWidth of the band gap behind it (the
 * gas fills the space between the bands). Inner layers reach less far, so the gas thickens toward
 * the core. Allocates nothing.
 */
export function whirlGasSector(timeSec: number, band: number, bands: number, layer: number, reach: number, id: number, out: Float32Array, rate = 1): Float32Array {
  const L = Math.max(0, Math.min(WHIRL_GAS_LAYERS - 1, layer | 0));
  const top = WHIRL_GAS_REACH[L] ?? 1;
  const base = (band * Math.PI * 2) / Math.max(1, bands);
  const gap = (Math.PI * 2) / Math.max(1, bands);
  const n = WHIRL_GAS_PTS;
  for (let k = 0; k < n; k++) {
    const u = top * (1 - k / (n - 1));
    const r = whirlFlowRadius(u, reach, timeSec, id, band, rate);
    const a = whirlFlowAngle(u, timeSec, base, id, rate);
    out[k * 2] = Math.cos(a) * r;
    out[k * 2 + 1] = Math.sin(a) * r;
    // Trailing edge, written in reverse so the outline runs core to rim on the way back.
    const j = 2 * n - 1 - k;
    const at = a - WHIRL_CW * gap * whirlGasWidth(L, u);
    out[j * 2] = Math.cos(at) * r;
    out[j * 2 + 1] = Math.sin(at) * r;
  }
  return out;
}

/**
 * Pure: wisp k of well id at timeSec within reach, written into out (WHIRL_WISP_PTS x, y pairs, tail
 * first, head last). A wisp peels off a band edge at a hashed flow share, is dragged inward along
 * the flow over its life, drifts off the band, and stretches as it goes. Returns its alpha (0 to
 * 0.6): it fades in and out over the life. Allocates nothing.
 */
export function whirlWisp(timeSec: number, id: number, k: number, reach: number, out: Float32Array, rate = 1, bands = WHIRL_BANDS): number {
  const seed = (id | 0) * 613 + (k | 0) * 389 + 17;
  const ph = (fin(timeSec, 0) * fin(rate, 1)) / WHIRL_WISP_SEC + hash01(seed);
  const p = ph - Math.floor(ph);
  const nb = Math.max(1, bands | 0);
  const band = Math.min(nb - 1, Math.floor(hash01(seed + 1) * nb));
  const base = (band * Math.PI * 2) / nb;
  const gap = (Math.PI * 2) / nb;
  const u0 = 0.35 + 0.55 * hash01(seed + 2);
  const head = Math.max(0, u0 - WHIRL_WISP_DRAG * p);
  const tail = Math.min(1, head + 0.04 + WHIRL_WISP_STRETCH * p);
  const side = hash01(seed + 3) < 0.5 ? -1 : 1;
  const off = side * gap * (0.04 + 0.22 * p);
  for (let q = 0; q < WHIRL_WISP_PTS; q++) {
    const u = tail + ((head - tail) * q) / (WHIRL_WISP_PTS - 1);
    const r = whirlFlowRadius(u, reach, timeSec, id, band, rate);
    const a = whirlFlowAngle(u, timeSec, base, id, rate) + off;
    out[q * 2] = Math.cos(a) * r;
    out[q * 2 + 1] = Math.sin(a) * r;
  }
  return 0.6 * Math.sin(Math.PI * p);
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
 * to the core over WHIRL_INFALL_SEC / rate on its own log spiral (a streamline of the sheared flow)
 * with a little turbulence, then respawns at the rim. The phase and the spiral's start angle come
 * from hash01 of the id and k (no PRNG). GW5: with arms > 0 a galaxyArmMote starts on one of the
 * arms (base armBase, see galaxyArmAngle) within GALAXY_ARM_SPREAD, so it streams along that arm.
 */
export function whirlMote(timeSec: number, id: number, k: number, reach: number, out: Mote, rate = 1, arms = 0, armBase = 0): Mote {
  const seed = (id | 0) * 977 + (k | 0) * 131;
  const t = fin(timeSec, 0);
  const rt = fin(rate, 1);
  const ph = (t * rt) / WHIRL_INFALL_SEC + hash01(seed + 1);
  const u = 1 - (ph - Math.floor(ph));
  const na = arms | 0;
  const base =
    na > 0 && galaxyArmMote(k)
      ? fin(armBase, 0) + (((k | 0) % na) * Math.PI * 2) / na + (hash01(seed + 2) - 0.5) * GALAXY_ARM_SPREAD
      : hash01(seed + 2) * Math.PI * 2;
  const tc = WHIRL_TURB_HZ * rt * t;
  const r = whirlRadius(u, reach) * (0.94 + 0.08 * hash01(seed + 3)) * (1 + WHIRL_TURB_R * flowNoise(seed + 5, tc * 1.2));
  const a = whirlFlowAngle(u, t, base, id, rt) + WHIRL_TURB_A * flowNoise(seed + 7, tc);
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
