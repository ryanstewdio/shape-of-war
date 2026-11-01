// Tilt volume layers (G6 tilt-depth). Two Graphics, drawn already projected (they are not in the
// tilt scene pass): under the entity views the side faces, vertex edges, base outline and rim
// ellipse; over them the highlight on the edges facing up. One draw path per layer, rebuilt each
// tilted frame like the other free form layers; the scratch arrays are made once. Off: both are
// cleared once and hidden, and nothing here runs (the Off render is exactly the old one).
import { Graphics } from 'pixi.js';
import { project, type Camera, type Projected } from './project';
import {
  BASE_ALPHA,
  edgeFacing,
  extrudeDepth,
  FACE_BASE_ALPHA,
  FACE_TOP_ALPHA,
  HI_ALPHA,
  OUTLINE_MAX,
  placeVolume,
  RIM_SQUASH,
  SIDE_ALPHA,
  VOLUME_MAX,
  volumeColours,
  type VolumeColours,
  type VolumeShape,
} from './volume';

export interface VolumeView {
  readonly under: Graphics;
  readonly over: Graphics;
  /** Start a tilted frame (clears both layers). */
  begin(cam: Camera): void;
  /** One shape at flat arena (x, y), drawn scale k, rotation rot, body colour, alpha. */
  add(shape: VolumeShape, x: number, y: number, k: number, rot: number, colour: number, alpha: number): void;
  /** Off (or drum): clear once and hide. */
  off(): void;
  /** Volumes drawn since begin (tests and stats). */
  readonly count: number;
}

