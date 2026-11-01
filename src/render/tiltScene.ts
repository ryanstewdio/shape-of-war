// Tilt scene pass (docs/12 Wave V3-G, Route A: CPU projection, crisp shapes). The renderer draws
// every layer in flat arena units exactly as on the off path; just before app.render() this pass
// projects what it was given, and right after the render it restores every value it changed, so
// the draw code always reads back its own flat values and the off path never runs any of this.
// Three kinds of thing:
// - billboards: the direct children of the listed parents (entity views, glow sprites, the Prism
//   layer, the whirlpool quads). Position is projected and scale multiplied by the depth scale; the
//   shape is never rotated or squashed (design item 1).
// - particles: every Particle of the listed ParticleContainers (bullets, trails, sparks, pulses,
//   dust, boss hazards, enemy bullets, the weak point cue). Position always; scale only where the
//   container uploads vertex data per frame (a static vertex property would not upload it).
// - free form: Graphics rebuilt every frame in arena units (shock rings, enemy effect lines, the
//   nova and storm overlays, the boss under and over layers, the drone glyphs, the chainsaw). Each
//   gets the projection linearised at the centre of its bounds as its transform (affineAt): exact
//   at that point, lines stay lines, the error grows with distance from it.
// Saved values live in one Float64Array (bit exact restore) that only grows, so steady frames
// allocate nothing.
// D13 phase C1 drum mode (projectDrum, drum.ts): the same walk through the drum projection. On
// top of position and scale it saves and changes alpha (the back half draws at BACK_ALPHA),
// rotation and the x scale sign (the back half is mirrored). Particle alpha goes through the
// packed colour. Containers whose vertex or colour data is static are marked for a full upload
// (update) on project and again on restore, so the GPU never keeps a projected value.
import { Matrix, Point, type Container, type Graphics, type IParticle, type ParticleContainer } from 'pixi.js';
import { drumAffineAt, drumProject, type Drum, type DrumPoint } from './drum';
import { affineAt, project, type Affine, type Camera, type Projected } from './project';

/** A particle parked at exactly this point (both axes) is left alone: pools park here. */
export const PARK = -99999;

export interface ParticleLayerSpec {
  readonly layer: ParticleContainer;
  /** True when the container's vertex property is dynamic, so a scale change uploads. */
  readonly scale: boolean;
}

export interface TiltSceneSpec {
  /** Parents whose direct children are billboards. */
  readonly billboardParents: readonly Container[];
  readonly particles: readonly ParticleLayerSpec[];
  /** Graphics drawn in arena units; skipped as billboards even when a billboard parent holds them. */
  readonly freeform: readonly Graphics[];
}

export interface TiltScene {
  /** Project every listed object for cam. Call after drawing, before app.render(). */
  project(cam: Camera): void;
  /** Drum mode (cylinder levels): project every listed object through the drum. */
  projectDrum(drum: Drum): void;
  /** Put back every value project or projectDrum changed. Call right after app.render(). */
  restore(): void;
  /** Saved floats in use after the last project (tests and stats). */
  readonly saved: number;
}

const BILL = 4;
const FREE = 8;
const PART = 4;
/** Drum mode record sizes: billboard adds alpha and rotation, free form adds alpha, particle adds rotation and colour. */
const D_BILL = 6;
const D_FREE = 9;
const D_PART = 6;

/** Pure: a packed particle colour (tint plus alpha byte, as pixi's Particle writes it) with its alpha scaled by k. */
export function scaleColourAlpha(color: number, k: number): number {
  const a8 = (color >>> 24) & 255;
  return (color & 0xffffff) + (((a8 * k) | 0) << 24);
}

