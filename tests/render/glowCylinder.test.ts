// G9 cylinder fixes: the well quad fades to nothing well inside its own bounds with no hard circle
// and nothing darker than the background, and every layer tied to an owner (well glints and motes,
// the nova snake core line, the chainsaw teeth and chain) stays on its owner through the drum.
import { readFileSync } from 'node:fs';
import { Container, Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { drumAffineAt, drumProject, makeDrum, type DrumPoint } from '../../src/render/drum';
import {
  createDrumPen,
  penBegin,
  penCircle,
  penClose,
  penFill,
  penLineTo,
  penMoveTo,
  penOwner,
  penOwnerLineTo,
  penOwnerMoveTo,
  penStroke,
  penX,
  penY,
  type PathSink,
  type PenFill,
  type PenStroke,
} from '../../src/render/drumPen';
import { computePalette } from '../../src/render/neon';
import { spikeHalfWidth, spikeStretch, spikeTriangle } from '../../src/render/spikeSaw';
import { createTiltScene } from '../../src/render/tiltScene';
import { FLUID_CLEAR, FLUID_FRAGMENT, FLUID_HAZE, FLUID_VERTEX, FLUID_VISUAL, fluidGasEdge, fluidHaze } from '../../src/render/wellFluid';
import { NOVA_WHITE, novaGlintSpot, novaStreamColour, novaWhite, novaCycleStops, NOVA_HUES } from '../../src/render/wellNova';

/** HSL lightness 0 to 1 of 0xRRGGBB. */
function lightness(c: number): number {
  const r = ((c >> 16) & 255) / 255;
  const g = ((c >> 8) & 255) / 255;
  const b = (c & 255) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/** A recording sink: every point written, every circle and the last styles. */
class Rec implements PathSink {
  pts: number[] = [];
  circles: number[] = [];
  fills: PenFill[] = [];
  strokes: PenStroke[] = [];
  moveTo(x: number, y: number): this {
    this.pts.push(x, y);
    return this;
  }
  lineTo(x: number, y: number): this {
    this.pts.push(x, y);
    return this;
  }
  circle(x: number, y: number, r: number): this {
    this.circles.push(x, y, r);
    return this;
  }
  closePath(): this {
    return this;
  }
  fill(s: PenFill): this {
    this.fills.push({ ...s });
    return this;
  }
  stroke(s: PenStroke): this {
    this.strokes.push({ ...s });
    return this;
  }
}

const W = 1600;
const H = 900;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });

