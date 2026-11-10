// Grid and arena wall drawing. Redrawn only on resize, arena change or neon change.
import type { Graphics } from 'pixi.js';
import type { ArenaDef } from '../levelgen/leveldef';
import { gridSegments, hexagonPoints } from './gridGeom';
import type { Camera } from './project';
import { barrierRects } from './membrane';
import { rimBucketT, rimLineAlpha, rimLineWidth, rimWallAlpha, rimWallWidth } from './troughDepth';
import { LIP_POST_ALPHA, LIP_TOP_ALPHA, lipPosts, obstaclePolys, outlinePoints, projectFlat, projectLifted, WALL_LIP } from './tiltGeom';

/**
 * Line widths in device independent (CSS) px; divided by the world scale so they stay constant
 * on screen. Fractional on purpose: lines are antialiased (MSAA) and never snapped to integers.
 */
export const GRID_LINE_PX = 1.25;
export const WALL_LINE_PX = 3;
export const WALL_GLOW_PX = 10;

/** Pure: grid stroke width in arena units for a world scale. Unrounded. */
export function gridLineWidth(scale: number): number {
  return GRID_LINE_PX / Math.max(scale, 0.01);
}

export interface WallPass {
  /** Arena units. */
  width: number;
  alpha: number;
}

/**
 * Pure: stroke passes for the arena outline, widest first. 'crisp' is the full resolution line
 * layer: outer halo, inner halo, core. 'bloom' is the source drawn into the reduced resolution
 * bloom layer: a slightly thick core only, the filter makes the glow.
 */
export function wallPasses(glowAlpha: number, widthMul: number, scale: number, mode: 'crisp' | 'bloom'): WallPass[] {
  const s = Math.max(scale, 0.01);
  const m = widthMul > 0 ? widthMul : 1;
  if (mode === 'bloom') return [{ width: (WALL_LINE_PX * m * 1.5) / s, alpha: 1 }];
  const passes: WallPass[] = [];
  if (glowAlpha > 0) {
    passes.push({ width: (WALL_GLOW_PX * m * 1.8) / s, alpha: glowAlpha * 0.16 });
    passes.push({ width: (WALL_GLOW_PX * m) / s, alpha: glowAlpha * 0.38 });
  }
  passes.push({ width: (WALL_LINE_PX * m) / s, alpha: 1 });
  return passes;
}

/** Grid lines clipped to the arena. Brightness comes from the Graphics alpha (gridAlpha). */
export function drawGrid(g: Graphics, segs: readonly number[], colour: number, scale: number): void {
  g.clear();
  for (let i = 0; i + 3 < segs.length; i += 4) {
    g.moveTo(segs[i] ?? 0, segs[i + 1] ?? 0).lineTo(segs[i + 2] ?? 0, segs[i + 3] ?? 0);
  }
  if (segs.length > 0) g.stroke({ width: gridLineWidth(scale), color: colour, alpha: 1 });
}

/** Grid segments for an arena (cached by the renderer per arena). */
export function arenaGridSegments(arena: ArenaDef): number[] {
  return gridSegments(arena);
}

function traceOutline(g: Graphics, a: ArenaDef): void {
  const w = a.width;
  const h = a.height;
  switch (a.shape) {
    case 'rect':
    case 'rectObstacles':
      g.rect(-w / 2, -h / 2, w, h);
      return;
    case 'roundRect':
      g.roundRect(-w / 2, -h / 2, w, h, Math.min(a.cornerRadius, w / 2, h / 2));
      return;
    case 'circle':
      g.circle(0, 0, w / 2);
      return;
    case 'hexagon':
      g.poly(hexagonPoints(w, h), true);
      return;
  }
}

/** Arena wall and obstacle outlines. Lives inside the glow layer so it blooms. */
export function drawWalls(g: Graphics, arena: ArenaDef, colour: number, passes: readonly WallPass[]): void {
  g.clear();
  for (const pass of passes) {
    traceOutline(g, arena);
    g.stroke({ width: pass.width, color: colour, alpha: pass.alpha, join: 'round' });
    for (const o of barrierRects(arena)) {
      g.rect(o.cx - o.w / 2, o.cy - o.h / 2, o.w, o.h);
      g.stroke({ width: pass.width, color: colour, alpha: pass.alpha, join: 'round' });
    }
  }
}

/**
 * Tilt only (docs/12 Wave V3-G): the arena wall and obstacle outlines projected on the CPU, so
 * they stay crisp and meet the projected lattice ends exactly. Same passes as drawWalls.
 */
export function drawWallsProjected(g: Graphics, arena: ArenaDef, colour: number, passes: readonly WallPass[], cam: Camera): void {
  g.clear();
  const flat = [outlinePoints(arena), ...obstaclePolys({ ...arena, obstacles: barrierRects(arena) })];
  const floorLines = flat.map((o) => projectFlat(o, cam));
  // G6 tilt-depth: a short raised lip (WALL_LIP toward the viewer) with a top edge and posts at
  // the corners, on the arena wall and every obstacle. Built on tilt, arena or neon change only.
  const tops = flat.map((o) => projectLifted(o, WALL_LIP, cam));
  const posts = flat.map((o) => lipPosts(o));
  for (const pass of passes) {
    for (let k = 0; k < flat.length; k++) {
      const base = floorLines[k] ?? [];
      const top = tops[k] ?? [];
      g.poly(base, true);
      g.stroke({ width: pass.width, color: colour, alpha: pass.alpha, join: 'round' });
      for (const i of posts[k] ?? []) g.moveTo(base[i * 2] ?? 0, base[i * 2 + 1] ?? 0).lineTo(top[i * 2] ?? 0, top[i * 2 + 1] ?? 0);
      g.stroke({ width: pass.width, color: colour, alpha: pass.alpha * LIP_POST_ALPHA, cap: 'round' });
      g.poly(top, true);
      g.stroke({ width: pass.width, color: colour, alpha: pass.alpha * LIP_TOP_ALPHA, join: 'round' });
    }
  }
}

