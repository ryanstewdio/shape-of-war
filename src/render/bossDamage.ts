// Boss battle damage layout (look v33, device gate GW1). Damage is shown by the boss becoming
// incomplete, never by dark paint: whole segments of the outline are removed from the body
// geometry itself (a damaged copy of the body spec), the outline left beside each gap shifts hue
// toward the boss accent and flickers, torn ends get short bright stubs in the boss primary, and the
// removed pieces fall away as outline fragments in the boss colours. No erase or multiply blend,
// no scorch, no dark fill: every damage colour keeps HSL lightness at or above DAMAGE_MIN_L.
// This module is pure: the arc table, the spec clip and the colour maths. Variation comes from a
// hashed table per boss and seed, never the PRNG.
import { clampNum, hash01, hslToRgbInt } from './color';
import type { ShapeLayer, ShapePrim, ShapeSpec } from './shapeSpecs';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

const TAU = Math.PI * 2;

/** Hashed noise table (values 0 to 1), sampled with linear interpolation and wrapped. */
export const NOISE_SIZE = 64;
export const DAMAGE_NOISE: Float32Array = (() => {
  const t = new Float32Array(NOISE_SIZE);
  for (let k = 0; k < NOISE_SIZE; k++) t[k] = hash01(k * 7 + 3);
  return t;
})();

/** Pure: smooth periodic noise 0 to 1 at x (one table cell per unit). Used by the Ember flame. */
export function noiseAt(x: number): number {
  const v = fin(x, 0);
  const f = Math.floor(v);
  const u = v - f;
  const i = ((f % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
  const a = DAMAGE_NOISE[i] ?? 0;
  const b = DAMAGE_NOISE[(i + 1) % NOISE_SIZE] ?? 0;
  const s = u * u * (3 - 2 * u);
  return a + (b - a) * s;
}

/** Share of the outline perimeter removed at stage 1 and stage 2. */
export const BREAK_SHARE: readonly [number, number] = [0.2, 0.4];
/** Removed arcs at stage 1 and stage 2. Stage 2 keeps (and widens) the stage 1 arcs. */
export const BREAK_ARCS: readonly [number, number] = [3, 5];
export const BREAK_ARCS_MAX = 5;
/** The stage 2 arc that detaches as one whole section of the outline. */
export const DETACH_ARC = 3;
/** Only outline at or beyond this share of the outermost radius is cut (inner detail stays). */
export const BREAK_MIN_R = 0.62;
/** Polygonise step for the clip, as a share of the outermost radius. */
export const BREAK_STEP = 0.035;

/** Pure: the hashed width weight (0.8 to 1.2) of arc k for a seed. */
function arcWeight(seed: number, k: number): number {
  return 0.8 + 0.4 * hash01(seed * 41 + k * 7 + 5);
}

/**
 * Pure: the removed arcs of a stage as (start, end) local angle pairs written into out (at least
 * BREAK_ARCS_MAX * 2 long). Returns the arc count. The circle is split into BREAK_ARCS_MAX sectors
 * starting at offset; arc k sits in sector k with a hashed width and a hashed shift, so arcs never
 * overlap. Widths are scaled so the arcs cover BREAK_SHARE of the full turn, and every stage 1 arc
 * lies inside the same arc at stage 2. seed should mix the boss index and the level seed.
 */
export function breakArcs(stage: number, seed: number, offset: number, out: Float32Array): number {
  const s = stage >= 2 ? 2 : stage >= 1 ? 1 : 0;
  if (s === 0) return 0;
  const sd = Math.floor(fin(seed, 0));
  const off = fin(offset, 0);
  const n = BREAK_ARCS[s - 1] ?? 3;
  let w5 = 0;
  let w3 = 0;
  for (let k = 0; k < BREAK_ARCS_MAX; k++) {
    const w = arcWeight(sd, k);
    w5 += w;
    if (k < BREAK_ARCS[0]) w3 += w;
  }
  const scale = s === 1 ? (BREAK_SHARE[0] * TAU) / w3 : (BREAK_SHARE[1] * TAU) / w5;
  const sector = TAU / BREAK_ARCS_MAX;
  // The widest stage 2 arc decides how far a centre may shift and stay inside its sector.
  const maxHalf = ((BREAK_SHARE[1] * TAU) / (BREAK_ARCS_MAX * 0.8)) * 1.2 * 0.5;
  const room = Math.max(0, sector / 2 - maxHalf) * 0.8;
  for (let k = 0; k < n; k++) {
    const shift = (hash01(sd * 53 + k * 11 + 1) * 2 - 1) * room;
    const c = off + k * sector + shift;
    const half = (arcWeight(sd, k) * scale) / 2;
    out[k * 2] = c - half;
    out[k * 2 + 1] = c + half;
  }
  return n;
}

/** Pure: angle wrapped to (-PI, PI]. */
function wrapPi(a: number): number {
  let v = fin(a, 0) % TAU;
  if (v <= -Math.PI) v += TAU;
  else if (v > Math.PI) v -= TAU;
  return v;
}

/** Pure: whether local angle theta lies inside one of the first n arcs. */
export function inArcs(theta: number, arcs: Float32Array, n: number): boolean {
  for (let k = 0; k < n; k++) {
    const a0 = arcs[k * 2] ?? 0;
    const a1 = arcs[k * 2 + 1] ?? 0;
    const mid = (a0 + a1) / 2;
    if (Math.abs(wrapPi(theta - mid)) <= (a1 - a0) / 2) return true;
  }
  return false;
}

/** Pure: total angular share (0 to 1) covered by the first n arcs. */
export function arcShare(arcs: Float32Array, n: number): number {
  let s = 0;
  for (let k = 0; k < n; k++) s += (arcs[k * 2 + 1] ?? 0) - (arcs[k * 2] ?? 0);
  return s / TAU;
}

/** Pure: a primitive as a list of points (x, y pairs) and whether it closes. */
export function primPoints(p: ShapePrim): { pts: number[]; closed: boolean } {
  if (p.t === 'circle') {
    const pts: number[] = [];
    for (let k = 0; k < 72; k++) pts.push(Math.cos((k / 72) * TAU) * p.r, Math.sin((k / 72) * TAU) * p.r);
    return { pts, closed: true };
  }
  if (p.t === 'regularPoly') {
    const pts: number[] = [];
    const n = Math.max(3, p.sides);
    for (let k = 0; k < n; k++) {
      const a = p.rot - Math.PI / 2 + (k * TAU) / n;
      pts.push(Math.cos(a) * p.r, Math.sin(a) * p.r);
    }
    return { pts, closed: true };
  }
  if (p.t === 'rect') {
    const x = p.w / 2;
    const y = p.h / 2;
    return { pts: [-x, -y, x, -y, x, y, -x, y], closed: true };
  }
  return { pts: [...p.pts], closed: p.t === 'poly' };
}

/** Pure: points subdivided so no edge is longer than step. */
function densify(pts: readonly number[], closed: boolean, step: number): number[] {
  const n = pts.length >> 1;
  const out: number[] = [];
  const edges = closed ? n : n - 1;
  for (let k = 0; k < edges; k++) {
    const ax = pts[k * 2] ?? 0;
    const ay = pts[k * 2 + 1] ?? 0;
    const j = (k + 1) % n;
    const bx = pts[j * 2] ?? 0;
    const by = pts[j * 2 + 1] ?? 0;
    const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1e-3, step)));
    for (let q = 0; q < m; q++) out.push(ax + ((bx - ax) * q) / m, ay + ((by - ay) * q) / m);
  }
  if (!closed && n > 0) out.push(pts[(n - 1) * 2] ?? 0, pts[(n - 1) * 2 + 1] ?? 0);
  return out;
}