export function createTiltScene(spec: TiltSceneSpec): TiltScene {
  const freeSet = new Set<Container>(spec.freeform);
  let buf = new Float64Array(1024);
  let used = 0;
  let projected = false;
  let drumMode = false;
  const p: Projected = { x: 0, y: 0, s: 1 };
  const dp: DrumPoint = { x: 0, y: 0, s: 1, a: 1, m: 1 };
  const aff: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const m = new Matrix();
  const centre = new Point();

  function reserve(n: number): void {
    if (used + n <= buf.length) return;
    let size = buf.length * 2;
    while (size < used + n) size *= 2;
    const next = new Float64Array(size);
    next.set(buf.subarray(0, used));
    buf = next;
  }

  function projectBillboard(c: Container, cam: Camera): void {
    reserve(BILL);
    const o = used;
    buf[o] = c.position.x;
    buf[o + 1] = c.position.y;
    buf[o + 2] = c.scale.x;
    buf[o + 3] = c.scale.y;
    used += BILL;
    project(c.position.x, c.position.y, 0, cam, p);
    c.position.set(p.x, p.y);
    c.scale.set(c.scale.x * p.s, c.scale.y * p.s);
  }

  function projectFree(g: Graphics, cam: Camera): void {
    reserve(FREE);
    const o = used;
    used += FREE;
    buf[o] = 0;
    if (!g.visible) return;
    const b = g.bounds;
    if (b.isEmpty()) return;
    // Pixi refreshes localTransform lazily (in the render); bring it up to date before reading.
    g.updateLocalTransform();
    const lt = g.localTransform;
    centre.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    lt.apply(centre, centre);
    buf[o] = 1;
    buf[o + 1] = g.position.x;
    buf[o + 2] = g.position.y;
    buf[o + 3] = g.scale.x;
    buf[o + 4] = g.scale.y;
    buf[o + 5] = g.rotation;
    buf[o + 6] = g.skew.x;
    buf[o + 7] = g.skew.y;
    affineAt(centre.x, centre.y, cam, aff);
    m.set(aff.a, aff.b, aff.c, aff.d, aff.tx, aff.ty);
    m.append(lt);
    g.setFromMatrix(m);
  }

  function projectParticles(list: readonly IParticle[], scale: boolean, cam: Camera): void {
    const n = list.length;
    reserve(n * PART);
    for (let i = 0; i < n; i++) {
      const q = list[i];
      if (!q || (q.x === PARK && q.y === PARK)) continue;
      const o = used;
      buf[o] = q.x;
      buf[o + 1] = q.y;
      buf[o + 2] = q.scaleX;
      buf[o + 3] = q.scaleY;
      used += PART;
      project(q.x, q.y, 0, cam, p);
      q.x = p.x;
      q.y = p.y;
      if (scale) {
        q.scaleX *= p.s;
        q.scaleY *= p.s;
      }
    }
  }

  function projectAll(cam: Camera): void {
    used = 0;
    projected = false;
    drumMode = false;
    if (!cam.on) return;
    for (const parent of spec.billboardParents) {
      if (!parent.visible) continue;
      const kids = parent.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (!c || !c.visible || freeSet.has(c)) continue;
        projectBillboard(c, cam);
      }
    }
    for (const g of spec.freeform) projectFree(g, cam);
    for (const l of spec.particles) {
      if (!l.layer.visible) continue;
      projectParticles(l.layer.particleChildren, l.scale, cam);
    }
    projected = true;
  }

  function drumBillboard(c: Container, d: Drum): void {
    reserve(D_BILL);
    const o = used;
    buf[o] = c.position.x;
    buf[o + 1] = c.position.y;
    buf[o + 2] = c.scale.x;
    buf[o + 3] = c.scale.y;
    buf[o + 4] = c.alpha;
    buf[o + 5] = c.rotation;
    used += D_BILL;
    drumProject(c.position.x, c.position.y, 0, d, dp);
    c.position.set(dp.x, dp.y);
    c.scale.set(c.scale.x * dp.s * dp.m, c.scale.y * dp.s);
    if (dp.a !== 1) c.alpha *= dp.a;
    if (dp.m < 0) c.rotation = -c.rotation;
  }

  function drumFree(g: Graphics, d: Drum): void {
    reserve(D_FREE);
    const o = used;
    used += D_FREE;
    buf[o] = 0;
    if (!g.visible) return;
    const b = g.bounds;
    if (b.isEmpty()) return;
    g.updateLocalTransform();
    const lt = g.localTransform;
    centre.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    lt.apply(centre, centre);
    buf[o] = 1;
    buf[o + 1] = g.position.x;
    buf[o + 2] = g.position.y;
    buf[o + 3] = g.scale.x;
    buf[o + 4] = g.scale.y;
    buf[o + 5] = g.rotation;
    buf[o + 6] = g.skew.x;
    buf[o + 7] = g.skew.y;
    buf[o + 8] = g.alpha;
    const a = drumAffineAt(centre.x, centre.y, d, aff);
    m.set(aff.a, aff.b, aff.c, aff.d, aff.tx, aff.ty);
    m.append(lt);
    g.setFromMatrix(m);
    if (a !== 1) g.alpha *= a;
  }

  function drumParticles(l: ParticleLayerSpec, d: Drum): void {
    const list = l.layer.particleChildren;
    const n = list.length;
    reserve(n * D_PART);
    for (let i = 0; i < n; i++) {
      const q = list[i];
      if (!q || (q.x === PARK && q.y === PARK)) continue;
      const o = used;
      buf[o] = q.x;
      buf[o + 1] = q.y;
      buf[o + 2] = q.scaleX;
      buf[o + 3] = q.scaleY;
      buf[o + 4] = q.rotation;
      buf[o + 5] = q.color;
      used += D_PART;
      drumProject(q.x, q.y, 0, d, dp);
      q.x = dp.x;
      q.y = dp.y;
      q.scaleX *= dp.s * dp.m;
      q.scaleY *= dp.s;
      if (dp.m < 0) q.rotation = -q.rotation;
      if (dp.a !== 1) q.color = scaleColourAlpha(q.color, dp.a);
    }
    // Static vertex or colour data would keep the flat values: upload everything this frame.
    if (!l.scale) l.layer.update();
  }

  function projectDrumAll(d: Drum): void {
    used = 0;
    projected = false;
    drumMode = true;
    for (const parent of spec.billboardParents) {
      if (!parent.visible) continue;
      const kids = parent.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (!c || !c.visible || freeSet.has(c)) continue;
        drumBillboard(c, d);
      }
    }
    for (const g of spec.freeform) drumFree(g, d);
    for (const l of spec.particles) {
      if (!l.layer.visible) continue;
      drumParticles(l, d);
    }
    projected = true;
  }

  function restoreDrum(): void {
    let o = 0;
    for (const parent of spec.billboardParents) {
      if (!parent.visible) continue;
      const kids = parent.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (!c || !c.visible || freeSet.has(c)) continue;
        c.position.set(buf[o] ?? 0, buf[o + 1] ?? 0);
        c.scale.set(buf[o + 2] ?? 1, buf[o + 3] ?? 1);
        c.alpha = buf[o + 4] ?? 1;
        c.rotation = buf[o + 5] ?? 0;
        o += D_BILL;
      }
    }
    for (const g of spec.freeform) {
      if (buf[o] === 1) {
        g.position.set(buf[o + 1] ?? 0, buf[o + 2] ?? 0);
        g.scale.set(buf[o + 3] ?? 1, buf[o + 4] ?? 1);
        g.rotation = buf[o + 5] ?? 0;
        g.skew.set(buf[o + 6] ?? 0, buf[o + 7] ?? 0);
        g.alpha = buf[o + 8] ?? 1;
      }
      o += D_FREE;
    }
    for (const l of spec.particles) {
      if (!l.layer.visible) continue;
      const list = l.layer.particleChildren;
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!q || (q.x === PARK && q.y === PARK)) continue;
        q.x = buf[o] ?? 0;
        q.y = buf[o + 1] ?? 0;
        q.scaleX = buf[o + 2] ?? 1;
        q.scaleY = buf[o + 3] ?? 1;
        q.rotation = buf[o + 4] ?? 0;
        q.color = buf[o + 5] ?? 0xffffffff;
        o += D_PART;
      }
      if (!l.scale) l.layer.update();
    }
  }

  function restoreAll(): void {
    if (!projected) return;
    projected = false;
    if (drumMode) {
      drumMode = false;
      restoreDrum();
      return;
    }
    let o = 0;
    // Same walk, same order: nothing changes the tree between project and restore.
    for (const parent of spec.billboardParents) {
      if (!parent.visible) continue;
      const kids = parent.children;
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (!c || !c.visible || freeSet.has(c)) continue;
        c.position.set(buf[o] ?? 0, buf[o + 1] ?? 0);
        c.scale.set(buf[o + 2] ?? 1, buf[o + 3] ?? 1);
        o += BILL;
      }
    }
    for (const g of spec.freeform) {
      if (buf[o] === 1) {
        g.position.set(buf[o + 1] ?? 0, buf[o + 2] ?? 0);
        g.scale.set(buf[o + 3] ?? 1, buf[o + 4] ?? 1);
        g.rotation = buf[o + 5] ?? 0;
        g.skew.set(buf[o + 6] ?? 0, buf[o + 7] ?? 0);
      }
      o += FREE;
    }
    for (const l of spec.particles) {
      if (!l.layer.visible) continue;
      const list = l.layer.particleChildren;
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!q || (q.x === PARK && q.y === PARK)) continue;
        q.x = buf[o] ?? 0;
        q.y = buf[o + 1] ?? 0;
        q.scaleX = buf[o + 2] ?? 1;
        q.scaleY = buf[o + 3] ?? 1;
        o += PART;
      }
    }
  }

  return {
    project: projectAll,
    projectDrum: projectDrumAll,
    restore: restoreAll,
    get saved(): number {
      return used;
    },
  };
}