describe('G9 well quad: no hard edged circle, no dark fringe', () => {
  it('is fully transparent from at least 10 percent inside the quad edge and at the edge itself', () => {
    expect(FLUID_CLEAR).toBeLessThanOrEqual(0.9);
    for (let r = 0.9; r <= 1.0001; r += 0.01) {
      expect(fluidHaze(r)).toBe(0);
      expect(fluidGasEdge(r)).toBe(0);
    }
    // The shader clears from FLUID_CLEAR out, before any gas or haze maths.
    expect(FLUID_FRAGMENT).toMatch(/if \(r0 >= 0\.86\) \{\s*finalColor = vec4\(0\.0\);/);
    expect(FLUID_FRAGMENT).not.toMatch(/r0 >= 1\.0/);
  });

  it('the visible alpha envelope (gas over haze) has no step anywhere from the core to the clear radius', () => {
    // The gas cover is at most 1 times its edge fade; the haze sits under it ("over" compositing).
    // The old GW6 envelope jumped from about 0 to 0.15 at the disc rim; now every step is small.
    const N = 2000;
    let prev = -1;
    let maxStep = 0;
    for (let i = 0; i <= N; i++) {
      const r = i / N;
      const gas = fluidGasEdge(r) * 0.3;
      const a = gas + fluidHaze(r) * (1 - gas);
      if (prev >= 0) maxStep = Math.max(maxStep, Math.abs(a - prev));
      prev = a;
    }
    expect(maxStep).toBeLessThan(0.005);
    // Right at the disc rim the haze is continuous and flat.
    expect(Math.abs(fluidHaze(FLUID_VISUAL - 1e-4) - fluidHaze(FLUID_VISUAL + 1e-4))).toBeLessThan(1e-4);
    expect(fluidHaze(0.3)).toBeCloseTo(FLUID_HAZE, 6);
  });

  it('writes premultiplied colour (light over the haze, never a dark clear) and honours the drum back alpha', () => {
    expect(FLUID_FRAGMENT).toMatch(/vec4 haze = vec4\(uWhite \* ha, ha\);/);
    expect(FLUID_FRAGMENT).toMatch(/finalColor = \(gasC \+ haze \* \(1\.0 - a\)\) \* ka;/);
    expect(FLUID_FRAGMENT).not.toMatch(/vec4\(0\.0, 0\.0, 0\.0, [^0)]/);
    expect(FLUID_VERTEX).toMatch(/vAlpha = uColor\.a \* uWorldColorAlpha\.a;/);
    expect(FLUID_FRAGMENT).toMatch(/float ka = clamp\(uAlpha \* vAlpha, 0\.0, 1\.0\);/);
  });

  it('every colour the well path paints is at least 30 percent lightness, so nothing is darker than the background', () => {
    for (const sat of [0.6, 1, 1.3]) {
      const pal = computePalette(sat);
      const stops = novaCycleStops(pal, new Uint32Array(NOVA_HUES));
      const colours: number[] = [NOVA_WHITE, 0xffffff, pal.cyan, pal.magenta, pal.yellow, pal.blue];
      for (let k = 0; k <= 10; k++) colours.push(novaWhite(pal.red, k / 10));
      for (let k = 0; k < 16; k++) for (const t of [0, 0.4, 1.3]) for (const sh of [0, 0.5, 1]) colours.push(novaStreamColour(stops, pal.red, k, t, sh));
      for (const c of colours) expect(lightness(c)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('nothing in the well path strokes an outline at the pull radius', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function drawNova(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).not.toMatch(/penCircle\(g, x, y, (reach|pullR)/);
    expect(body).not.toMatch(/penStroke\([^)]*(reach|pullR)/);
  });
});

describe('G9 drum attachment pen', () => {
  it('flat levels: the identity, so the off and tilt paths draw exactly as before', () => {
    const rec = new Rec();
    const p = penOwner(penBegin(createDrumPen(), rec, null), 120, -40);
    penMoveTo(p, 130, -35);
    penCircle(p, 125, -40, 6);
    penStroke(p, 2, 0xffffff, 0.5, 'round', 'round');
    expect(rec.pts).toEqual([130, -35]);
    expect(rec.circles).toEqual([125, -40, 6]);
    expect(rec.strokes[0]).toMatchObject({ width: 2, alpha: 0.5, cap: 'round', join: 'round' });
  });

  it('a glint at the well moves with the well through a full drum rotation (within 1 px of the drum mapping)', () => {
    const d = makeDrum(W, H, 0);
    const p = createDrumPen();
    const rec = new Rec();
    const well = { u: 300, v: -120 };
    const g = novaGlintSpot(0.3, 0.6, 2.4, 9, 140 * 0.65, { x: 0, y: 0 });
    const o = P();
    for (let k = 0; k < 64; k++) {
      d.camU = -W / 2 + (k / 64) * W;
      penOwner(penBegin(p, rec, d), well.u, well.v);
      drumProject(well.u, well.v, 0, d, o);
      // The owner itself lands exactly on its drum image.
      expect(Math.abs(penX(p, well.u) - o.x)).toBeLessThan(1);
      expect(Math.abs(penY(p, well.v) - o.y)).toBeLessThan(1);
      // The glint sits at its flow offset scaled by the well's depth (mirrored on the back half).
      expect(Math.abs(penX(p, well.u + g.x) - (o.x + g.x * o.s * o.m))).toBeLessThan(1);
      expect(Math.abs(penY(p, well.v + g.y) - (o.y + g.y * o.s))).toBeLessThan(1);
      // So it never gets further from the well than its own offset (the linearised pass stretched u by pi).
      const dist = Math.hypot(penX(p, well.u + g.x) - o.x, penY(p, well.v + g.y) - o.y);
      expect(dist).toBeLessThanOrEqual(Math.hypot(g.x, g.y) * o.s + 1);
    }
  });

  it('a well across the seam still keeps its glints next to it (short wrapped offset)', () => {
    const d = makeDrum(W, H, 0);
    d.camU = W / 2 - 10;
    const p = penOwner(penBegin(createDrumPen(), new Rec(), d), W / 2 - 5, 0);
    const o = drumProject(W / 2 - 5, 0, 0, d, P());
    // A glint 20 u to the right of the well, written as its canonical u across the seam.
    expect(Math.abs(penX(p, -W / 2 + 15) - (o.x + 20 * o.s * o.m))).toBeLessThan(1e-6);
  });

  it('a snake core point is placed through the drum from its own position at every camera u', () => {
    const d = makeDrum(W, H, 0);
    const p = createDrumPen();
    const pts = [-700, 40, -760, 60, -790, 100];
    const o = P();
    for (let k = 0; k < 48; k++) {
      d.camU = -W / 2 + (k / 48) * W;
      const rec = new Rec();
      penBegin(p, rec, d);
      penOwnerMoveTo(p, pts[0] ?? 0, pts[1] ?? 0);
      penOwnerLineTo(p, pts[2] ?? 0, pts[3] ?? 0);
      penOwnerLineTo(p, pts[4] ?? 0, pts[5] ?? 0);
      for (let q = 0; q < 3; q++) {
        drumProject(pts[q * 2] ?? 0, pts[q * 2 + 1] ?? 0, 0, d, o);
        expect(Math.abs((rec.pts[q * 2] ?? 0) - o.x)).toBeLessThan(1);
        expect(Math.abs((rec.pts[q * 2 + 1] ?? 0) - o.y)).toBeLessThan(1);
      }
    }
  });

  it('an orbit spike moves with the ship through a full rotation and keeps its flat orbit radius times the depth', () => {
    const d = makeDrum(W, H, 0);
    const p = createDrumPen();
    const ship = { u: 50, v: 80 };
    const R = 70;
    const o = P();
    for (let k = 0; k < 64; k++) {
      const camU = -W / 2 + (k / 64) * W;
      d.camU = camU;
      const ph = k * 0.37;
      const sx = ship.u + Math.cos(ph) * R;
      const sy = ship.v + Math.sin(ph) * R;
      penOwner(penBegin(p, new Rec(), d), ship.u, ship.v);
      drumProject(ship.u, ship.v, 0, d, o);
      expect(Math.abs(penX(p, sx) - (o.x + Math.cos(ph) * R * o.s * o.m))).toBeLessThan(1);
      expect(Math.abs(penY(p, sy) - (o.y + Math.sin(ph) * R * o.s))).toBeLessThan(1);
      expect(Math.abs(Math.hypot(penX(p, sx) - o.x, penY(p, sy) - o.y) - R * o.s)).toBeLessThan(1);
    }
  });

  it('the saw on the drum front is within 10 percent of its flat size (the old linearised pass was about pi wide)', () => {
    const d = makeDrum(W, H, 0);
    const ship = { u: 200, v: 0 };
    d.camU = ship.u;
    const p = penOwner(penBegin(createDrumPen(), new Rec(), d), ship.u, ship.v);
    const len = 30;
    const st = spikeStretch(len);
    const tri = spikeTriangle(ship.u + 70, ship.v, 0, 1, len, spikeHalfWidth(st), new Float32Array(6));
    const flatW = Math.max(tri[0] ?? 0, tri[2] ?? 0, tri[4] ?? 0) - Math.min(tri[0] ?? 0, tri[2] ?? 0, tri[4] ?? 0);
    const flatH = Math.max(tri[1] ?? 0, tri[3] ?? 0, tri[5] ?? 0) - Math.min(tri[1] ?? 0, tri[3] ?? 0, tri[5] ?? 0);
    const xs = [penX(p, tri[0] ?? 0), penX(p, tri[2] ?? 0), penX(p, tri[4] ?? 0)];
    const ys = [penY(p, tri[1] ?? 0), penY(p, tri[3] ?? 0), penY(p, tri[5] ?? 0)];
    const dw = Math.max(...xs) - Math.min(...xs);
    const dh = Math.max(...ys) - Math.min(...ys);
    expect(dw / flatW).toBeGreaterThan(0.9);
    expect(dw / flatW).toBeLessThan(1.1);
    expect(dh / flatH).toBeGreaterThan(0.9);
    expect(dh / flatH).toBeLessThan(1.1);
    // The orbit radius too: a tooth 70 u right of the ship draws 70 u (times the depth) right of it.
    const o = drumProject(ship.u, ship.v, 0, d, P());
    expect((penX(p, ship.u + 70) - o.x) / 70).toBeGreaterThan(0.9);
    expect((penX(p, ship.u + 70) - o.x) / 70).toBeLessThan(1.1);
    // What the G9 report saw: the old one transform linearisation stretched u about pi times.
    const aff = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    drumAffineAt(ship.u, ship.v, d, aff);
    expect(aff.a).toBeGreaterThan(3);
  });

  it('back half paths dim like billboards; stroke widths follow the owner depth; no per call allocation of styles', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 0;
    const rec = new Rec();
    const p = penBegin(createDrumPen(), rec, d);
    penOwner(p, W / 2 - 1, 0);
    penMoveTo(p, W / 2 - 1, 0);
    penLineTo(p, W / 2 - 1, 10);
    penClose(p);
    penFill(p, 0xffffff, 0.8);
    expect(rec.fills[0]?.alpha).toBeCloseTo(0.8 * 0.25, 6);
    penOwner(p, 0, 0);
    penMoveTo(p, 0, 0);
    penLineTo(p, 5, 0);
    penStroke(p, 4, 0xffffff, 1);
    const o = drumProject(0, 0, 0, d, P());
    expect(rec.strokes[0]?.width).toBeCloseTo(4 * o.s, 6);
    expect(rec.strokes[0]?.alpha).toBe(1);
    expect(p.fillStyle).toBe(p.fillStyle);
    const src = readFileSync(new URL('../../src/render/drumPen.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('export function penBegin'));
    expect(body).not.toMatch(/new |\[\]|\{ color|\{ width/);
  });
});

describe('G9 tilt scene: drum drawn Graphics are left alone on the drum, projected on a tilt', () => {
  it('skips them in projectDrum and keeps the walk aligned for restore', () => {
    const entities = new Container();
    const free = new Graphics();
    free.circle(400, 100, 30).fill({ color: 0xffffff });
    const pre = new Graphics();
    pre.circle(-300, 50, 30).fill({ color: 0xffffff });
    entities.addChild(free, pre);
    const tilt = createTiltScene({ billboardParents: [entities], particles: [], freeform: [free, pre], drumDrawn: [pre] });
    const d = makeDrum(W, H, 20);
    d.camU = 100;
    tilt.projectDrum(d);
    pre.updateLocalTransform();
    expect(pre.localTransform.a).toBe(1);
    expect(pre.localTransform.tx).toBe(0);
    free.updateLocalTransform();
    expect(free.localTransform.a).not.toBe(1);
    tilt.restore();
    free.updateLocalTransform();
    expect(free.localTransform.a).toBe(1);
    expect(free.position.x).toBe(0);
  });

  it('the renderer lists the well layer, the snake glints and the saw as drum drawn', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/drumDrawn: \[sawG, novaG, snakeG,/);
    // The camera u moves before any draw, so pen and scene pass agree on it.
    const i = src.indexOf('function draw(w: World');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body.indexOf('followCamU')).toBeLessThan(body.indexOf('drawEntities('));
  });
});