/** Pure: the outermost point radius of every stroked or filled primitive of a spec. */
export function specOuterRadius(spec: ShapeSpec): number {
  let r = 0;
  for (const l of spec.layers) {
    for (const p of l.prims) {
      const { pts } = primPoints(p);
      for (let k = 0; k + 1 < pts.length; k += 2) r = Math.max(r, Math.hypot(pts[k] ?? 0, pts[k + 1] ?? 0));
    }
  }
  return r;
}

/**
 * Pure: the kept runs of a primitive after cutting every point that lies in an arc at or beyond
 * rCut, as open polylines (x, y pairs, two points or more). A closed shape whose cut leaves the
 * seam intact joins its last run to its first.
 */
export function clipPrim(p: ShapePrim, arcs: Float32Array, n: number, rCut: number, step: number): number[][] {
  const src = primPoints(p);
  const pts = densify(src.pts, src.closed, step);
  const m = pts.length >> 1;
  const cut = (k: number): boolean => {
    const x = pts[k * 2] ?? 0;
    const y = pts[k * 2 + 1] ?? 0;
    return Math.hypot(x, y) >= rCut && inArcs(Math.atan2(y, x), arcs, n);
  };
  const runs: number[][] = [];
  let cur: number[] = [];
  let anyCut = false;
  for (let k = 0; k < m; k++) {
    if (cut(k)) {
      anyCut = true;
      if (cur.length >= 4) runs.push(cur);
      cur = [];
    } else {
      cur.push(pts[k * 2] ?? 0, pts[k * 2 + 1] ?? 0);
    }
  }
  if (!anyCut) {
    // Nothing cut: hand back the whole outline (closed shapes close on the first point).
    if (src.closed) cur.push(pts[0] ?? 0, pts[1] ?? 0);
    return cur.length >= 4 ? [cur] : [];
  }
  if (src.closed && !cut(0) && !cut(m - 1) && runs.length > 0 && runs[0] !== undefined) {
    // The seam (last point to first) is kept: join the tail run onto the head run.
    runs[0] = cur.concat(runs[0]);
  } else if (cur.length >= 4) {
    runs.push(cur);
  }
  return runs;
}

