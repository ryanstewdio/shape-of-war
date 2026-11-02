// G6 tilt-depth: the pseudo 3D volume. The extrusion helper (direction and depth scale with tilt,
// zero at Off), the outline per shape, edge facing, the lightness floor of every colour the volume
// path paints, and the volume layers drawing nothing at Off.
import { Graphics, type GraphicsContext } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { palette } from '../../src/render/neon';
import { cameraFor, makeCamera, TILT_DEG } from '../../src/render/project';
import { MAX_SLOT, specForSlot } from '../../src/render/shapeSpecs';
import {
  edgeFacing,
  extrudeDepth,
  extrudeOffset,
  hull,
  lightness,
  liftLightness,
  MIN_LIGHTNESS,
  OUTLINE_MAX,
  placeVolume,
  tiltDepthK,
  VOLUME_DEPTH,
  VOLUME_MAX,
  volumeColours,
  volumeShapeOf,
} from '../../src/render/volume';
import { createVolumeView } from '../../src/render/volumeView';

const H = 1100;

describe('extrusion helper', () => {
  it('is zero at Off for any radius', () => {
    const off = cameraFor('off', H);
    expect(tiltDepthK(off)).toBe(0);
    for (const r of [1, 13, 24, 120]) expect(extrudeDepth(r, off)).toBe(0);
    const o = extrudeOffset(30, off, { x: 9, y: 9 });
    expect(o).toEqual({ x: 0, y: 0 });
  });

  it('is about a quarter of the radius at high, less at low, straight down the screen', () => {
    const hi = cameraFor('high', H);
    const lo = cameraFor('low', H);
    expect(extrudeDepth(40, hi)).toBeCloseTo(VOLUME_DEPTH * 40, 9);
    expect(VOLUME_DEPTH).toBeCloseTo(0.25, 9);
    expect(extrudeDepth(40, lo)).toBeGreaterThan(0);
    expect(extrudeDepth(40, lo)).toBeLessThan(extrudeDepth(40, hi));
    expect(extrudeDepth(40, lo) / extrudeDepth(40, hi)).toBeCloseTo(Math.sin((TILT_DEG.low * Math.PI) / 180) / Math.sin((TILT_DEG.high * Math.PI) / 180), 9);
    const o = extrudeOffset(40, hi, { x: 1, y: 1 });
    expect(o.x).toBe(0);
    expect(o.y).toBeGreaterThan(0); // screen +y: toward the viewer's down direction
  });

  it('grows with the radius and with the tilt, and stays bounded', () => {
    let last = 0;
    for (const deg of [1, 4, 7, 10, 13, 16, 19]) {
      const d = extrudeDepth(30, makeCamera(deg, H));
      expect(d).toBeGreaterThan(last);
      expect(d).toBeLessThanOrEqual(30 * VOLUME_DEPTH * 1.5 + 1e-9);
      last = d;
    }
    expect(extrudeDepth(30, makeCamera(89, H))).toBeCloseTo(30 * VOLUME_DEPTH * 1.5, 9);
    const hi = cameraFor('high', H);
    expect(extrudeDepth(20, hi)).toBeLessThan(extrudeDepth(21, hi));
    expect(extrudeDepth(0, hi)).toBe(0);
    expect(extrudeDepth(Number.NaN, hi)).toBe(0);
  });

  it('places the base outline exactly depth below the top outline', () => {
    const shape = volumeShapeOf(specForSlot(1));
    expect(shape).not.toBeNull();
    if (!shape) return;
    const out = new Float32Array(OUTLINE_MAX * 4);
    const n = placeVolume(shape, 100, -50, 1.5, 0.7, 6, out);
    expect(n).toBe(shape.n);
    for (let i = 0; i < n; i++) {
      expect(out[(n + i) * 2]).toBeCloseTo(out[i * 2] ?? 0, 5);
      expect((out[(n + i) * 2 + 1] ?? 0) - (out[i * 2 + 1] ?? 0)).toBeCloseTo(6, 5);
    }
  });
});