export function createVolumeView(): VolumeView {
  const under = new Graphics({ label: 'volumeUnder' });
  const over = new Graphics({ label: 'volumeOver' });
  under.visible = false;
  over.visible = false;
  const pts = new Float32Array(OUTLINE_MAX * 4);
  const facing = new Uint8Array(OUTLINE_MAX);
  const p: Projected = { x: 0, y: 0, s: 1 };
  const col: VolumeColours = { side: 0xffffff, hi: 0xffffff };
  let cam: Camera | null = null;
  let count = 0;
  let dirty = false;

  function begin(c: Camera): void {
    cam = c;
    count = 0;
    under.clear();
    over.clear();
    dirty = false;
    under.visible = true;
    over.visible = true;
  }

  function off(): void {
    cam = null;
    count = 0;
    if (under.visible || dirty) {
      under.clear();
      over.clear();
      dirty = false;
    }
    under.visible = false;
    over.visible = false;
  }

  /** Vertex edge i from the top point to the base point, split in an upper and a lower half. */
  function edge(g: Graphics, n: number, i: number, lower: boolean): void {
    const tx = pts[i * 2] ?? 0;
    const ty = pts[i * 2 + 1] ?? 0;
    const by = pts[(n + i) * 2 + 1] ?? 0;
    const my = (ty + by) / 2;
    if (lower) g.moveTo(tx, my).lineTo(tx, by);
    else g.moveTo(tx, ty).lineTo(tx, my);
  }

  function addPoly(n: number, w: number, a: number): void {
    edgeFacing(pts, n, facing);
    // Side faces: each visible face as two bands, the lower one fainter (darker by alpha only).
    let faces = 0;
    for (let i = 0; i < n; i++) {
      if (facing[i] !== 1) continue;
      const j = (i + 1) % n;
      const ax = pts[i * 2] ?? 0;
      const ay = pts[i * 2 + 1] ?? 0;
      const bx = pts[j * 2] ?? 0;
      const by = pts[j * 2 + 1] ?? 0;
      const ady = (pts[(n + i) * 2 + 1] ?? 0) - ay;
      under.moveTo(ax, ay).lineTo(bx, by).lineTo(bx, by + ady / 2).lineTo(ax, ay + ady / 2).closePath();
      faces++;
    }
    if (faces === 0) return;
    under.fill({ color: col.side, alpha: FACE_TOP_ALPHA * a });
    for (let i = 0; i < n; i++) {
      if (facing[i] !== 1) continue;
      const j = (i + 1) % n;
      const ax = pts[i * 2] ?? 0;
      const ay = pts[i * 2 + 1] ?? 0;
      const bx = pts[j * 2] ?? 0;
      const by = pts[j * 2 + 1] ?? 0;
      const ady = (pts[(n + i) * 2 + 1] ?? 0) - ay;
      under.moveTo(ax, ay + ady / 2).lineTo(bx, by + ady / 2).lineTo(bx, by + ady).lineTo(ax, ay + ady).closePath();
    }
    under.fill({ color: col.side, alpha: FACE_BASE_ALPHA * a });
    // Vertex edges where a visible face starts or ends, upper halves at SIDE_ALPHA.
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n;
      if (facing[i] === 1 || facing[prev] === 1) edge(under, n, i, false);
    }
    under.stroke({ width: w, color: col.side, alpha: SIDE_ALPHA * a, cap: 'round' });
    // Lower halves and the base outline of the visible faces, fainter toward the floor.
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n;
      if (facing[i] === 1 || facing[prev] === 1) edge(under, n, i, true);
      if (facing[i] !== 1) continue;
      const j = (i + 1) % n;
      under.moveTo(pts[(n + i) * 2] ?? 0, pts[(n + i) * 2 + 1] ?? 0).lineTo(pts[(n + j) * 2] ?? 0, pts[(n + j) * 2 + 1] ?? 0);
    }
    under.stroke({ width: w, color: col.side, alpha: BASE_ALPHA * a, cap: 'round', join: 'round' });
    // Highlight: a lighter thin stroke on the edges facing up.
    let his = 0;
    for (let i = 0; i < n; i++) {
      if (facing[i] !== 2) continue;
      const j = (i + 1) % n;
      over.moveTo(pts[i * 2] ?? 0, pts[i * 2 + 1] ?? 0).lineTo(pts[j * 2] ?? 0, pts[j * 2 + 1] ?? 0);
      his++;
    }
    if (his > 0) over.stroke({ width: w * 0.6, color: col.hi, alpha: HI_ALPHA * a, cap: 'round', join: 'round' });
  }

  function addRound(cx: number, cy: number, r: number, depth: number, w: number, a: number): void {
    // The visible side band: the lower half of the top circle down to the lower half of the base.
    under.moveTo(cx - r, cy).arc(cx, cy, r, Math.PI, 0, true).lineTo(cx + r, cy + depth / 2).arc(cx, cy + depth / 2, r, 0, Math.PI).closePath();
    under.fill({ color: col.side, alpha: FACE_TOP_ALPHA * a });
    under.moveTo(cx - r, cy + depth / 2).arc(cx, cy + depth / 2, r, Math.PI, 0, true).lineTo(cx + r, cy + depth).arc(cx, cy + depth, r, 0, Math.PI).closePath();
    under.fill({ color: col.side, alpha: FACE_BASE_ALPHA * a });
    // Tangent edges, upper halves at SIDE_ALPHA, then the rim ellipse (its front half).
    under.moveTo(cx - r, cy).lineTo(cx - r, cy + depth / 2).moveTo(cx + r, cy).lineTo(cx + r, cy + depth / 2);
    under.moveTo(cx + r, cy + depth / 2).ellipse(cx, cy + depth / 2, r, r * RIM_SQUASH);
    under.stroke({ width: w, color: col.side, alpha: SIDE_ALPHA * a * 0.75, cap: 'round' });
    // Lower tangent halves and the front of the base circle, fainter toward the floor.
    under.moveTo(cx - r, cy + depth / 2).lineTo(cx - r, cy + depth).moveTo(cx + r, cy + depth / 2).lineTo(cx + r, cy + depth);
    under.moveTo(cx + r, cy + depth).arc(cx, cy + depth, r, 0, Math.PI);
    under.stroke({ width: w, color: col.side, alpha: BASE_ALPHA * a, cap: 'round' });
    // Top highlight arc.
    over.moveTo(cx + Math.cos(Math.PI * 1.15) * r * 0.78, cy + Math.sin(Math.PI * 1.15) * r * 0.78).arc(cx, cy, r * 0.78, Math.PI * 1.15, Math.PI * 1.85);
    over.stroke({ width: w * 0.7, color: col.hi, alpha: HI_ALPHA * a, cap: 'round' });
  }

  function add(shape: VolumeShape, x: number, y: number, k: number, rot: number, colour: number, alpha: number): void {
    if (!cam || !cam.on || count >= VOLUME_MAX || alpha < 0.05 || !(k > 0)) return;
    project(x, y, 0, cam, p);
    const kk = k * p.s;
    const depth = extrudeDepth(shape.r * kk, cam);
    if (depth < 0.3) return;
    count++;
    dirty = true;
    const a = alpha > 1 ? 1 : alpha;
    const w = Math.max(1, shape.width * kk * 0.8);
    volumeColours(colour, col);
    if (shape.round) {
      addRound(p.x, p.y, shape.r * kk, depth, w, a);
      return;
    }
    const n = placeVolume(shape, p.x, p.y, kk, rot, depth, pts);
    if (n >= 3) addPoly(n, w, a);
  }

  return {
    under,
    over,
    begin,
    add,
    off,
    get count(): number {
      return count;
    },
  };
}
