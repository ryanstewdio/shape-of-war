// Drum layouts for cylinder levels (G3H, G10: "3D maps with slower speed due to shape or
// barriers"). Every draw here comes from the surface stream, after its cylinder draw, so no flat
// level and no other stage moves. Existing obstacle type only: axis aligned bars, each kept inside
// the canonical u range [-W/2, W/2]; a bar that would cross the seam is cut there into two pieces
// (seamJoined in cylinder.ts), which the sim already treats as one wall through its wrapped push.
import { rngInt, rngPick } from '../core/rng';
import type { Rng } from '../core/rng';
import { CYLINDER_WIDTH_STEP, canonX, cylObstacleDistance } from './cylinder';
import type { ArenaDef, Obstacle } from './leveldef';

export const DRUM_PATTERNS = ['open', 'rings', 'pillars', 'narrow'] as const;
export type DrumPattern = (typeof DRUM_PATTERNS)[number];

/** Pattern weights (sum 100). open is the C0 drum, unchanged. */
export const DRUM_PATTERN_WEIGHTS: Readonly<Record<DrumPattern, number>> = Object.freeze({
  open: 30,
  rings: 25,
  pillars: 25,
  narrow: 20,
});

/** Bar thickness, as the flat obstacles. */
export const DRUM_BAR_THICK = 24;
/** Ring gap width range, u, step 10. */
export const RING_GAP_MIN = 160;
export const RING_GAP_MAX = 240;
/** Nearest a ring may sit to v = 0: the spawn clearance (200) plus half a bar, rounded up to 10. */
export const RING_V_MIN = 220;
/** Clear corridor needed between two rings on one side before a third ring is used. */
export const RING_THIRD_BAND = 130;
/** Shortest piece a seam cut may leave; the ring rotates by this until no piece is shorter. */
const RING_MIN_PIECE = 40;
/** Membrane segment width range, u, step 10 (release polish, docs/14 item 9). */
export const MEMBRANE_MIN = 120;
export const MEMBRANE_MAX = 200;
/** Least solid bar left beside a membrane, as RING_MIN_PIECE. */
export const MEMBRANE_MIN_SOLID = RING_MIN_PIECE;
/** Least solid left between a membrane and the seam on a seam cut bar: the pair gap (validate.ts A5). */
export const MEMBRANE_SEAM_SOLID = 80;
/** Pillar count range and the longest pillar. */
export const PILLARS_MIN = 6;
export const PILLARS_MAX = 10;
export const PILLAR_MAX_LEN = 120;
/** Most pillar slots tried around the drum (keeps same row gaps at least 80 u at W 768). */
const PILLAR_MAX_SLOTS = 12;

// Rule distances (mirror validate.ts; duplicated to keep this module free of the validator).
const SPAWN_CLEAR = 200;
const EDGE_GAP = 80;

const range = (r: Rng, lo: number, hi: number): number => lo + (hi - lo) * r();
const round10 = (v: number): number => Math.round(v / 10) * 10 + 0;
const floor10 = (v: number): number => Math.floor(v / 10) * 10 + 0;

/** Draws: one weighted pick. */
export function pickDrumPattern(r: Rng): DrumPattern {
  return rngPick(r, DRUM_PATTERNS, DRUM_PATTERNS.map((k) => DRUM_PATTERN_WEIGHTS[k]));
}

/** Narrow drum width: the least multiple of 64 with aspect at least 1 (the low end of A1). */
export function narrowWidth(height: number): number {
  return Math.ceil(height / CYLINDER_WIDTH_STEP) * CYLINDER_WIDTH_STEP;
}

/**
 * Apply a pattern to the C0 cylinder arena (height and width from the arena stream). open: as is,
 * no draw. narrow: rect at narrowWidth, no obstacles, no draw. rings and pillars: rectObstacles
 * with the pattern's bars in place of the C0 obstacles.
 */
export function applyDrumPattern(base: ArenaDef, pattern: DrumPattern, r: Rng, membranes = false): ArenaDef {
  switch (pattern) {
    case 'open':
      return base;
    case 'narrow':
      return { ...base, shape: 'rect', width: narrowWidth(base.height), obstacles: [] };
    case 'rings': {
      const bars = ringBars(r, base.width, base.height);
      return { ...base, shape: 'rectObstacles', obstacles: membranes ? addMembranes(r, bars, base.width) : bars };
    }
    case 'pillars':
      return { ...base, shape: 'rectObstacles', obstacles: pillarBars(r, base.width, base.height) };
  }
}