/**
 * Pure: the damaged copy of a body spec. Every stroked layer keeps its fill as a fill only copy (so
 * the body fill never drops below normal and never darkens) and its strokes become open polylines
 * with the arcs removed beyond BREAK_MIN_R of the outermost radius. Same colours and widths, so the
 * neon look is unchanged where the outline remains.
 */
export function damagedSpec(spec: ShapeSpec, arcs: Float32Array, n: number): ShapeSpec {
  if (n <= 0) return spec;
  const R = specOuterRadius(spec);
  const rCut = R * BREAK_MIN_R;
  const step = Math.max(0.5, R * BREAK_STEP);
  const layers: ShapeLayer[] = [];
  for (const l of spec.layers) {
    if (l.width <= 0) {
      layers.push(l);
      continue;
    }
    if (l.fill > 0) layers.push({ ...l, width: 0, glow: false });
    const prims: ShapePrim[] = [];
    for (const p of l.prims) for (const run of clipPrim(p, arcs, n, rCut, step)) prims.push({ t: 'line', pts: run });
    if (prims.length > 0) layers.push({ ...l, prims, fill: 0 });
  }
  return { tint: spec.tint, radius: spec.radius, layers };
}

// Colours. Every damage colour is a bright member of the boss palette.

/** Lowest HSL lightness any damage draw may use (the arena background is darker than this). */
export const DAMAGE_MIN_L = 0.3;
/** Hue shift (degrees) of the outline beside a gap, toward the boss accent colour. */
export const EDGE_HUE_SHIFT = 25;
/** Torn end stubs: the boss primary at this brightness multiplier. */
export const STUB_BRIGHT = 1.3;

/** Pure: 0xRRGGBB to HSL (h degrees, s and l 0 to 1). */
export function rgbToHsl(rgb: number): [number, number, number] {
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, clampNum(s, 0, 1), l];
}

/** Pure: HSL lightness 0 to 1 of an RGB colour. */
export function lightnessOf(rgb: number): number {
  return rgbToHsl(rgb)[2];
}

/** Pure: rgb with its lightness raised to at least DAMAGE_MIN_L (hue and saturation kept). */
export function liftToFloor(rgb: number): number {
  const [h, s, l] = rgbToHsl(rgb);
  return l >= DAMAGE_MIN_L ? rgb : hslToRgbInt(h, s, DAMAGE_MIN_L + 0.02);
}

/**
 * Pure: rgb with its hue moved deg degrees toward target's hue (the short way). When the two hues
 * are closer than deg or target is grey, the hue moves deg degrees anyway (positive), so the shift
 * always reads. Saturation and lightness are kept, then lifted to the floor.
 */
export function shiftHueToward(rgb: number, target: number, deg: number): number {
  const [h, s, l] = rgbToHsl(rgb);
  const [th, ts] = rgbToHsl(target);
  let d = ((th - h + 540) % 360) - 180;
  if (ts < 0.05 || Math.abs(d) < 1e-3) d = 1;
  return liftToFloor(hslToRgbInt(h + Math.sign(d) * deg, s, l));
}

/** Pure: an RGB colour with every channel multiplied by k (clamped), then lifted to the floor. */
export function brighten(rgb: number, k: number): number {
  const m = Math.max(0, fin(k, 1));
  const r = clampNum(Math.round(((rgb >> 16) & 255) * m), 0, 255);
  const g = clampNum(Math.round(((rgb >> 8) & 255) * m), 0, 255);
  const b = clampNum(Math.round((rgb & 255) * m), 0, 255);
  return liftToFloor((r << 16) | (g << 8) | b);
}

export interface DamageColours {
  /** Outline beside a gap: hue shifted toward the accent. */
  edge: number;
  /** Torn end stubs: the primary at STUB_BRIGHT. */
  stub: number;
  /** Falling fragments: the primary (lifted to the floor). */
  frag: number;
}

/** Pure: the damage colours of a boss from its primary and accent RGB. */
export function damageColours(primary: number, accent: number, out: DamageColours): DamageColours {
  out.edge = shiftHueToward(primary, accent, EDGE_HUE_SHIFT);
  out.stub = brighten(primary, STUB_BRIGHT);
  out.frag = liftToFloor(primary);
  return out;
}

/** Edge flicker range: the shifted outline beside a gap pulses between these alphas. */
export const EDGE_FLICKER: readonly [number, number] = [0.45, 1];
/** Arc length (radians) of shifted outline drawn either side of a gap. */
export const EDGE_SPAN = 0.22;
/** Torn end stub length as a share of the body radius. */
export const STUB_LEN = 0.12;

/** Pure: uneven flicker of the edge beside gap end k at timeSec, within EDGE_FLICKER. */
export function edgeFlicker(timeSec: number, k: number): number {
  const t = fin(timeSec, 0);
  const w = 0.5 + 0.5 * (Math.sin(t * 13.7 + k * 2.3) * 0.6 + Math.sin(t * 5.1 + k * 0.9) * 0.4);
  return EDGE_FLICKER[0] + (EDGE_FLICKER[1] - EDGE_FLICKER[0]) * w;
}