describe('volume outlines', () => {
  it('every visual slot with geometry has an outline within the cap', () => {
    for (let slot = 1; slot <= MAX_SLOT; slot++) {
      const spec = specForSlot(slot);
      const s = volumeShapeOf(spec);
      if (!s) continue;
      expect(s.n).toBeGreaterThanOrEqual(3);
      expect(s.n).toBeLessThanOrEqual(OUTLINE_MAX);
      expect(s.r).toBeGreaterThan(0);
      expect(s.r).toBeLessThanOrEqual(spec.radius * 2 + 40);
    }
  });

  it('circles and the well core are round; the well uses its core, not the pull ring', () => {
    const well = volumeShapeOf(specForSlot(9), true);
    expect(well?.round).toBe(true);
    expect(well?.r).toBeCloseTo(9, 6);
    expect(volumeShapeOf(specForSlot(9))?.r).toBeCloseTo(24, 6);
    expect(volumeShapeOf({ tint: null, radius: 10, layers: [{ prims: [{ t: 'circle', r: 10 }], width: 2, fill: 0, colour: null, glow: true, alpha: 1 }] })?.round).toBe(true);
  });

  it('a line only shape falls back to its convex hull', () => {
    const s = volumeShapeOf({ tint: null, radius: 10, layers: [{ prims: [{ t: 'line', pts: [-10, 0, 0, -10, 10, 0, 0, 10, 0, 0] }], width: 2, fill: 0, colour: null, glow: true, alpha: 1 }] });
    expect(s?.n).toBe(4);
    expect(hull([0, 0, 2, 0, 1, 1, 2, 2, 0, 2]).length).toBe(8);
  });

  it('edge facing: a square shows its bottom face and highlights its top edge, either winding', () => {
    const cw = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    const ccw = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
    const f = new Uint8Array(4);
    edgeFacing(cw, 4, f);
    expect(Array.from(f)).toEqual([2, 0, 1, 0]);
    edgeFacing(ccw, 4, f);
    expect(Array.from(f)).toEqual([0, 1, 0, 2]);
  });
});

describe('volume colours', () => {
  it('lightness floor: lifts dark colours to at least 30 percent and leaves bright ones', () => {
    expect(MIN_LIGHTNESS).toBe(0.3);
    for (const c of [0x000000, 0x101010, 0x200000, 0x000033, 0x0a1f0a, 0x330033]) expect(lightness(liftLightness(c))).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
    expect(liftLightness(0x00ffff)).toBe(0x00ffff);
    expect(liftLightness(0xff2050)).toBe(0xff2050);
  });

  it('every palette colour gives side and highlight colours at or over the floor', () => {
    const out = { side: 0, hi: 0 };
    for (const c of Object.values(palette)) {
      volumeColours(c, out);
      expect(lightness(out.side)).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
      expect(lightness(out.hi)).toBeGreaterThanOrEqual(lightness(out.side) - 1e-9);
    }
  });
});

/** Every fill and stroke colour a Graphics context holds. */
function paintedColours(ctx: GraphicsContext): number[] {
  const out: number[] = [];
  for (const ins of ctx.instructions) {
    const style = (ins.data as { style?: { color?: number } }).style;
    if (style && typeof style.color === 'number') out.push(style.color);
  }
  return out;
}

describe('volume layers', () => {
  it('Off draws nothing and stays hidden', () => {
    const v = createVolumeView();
    v.off();
    const shape = volumeShapeOf(specForSlot(1));
    if (shape) v.add(shape, 0, 0, 1, 0, 0xffffff, 1);
    expect(v.count).toBe(0);
    expect(v.under.visible).toBe(false);
    expect(v.over.visible).toBe(false);
    expect(v.under.context.instructions.length).toBe(0);
    expect(v.over.context.instructions.length).toBe(0);
    // begin with an Off camera adds nothing either.
    v.begin(cameraFor('off', H));
    if (shape) v.add(shape, 0, 0, 1, 0, 0xffffff, 1);
    expect(v.count).toBe(0);
  });

  it('high: every slot paints only colours at or over 30 percent lightness, even from a dark body', () => {
    const v = createVolumeView();
    v.begin(cameraFor('high', H));
    let added = 0;
    for (let slot = 1; slot <= MAX_SLOT && added < VOLUME_MAX; slot++) {
      const s = volumeShapeOf(specForSlot(slot), slot === 9);
      if (!s) continue;
      v.add(s, (slot % 10) * 80 - 400, Math.floor(slot / 10) * 60 - 300, 1, slot * 0.3, slot % 3 === 0 ? 0x101010 : 0x30e0ff, 0.9);
      added++;
    }
    expect(v.count).toBe(added);
    const cols = [...paintedColours(v.under.context), ...paintedColours(v.over.context)];
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) expect(lightness(c)).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
  });

  it('caps the volumes per frame and skips faded shapes', () => {
    const v = createVolumeView();
    v.begin(cameraFor('high', H));
    const s = volumeShapeOf(specForSlot(2));
    if (!s) return;
    for (let i = 0; i < VOLUME_MAX + 30; i++) v.add(s, 0, 0, 1, 0, 0xffffff, 1);
    expect(v.count).toBe(VOLUME_MAX);
    const w = createVolumeView();
    w.begin(cameraFor('high', H));
    w.add(s, 0, 0, 1, 0, 0xffffff, 0.01);
    expect(w.count).toBe(0);
    expect(new Graphics().visible).toBe(true);
  });
});