/** Ring rows, v: 2 mirrored rows, or 3 (two on one side) when that side has room. */
export function ringRows(height: number, wantThree: boolean, upper: boolean): number[] {
  const vMax = floor10(height / 2 - EDGE_GAP - DRUM_BAR_THICK / 2);
  const mid = floor10((RING_V_MIN + vMax) / 2);
  if (!wantThree || vMax - RING_V_MIN < RING_THIRD_BAND) return [-mid, mid];
  const s = upper ? 1 : -1;
  return [s * RING_V_MIN, s * vMax, -s * mid];
}

/** Cut the bar [a, a + len] (unwrapped u) into canonical pieces at the seam. */
export function cutAtSeam(a: number, len: number, width: number): Array<[number, number]> {
  const h = width / 2;
  const lo = canonX(a, width);
  const hi = lo + len;
  if (hi <= h) return [[lo, hi]];
  return [
    [lo, h],
    [-h, hi - width],
  ];
}

/**
 * One ring at v: bars around the drum with gaps at the given centres and widths (unwrapped u,
 * gaps in increasing order within one turn), cut at the seam. Pure.
 */
export function ringPieces(v: number, centres: readonly number[], gaps: readonly number[], width: number): Obstacle[] {
  const n = centres.length;
  const out: Obstacle[] = [];
  for (let i = 0; i < n; i++) {
    const c = centres[i] ?? 0;
    const g = gaps[i] ?? 0;
    const nextC = i + 1 < n ? (centres[i + 1] ?? 0) : (centres[0] ?? 0) + width;
    const nextG = i + 1 < n ? (gaps[i + 1] ?? 0) : (gaps[0] ?? 0);
    const a = c + g / 2;
    const len = nextC - nextG / 2 - a;
    for (const [lo, hi] of cutAtSeam(a, len, width)) {
      out.push({ cx: (lo + hi) / 2 + 0, cy: v, w: hi - lo, h: DRUM_BAR_THICK });
    }
  }
  return out;
}

/**
 * Barrier rings. Draws: ring count (2 or 3), side of the pair (always drawn), then per ring: gap
 * count (1 or 2), first gap centre (ring 0 anywhere, later rings a quarter to three quarters of a
 * turn on from the previous ring), each gap width, and for two gaps the second centre (half a turn
 * on, plus or minus a sixteenth). A ring whose seam cut leaves a piece under 40 u rotates by 40 u
 * (no draw) until none does.
 */
export function ringBars(r: Rng, width: number, height: number): Obstacle[] {
  const wantThree = rngInt(r, 2, 3) === 3;
  const upper = r() < 0.5;
  const rows = ringRows(height, wantThree, upper);
  const out: Obstacle[] = [];
  let prev = 0;
  rows.forEach((v, k) => {
    const nGaps = rngInt(r, 1, 2);
    const c0 = k === 0 ? round10(range(r, 0, width)) : prev + round10(range(r, width / 4, (3 * width) / 4));
    prev = c0;
    const gaps: number[] = [];
    for (let i = 0; i < nGaps; i++) gaps.push(RING_GAP_MIN + 10 * rngInt(r, 0, (RING_GAP_MAX - RING_GAP_MIN) / 10));
    const centres = [c0];
    if (nGaps === 2) centres.push(c0 + round10(width / 2 + range(r, -width / 16, width / 16)));
    let pieces = ringPieces(v, centres, gaps, width);
    for (let shift = RING_MIN_PIECE; shift <= 8 * RING_MIN_PIECE && pieces.some((o) => o.w < RING_MIN_PIECE); shift += RING_MIN_PIECE) {
      pieces = ringPieces(v, centres.map((c) => c + shift), gaps, width);
    }
    out.push(...pieces);
  });
  return out;
}

/** One end of a bar that borders an open gap (not the seam): bar index and which end. */
interface GapEdge {
  bar: number;
  high: boolean;
}

/**
 * Release polish (docs/14 item 9): each ring gets 1 or 2 membrane segments beside its open gaps.
 * A membrane takes MEMBRANE_MIN to MEMBRANE_MAX u off the gap end of a bar, so the bar count is
 * unchanged and the open gap stays open. Runs after every ring draw, so the rings themselves do
 * not move. Draws per ring (rows in order of first appearance): count (1 or 2), then per membrane
 * the gap edge and the width. An edge whose bar cannot keep MEMBRANE_MIN_SOLID is not offered; a
 * ring with no edge left gets fewer membranes. A bar that already has a membrane is not offered;
 * a seam cut half offers only its gap end. Output: the bars in their order, each followed by
 * its membrane pieces.
 */