/** Tilt only: the v1 grid (low tier) with every segment end projected. Lines stay lines. */
export function drawGridProjected(g: Graphics, segs: readonly number[], colour: number, scale: number, cam: Camera): void {
  drawGrid(g, projectFlat(segs, cam), colour, scale);
}

/** D13 phase C1: a drum ring split into its front and back arcs (drum.ts ringArcs), screen units. */
export interface DrumArcs {
  readonly front: readonly number[];
  readonly back: readonly number[];
}

function strokeArc(g: Graphics, pts: readonly number[], width: number, colour: number, alpha: number): void {
  if (pts.length < 4) return;
  g.moveTo(pts[0] ?? 0, pts[1] ?? 0);
  for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
  g.stroke({ width, color: colour, alpha, join: 'round', cap: 'round' });
}

/**
 * Cylinder levels: the two rims as glowing ellipses, front arcs at the pass alpha and back arcs
 * through the glass at backAlpha of it. A rim does not depend on the camera angle, so this is
 * drawn on tilt, arena, resize or neon change only. Obstacles go in their own layers (renderer).
 */
export function drawDrumWalls(g: Graphics, rims: readonly DrumArcs[], colour: number, passes: readonly WallPass[], backAlpha: number): void {
  g.clear();
  for (const pass of passes) {
    for (const r of rims) strokeArc(g, r.back, pass.width, colour, pass.alpha * backAlpha);
    for (const r of rims) strokeArc(g, r.front, pass.width, colour, pass.alpha);
  }
}

/**
 * Cylinder levels on the low tier: v rings (static arcs) and the u lines for the current camera
 * angle (flat segment lists [x0, y0, x1, y1, ...]), back first at backAlpha. Redrawn per frame
 * while the camera turns (low tier only).
 */
export function drawDrumGrid(
  g: Graphics,
  rings: readonly DrumArcs[],
  uFront: readonly number[],
  uBack: readonly number[],
  colour: number,
  scale: number,
  backAlpha: number,
): void {
  g.clear();
  const w = gridLineWidth(scale);
  for (const r of rings) strokeArc(g, r.back, w, colour, backAlpha);
  for (let i = 0; i + 3 < uBack.length; i += 4) g.moveTo(uBack[i] ?? 0, uBack[i + 1] ?? 0).lineTo(uBack[i + 2] ?? 0, uBack[i + 3] ?? 0);
  if (uBack.length > 0) g.stroke({ width: w, color: colour, alpha: backAlpha });
  for (const r of rings) strokeArc(g, r.front, w, colour, 1);
  for (let i = 0; i + 3 < uFront.length; i += 4) g.moveTo(uFront[i] ?? 0, uFront[i + 1] ?? 0).lineTo(uFront[i + 2] ?? 0, uFront[i + 3] ?? 0);
  if (uFront.length > 0) g.stroke({ width: w, color: colour, alpha: 1 });
}

/** Stroke a segment list, chaining a segment that starts where the last ended into one polyline. */
function strokeSegList(g: Graphics, segs: readonly number[], width: number, colour: number, alpha: number, cap: 'butt' | 'round'): void {
  if (segs.length < 4 || !(alpha > 0)) return;
  let ex = Number.NaN;
  let ey = Number.NaN;
  for (let i = 0; i + 3 < segs.length; i += 4) {
    const x0 = segs[i] ?? 0;
    const y0 = segs[i + 1] ?? 0;
    if (x0 !== ex || y0 !== ey) g.moveTo(x0, y0);
    ex = segs[i + 2] ?? 0;
    ey = segs[i + 3] ?? 0;
    g.lineTo(ex, ey);
  }
  g.stroke({ width, color: colour, alpha, cap, join: 'round' });
}

/**
 * Glow trough-depth, low tier: the trough grid sorted into height buckets (troughGeom.ts
 * troughRimSegs), each bucket one stroke, wider and brighter toward the rims (troughDepth.ts).
 * Static: drawn on arena, tilt, fit or neon change only.
 */
export function drawTroughGrid(g: Graphics, buckets: readonly (readonly number[])[], colour: number, scale: number): void {
  g.clear();
  const w = gridLineWidth(scale);
  const n = buckets.length;
  for (let b = 0; b < n; b++) {
    const t = rimBucketT(b, n);
    strokeSegList(g, buckets[b] ?? [], w * rimLineWidth(t), colour, rimLineAlpha(t), 'butt');
  }
}

/**
 * Glow trough-depth: the arena outline on a trough, sorted into height buckets, every pass wider
 * and brighter toward the rims (alpha capped at 1 per pass). Static, like drawDrumWalls.
 */
export function drawTroughWalls(g: Graphics, buckets: readonly (readonly number[])[], colour: number, passes: readonly WallPass[]): void {
  g.clear();
  const n = buckets.length;
  for (const pass of passes) {
    for (let b = 0; b < n; b++) {
      const t = rimBucketT(b, n);
      strokeSegList(g, buckets[b] ?? [], pass.width * rimWallWidth(t), colour, rimWallAlpha(pass.alpha, t), 'round');
    }
  }
}