export function addMembranes(r: Rng, bars: readonly Obstacle[], width: number): Obstacle[] {
  const h = width / 2;
  const solid = bars.map((o) => ({ ...o }));
  const extra: Obstacle[][] = bars.map(() => []);
  const rows: number[] = [];
  for (const o of bars) if (!rows.includes(o.cy)) rows.push(o.cy);
  for (const v of rows) {
    const n = rngInt(r, 1, 2);
    const used: GapEdge[] = [];
    for (let m = 0; m < n; m++) {
      const edges: GapEdge[] = [];
      solid.forEach((o, i) => {
        if (o.cy !== v || o.membrane === true) return;
        const lo = o.cx - o.w / 2;
        const hi = o.cx + o.w / 2;
        // A half of a bar cut at the seam takes a membrane only at its gap end, and keeps
        // MEMBRANE_SEAM_SOLID so the membrane stays the pair gap away from the other half.
        const seam = lo <= -h || hi >= h;
        if (o.w - MEMBRANE_MIN < (seam ? MEMBRANE_SEAM_SOLID : MEMBRANE_MIN_SOLID) || used.some((e) => e.bar === i)) return;
        if (lo > -h) edges.push({ bar: i, high: false });
        if (hi < h) edges.push({ bar: i, high: true });
      });
      if (edges.length === 0) break;
      const e = edges[rngInt(r, 0, edges.length - 1)];
      const o = e === undefined ? undefined : solid[e.bar];
      if (e === undefined || o === undefined) break;
      const seam = o.cx - o.w / 2 <= -h || o.cx + o.w / 2 >= h;
      const maxW = Math.min(MEMBRANE_MAX, floor10(o.w - (seam ? MEMBRANE_SEAM_SOLID : MEMBRANE_MIN_SOLID)));
      const mw = MEMBRANE_MIN + 10 * rngInt(r, 0, Math.max(0, (maxW - MEMBRANE_MIN) / 10));
      const lo = o.cx - o.w / 2;
      const hi = o.cx + o.w / 2;
      const nlo = e.high ? lo : lo + mw;
      const nhi = e.high ? hi - mw : hi;
      const mlo = e.high ? hi - mw : lo;
      solid[e.bar] = { cx: (nlo + nhi) / 2 + 0, cy: o.cy, w: nhi - nlo, h: o.h };
      extra[e.bar]?.push({ cx: mlo + mw / 2 + 0, cy: o.cy, w: mw, h: o.h, membrane: true });
      used.push(e);
    }
  }
  const out: Obstacle[] = [];
  solid.forEach((o, i) => {
    out.push(o);
    out.push(...(extra[i] ?? []));
  });
  return out;
}

/** Pillar length and row offset for a height: a - len/2 >= 200 (spawn) and a + len/2 <= H/2 - 80. */
export function pillarRows(height: number): { len: number; a: number } {
  const len = Math.min(PILLAR_MAX_LEN, floor10(height / 2 - EDGE_GAP - SPAWN_CLEAR));
  const lo = SPAWN_CLEAR + len / 2;
  const hi = height / 2 - EDGE_GAP - len / 2;
  return { len, a: lo + floor10((hi - lo) / 2) };
}

/**
 * Pillars on slots evenly round the drum, rows cycling +a, 0, -a, 0 so neighbours never share a
 * row (a checker that breaks every straight run round the seam). Slots are kept inside the
 * canonical range; a middle row pillar within the spawn clearance is left out. Pure.
 */
export function pillarLayout(width: number, height: number, slots: number, phase: number): Obstacle[] {
  const { len, a } = pillarRows(height);
  const rowsV = [a, 0, -a, 0];
  const out: Obstacle[] = [];
  const h = width / 2;
  const hw = DRUM_BAR_THICK / 2;
  for (let i = 0; i < slots; i++) {
    let u = Math.round(canonX(phase + (i * width) / slots, width));
    if (u + hw > h) u = h - hw;
    if (u - hw < -h) u = -h + hw;
    const o: Obstacle = { cx: u + 0, cy: rowsV[i % 4] ?? 0, w: DRUM_BAR_THICK, h: len };
    if (cylObstacleDistance(o, { x: 0, y: 0 }, width) < SPAWN_CLEAR) continue;
    out.push(o);
  }
  return out;
}

/**
 * Staggered pillars. Draws: count (6 to 10), phase. The slot count starts at the count rounded up
 * to even and steps by 2 until the pillars left after the spawn cut number 6 to 10.
 */
export function pillarBars(r: Rng, width: number, height: number): Obstacle[] {
  const n = rngInt(r, PILLARS_MIN, PILLARS_MAX);
  let slots = n + (n % 2);
  const phase = round10(range(r, 0, width / slots));
  let out = pillarLayout(width, height, slots, phase);
  while (out.length < PILLARS_MIN && slots + 2 <= PILLAR_MAX_SLOTS) {
    slots += 2;
    out = pillarLayout(width, height, slots, phase);
  }
  return out;
}
