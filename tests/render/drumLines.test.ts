// G10 drum lines: every free form line effect on a cylinder goes through the drum sample by sample
// (Charger lanes, chevrons and streaks, shock rings, wall flashes) or owner by owner (pops, Blink
// and Slime rings, drone glyphs, Tempestling arcs, the boss identity layers), so nothing is drawn
// through the one linearised transform per Graphics any more. Plus the obstacle cache proxy.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BACK_ALPHA,
  DRUM_CAM_BUCKET_U,
  drumCamBucket,
  drumProject,
  drumRectSegs,
  drumRectSegsInto,
  fitDrum,
  followCamU,
  makeDrum,
  type Drum,
  type DrumPoint,
} from '../../src/render/drum';
import {
  BACK_CULL_A,
  DRUM_SAMPLE_U,
  RING_MAX_STEPS,
  RING_MIN_STEPS,
  backCulled,
  createDrumPen,
  createPenTrace,
  penBegin,
  penFillTrace,
  penOwner,
  penOwnerMatrix,
  penStrokeTrace,
  penX,
  penY,
  ringSteps,
  traceArc,
  traceLine,
  tracePoint,
  traceRay,
  traceReset,
  traceRing,
  type PathSink,
  type PenAffine,
  type PenFill,
  type PenStroke,
} from '../../src/render/drumPen';
import { wallPasses } from '../../src/render/grid';

/** A recording sink: every subpath as a list of points, plus the styles. */
class Rec implements PathSink {
  paths: number[][] = [];
  pathsAtStroke: number[][][] = [];
  fills: PenFill[] = [];
  strokes: PenStroke[] = [];
  cmds = 0;
  private cur: number[][] = [];
  moveTo(x: number, y: number): this {
    this.cur.push([x, y]);
    this.cmds++;
    return this;
  }
  lineTo(x: number, y: number): this {
    const last = this.cur[this.cur.length - 1];
    if (last) last.push(x, y);
    else this.cur.push([x, y]);
    this.cmds++;
    return this;
  }
  circle(x: number, y: number, r: number): this {
    this.cur.push([x, y, r]);
    this.cmds++;
    return this;
  }
  closePath(): this {
    return this;
  }
  fill(s: PenFill): this {
    this.fills.push({ ...s });
    this.paths.push(...this.cur);
    this.cur = [];
    return this;
  }
  stroke(s: PenStroke): this {
    this.strokes.push({ ...s });
    this.pathsAtStroke.push(this.cur);
    this.paths.push(...this.cur);
    this.cur = [];
    return this;
  }
}

const W = 1600;
const H = 900;
const P = (): DrumPoint => ({ x: 0, y: 0, s: 1, a: 1, m: 1 });
/** Device px per drum screen unit on the Fold 7 main screen (landscape safe rect). */
function pxScale(d: Drum): number {
  return fitDrum(d, { x: 0, y: 0, w: 2184, h: 1968 }).scale;
}

describe('G10 Charger lane on the drum', () => {
  it('matches the drum mapping of its sample points (every 24 u from the Charger) within 1 px through a full rotation', () => {
    const d = makeDrum(W, H, 0);
    const px = pxScale(d);
    const pen = createDrumPen();
    const t = createPenTrace(4);
    const q = P();
    const cx = 210;
    const cy = -80;
    const a = 0.6;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const len = 600;
    let worst = 0;
    for (let k = 0; k < 96; k++) {
      d.camU = -W / 2 + (k / 96) * W;
      const rec = new Rec();
      penBegin(pen, rec, d);
      // Exactly the renderer's centre line: from 16 u ahead of the Charger to the lane end.
      traceRay(pen, traceReset(t), cx, cy, dx, dy, 16, len);
      const dists: number[] = [];
      for (let s = 16; s < len; s += DRUM_SAMPLE_U) dists.push(s);
      dists.push(len);
      expect(t.n).toBe(dists.length);
      for (let i = 0; i < t.n; i++) {
        const s = dists[i] ?? 0;
        drumProject(cx + dx * s, cy + dy * s, 0, d, q);
        const ex = Math.hypot((t.pts[2 * i] ?? 0) - q.x, (t.pts[2 * i + 1] ?? 0) - q.y) * px;
        if (ex > worst) worst = ex;
        expect(t.front[i]).toBe(q.a === 1 ? 1 : 0);
      }
      // What reaches the Graphics is exactly those points (front and back runs share the rim segment).
      penStrokeTrace(pen, t, 2, 0xff8800, 1, 'round');
      const drawn = new Set<string>();
      for (const sub of rec.paths) for (let i = 0; i + 1 < sub.length; i += 2) drawn.add(`${sub[i]},${sub[i + 1]}`);
      for (let i = 0; i < t.n; i++) {
        if (t.front[i] === 1 || !backCulled(1)) expect(drawn.has(`${t.pts[2 * i]},${t.pts[2 * i + 1]}`)).toBe(true);
      }
    }
    expect(worst).toBeLessThan(1);
  });

  it('bends round the drum: the samples of a long lane are not collinear on screen', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 0;
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace();
    traceRay(pen, t, -100, 0, 1, 0, 0, 600);
    const x0 = t.pts[0] ?? 0;
    const xm = t.pts[2 * Math.floor(t.n / 2)] ?? 0;
    const x1 = t.pts[2 * (t.n - 1)] ?? 0;
    // Equal arena steps shrink on screen toward the side of the drum.
    expect(xm - x0).toBeGreaterThan(x1 - xm);
  });

  it('follows the drum as it turns: the lane start stays on the Charger image', () => {
    const d = makeDrum(W, H, 0);
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace();
    const q = P();
    for (let k = 0; k < 48; k++) {
      d.camU = followCamU(d.camU, 700, 1 / 60, W);
      traceRay(pen, traceReset(t), 300, 40, 0, 1, 0, 200);
      drumProject(300, 40, 0, d, q);
      expect(Math.abs((t.pts[0] ?? 0) - q.x)).toBeLessThan(1e-9);
      expect(Math.abs((t.pts[1] ?? 0) - q.y)).toBeLessThan(1e-9);
    }
  });

  it('flat: a ray is exactly its two end points, one stroke with the given style', () => {
    const rec = new Rec();
    const pen = penBegin(createDrumPen(), rec, null);
    const t = createPenTrace();
    traceRay(pen, t, 10, 20, 0.6, 0.8, -8, -100);
    expect(t.n).toBe(2);
    expect([t.pts[0], t.pts[1], t.pts[2], t.pts[3]]).toEqual([10 - 0.6 * 8, 20 - 0.8 * 8, 10 - 60, 20 - 80]);
    penStrokeTrace(pen, t, 4, 0x123456, 0.7, 'round');
    expect(rec.strokes).toEqual([{ width: 4, color: 0x123456, alpha: 0.7, cap: 'round', join: 'miter' }]);
    expect(rec.paths).toEqual([[10 - 0.6 * 8, 20 - 0.8 * 8, 10 - 60, 20 - 80]]);
  });

  it('the lane band fill is one closed polygon along both rails', () => {
    const d = makeDrum(W, H, 0);
    const rec = new Rec();
    const pen = penBegin(createDrumPen(), rec, d);
    const t = createPenTrace();
    traceRay(pen, t, 0, 15, 1, 0, 16, 300);
    const half = t.n;
    traceRay(pen, t, 0, -15, 1, 0, 300, 16);
    expect(t.n).toBe(half * 2);
    penFillTrace(pen, t, 0xff8800, 0.2);
    expect(rec.fills).toEqual([{ color: 0xff8800, alpha: 0.2 }]);
    expect(rec.paths[0]?.length).toBe(t.n * 2);
  });
});

describe('G10 shock ring on the drum', () => {
  it('stays centred on its owner through a full rotation', () => {
    const d = makeDrum(W, H, 0);
    const px = pxScale(d);
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace();
    const o = P();
    const q = P();
    const r = 140;
    const n = ringSteps(r);
    // The centring checks below need samples at the quarter turns.
    expect(n % 4).toBe(0);
    for (let k = 0; k < 96; k++) {
      d.camU = -W / 2 + (k / 96) * W;
      const cx = 333;
      traceRing(pen, traceReset(t), cx, 0, r);
      expect(t.n).toBe(n + 1);
      drumProject(cx, 0, 0, d, o);
      // Every sample is the drum image of the ring point on the surface round the owner.
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 * Math.PI;
        drumProject(cx + Math.cos(a) * r, Math.sin(a) * r, 0, d, q);
        expect(Math.hypot((t.pts[2 * i] ?? 0) - q.x, (t.pts[2 * i + 1] ?? 0) - q.y) * px).toBeLessThan(1);
      }
      // The ring points straight above and below the owner share its screen x, and the ones level
      // with it (same height on the drum) share its screen y: the ring is centred on the owner.
      const top = n / 4;
      const bottom = (3 * n) / 4;
      if (Number.isInteger(top)) {
        expect(Math.abs((t.pts[2 * top] ?? 0) - o.x) * px).toBeLessThan(1);
        expect(Math.abs((t.pts[2 * bottom] ?? 0) - o.x) * px).toBeLessThan(1);
      }
      expect(Math.abs((t.pts[1] ?? 0) - o.y) * px).toBeLessThan(1);
      if (n % 2 === 0) expect(Math.abs((t.pts[n + 1] ?? 0) - o.y) * px).toBeLessThan(1);
    }
    // At the front centre the screen bounds are centred on the owner too.
    d.camU = 333;
    traceRing(pen, traceReset(t), 333, 0, r);
    drumProject(333, 0, 0, d, o);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < t.n; i++) {
      minX = Math.min(minX, t.pts[2 * i] ?? 0);
      maxX = Math.max(maxX, t.pts[2 * i] ?? 0);
    }
    expect(Math.abs((minX + maxX) / 2 - o.x) * px).toBeLessThan(1);
  });

  it('ring sample counts stay in their bounds and follow the circumference', () => {
    expect(ringSteps(0)).toBe(RING_MIN_STEPS);
    expect(ringSteps(1e6)).toBe(RING_MAX_STEPS);
    expect(ringSteps(200)).toBe(Math.ceil(Math.ceil((2 * Math.PI * 200) / DRUM_SAMPLE_U) / 4) * 4);
    for (const r of [0, 33, 140, 333, 9999]) expect(ringSteps(r) % 4).toBe(0);
  });

  it('an arc (wall flash) samples between its angles', () => {
    const d = makeDrum(W, H, 0);
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace();
    const q = P();
    traceArc(pen, t, 50, 60, 100, 0.2, 1.4);
    drumProject(50 + Math.cos(1.4) * 100, 60 + Math.sin(1.4) * 100, 0, d, q);
    expect(t.pts[2 * (t.n - 1)]).toBeCloseTo(q.x, 9);
    expect(t.n).toBeGreaterThanOrEqual(3);
  });
});

describe('G10 trace strokes: back half dimmed or culled, widths by depth', () => {
  it('splits front and back runs; the back draws at BACK_ALPHA and is culled below BACK_CULL_A', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 0;
    const t = createPenTrace();
    // From the front centre right round to the back.
    let rec = new Rec();
    let pen = penBegin(createDrumPen(), rec, d);
    traceRay(pen, t, 0, 0, 1, 0, 0, W * 0.75);
    expect(t.sFront).toBeGreaterThan(0);
    expect(t.sBack).toBeGreaterThan(0);
    expect(t.sBack).toBeLessThan(t.sFront);
    penStrokeTrace(pen, t, 3, 0xffffff, 1);
    expect(rec.strokes.length).toBe(2);
    expect(rec.strokes[0]?.alpha).toBe(1);
    expect(rec.strokes[0]?.width).toBeCloseTo(3 * t.sFront, 12);
    expect(rec.strokes[1]?.alpha).toBeCloseTo(BACK_ALPHA, 12);
    expect(rec.strokes[1]?.width).toBeCloseTo(3 * t.sBack, 12);
    // A faint line: the back run is skipped entirely.
    rec = new Rec();
    pen = penBegin(createDrumPen(), rec, d);
    const faint = (BACK_CULL_A / BACK_ALPHA) * 0.9;
    expect(backCulled(faint)).toBe(true);
    penStrokeTrace(pen, t, 3, 0xffffff, faint);
    expect(rec.strokes.length).toBe(1);
    expect(rec.strokes[0]?.alpha).toBe(faint);
  });

  it('the front and back runs meet at the rim (the crossing segment is in both)', () => {
    const d = makeDrum(W, H, 0);
    const rec = new Rec();
    const pen = penBegin(createDrumPen(), rec, d);
    const t = createPenTrace();
    traceRay(pen, t, 0, 0, 1, 0, 0, W * 0.4);
    penStrokeTrace(pen, t, 2, 0xffffff, 1);
    const front = rec.pathsAtStroke[0]?.[0] ?? [];
    const back = rec.pathsAtStroke[1]?.[0] ?? [];
    expect(front.slice(-4)).toEqual(back.slice(0, 4));
  });

  it('a surface segment drawn across the seam takes the short way', () => {
    const d = makeDrum(W, H, 0);
    d.camU = W / 2 - 10;
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace();
    traceLine(pen, t, W / 2 - 30, 0, -W / 2 + 30, 0);
    // 60 u the short way: three samples at most, all near the front centre.
    expect(t.n).toBeLessThanOrEqual(4);
    for (let i = 0; i < t.n; i++) expect(Math.abs(t.pts[2 * i] ?? 0)).toBeLessThan(200);
  });

  it('a chevron is three surface points, each the drum image of its arena point', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 100;
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const t = createPenTrace(2);
    const q = P();
    const pts = [400, 10, 409, 0, 400, -10];
    for (let i = 0; i < 3; i++) tracePoint(pen, t, pts[2 * i] ?? 0, pts[2 * i + 1] ?? 0);
    for (let i = 0; i < 3; i++) {
      drumProject(pts[2 * i] ?? 0, pts[2 * i + 1] ?? 0, 0, d, q);
      expect(t.pts[2 * i]).toBe(q.x);
      expect(t.pts[2 * i + 1]).toBe(q.y);
    }
  });

  it('a trace grows past its capacity without losing points', () => {
    const pen = penBegin(createDrumPen(), new Rec(), makeDrum(W, H, 0));
    const t = createPenTrace(4);
    traceRay(pen, t, 0, 0, 1, 0, 0, 2000);
    expect(t.n).toBe(Math.ceil(2000 / DRUM_SAMPLE_U) + 1);
    expect(t.pts.length).toBeGreaterThanOrEqual(t.n * 2);
  });
});

describe('G10 boss layers follow the boss as a billboard', () => {
  it('penOwnerMatrix maps like penX and penY, front and back', () => {
    const d = makeDrum(W, H, 12);
    const pen = penBegin(createDrumPen(), new Rec(), d);
    const m: PenAffine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    for (const camU of [0, 400, -700]) {
      d.camU = camU;
      penOwner(pen, 120, -60);
      const alpha = penOwnerMatrix(pen, m);
      expect(alpha).toBe(pen.own.a);
      for (const [x, y] of [
        [150, -40],
        [90, -100],
      ] as const) {
        expect(m.a * x + m.c * y + m.tx).toBeCloseTo(penX(pen, x), 9);
        expect(m.b * x + m.d * y + m.ty).toBeCloseTo(penY(pen, y), 9);
      }
    }
  });
});

describe('G10 renderer wiring', () => {
  const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
  const list = (key: string): string[] => {
    const m = new RegExp(`${key}: \\[([^\\]]*)\\]`).exec(src);
    return (m?.[1] ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  };

  it('every free form Graphics is drawn through the drum, so the drum pass linearises none', () => {
    const free = list('freeform');
    const drawn = new Set(list('drumDrawn'));
    expect(free.length).toBeGreaterThan(10);
    for (const g of free) expect(drawn.has(g)).toBe(true);
  });

  it('the Charger lane, chevrons and streak are sampled on the surface, not drawn straight into enemyFx', () => {
    const i = src.indexOf('function drawChargerLane');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/traceRay\(/);
    expect(body).toMatch(/tracePoint\(/);
    expect(body).not.toMatch(/enemyFx\s*\./);
    expect(src).toMatch(/fxRay\(ev\.x, ev\.y, dx, dy, -8, -len/);
  });

  it('the obstacle outlines are cached per camera u bucket', () => {
    const i = src.indexOf('function drawDrumObstacles');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/drumCamBucket\(d\.camU\)/);
    expect(body).toMatch(/backCulled\(/);
  });
});

describe('G10 perf: obstacle outlines', () => {
  it('drumRectSegsInto appends what drumRectSegs builds, and the bucket is stable inside a bucket', () => {
    const d = makeDrum(W, H, 0);
    d.camU = 37;
    const f1: number[] = [];
    const b1: number[] = [];
    const f2: number[] = [];
    const b2: number[] = [];
    drumRectSegs(d, -100, -50, 200, 80, f1, b1);
    const fa = [...f1];
    const ba = [...b1];
    drumRectSegs(d, 500, 100, 120, 60, f1, b1);
    drumRectSegsInto(d, -100, -50, 200, 80, f2, b2);
    drumRectSegsInto(d, 500, 100, 120, 60, f2, b2);
    expect(f2).toEqual([...fa, ...f1]);
    expect(b2).toEqual([...ba, ...b1]);
    expect(drumCamBucket(10)).toBe(drumCamBucket(10 + DRUM_CAM_BUCKET_U * 0.4));
    expect(drumCamBucket(10)).not.toBe(drumCamBucket(10 + DRUM_CAM_BUCKET_U));
  });

  it('timing proxy: 12 obstacles over a 10 s fly then hover, before and after', () => {
    const d = makeDrum(W, H, 0);
    const obstacles = Array.from({ length: 12 }, (_, k) => ({ cx: -W / 2 + k * 133, cy: ((k % 3) - 1) * 250, w: 90 + (k % 4) * 30, h: 60 }));
    const crisp = wallPasses(0.6, 1, 1, 'crisp');
    const soft = wallPasses(0.6, 1, 1, 'bloom');
    const front: number[] = [];
    const back: number[] = [];
    const frames = 600;
    const shipU = (f: number): number => (f < 240 ? -W / 2 + f * 5 : -W / 2 + 240 * 5);
    // Before: the G9 loop (every frame, per obstacle, a style object per stroke).
    const before = (rec: Rec): void => {
      d.camU = 0;
      for (let f = 0; f < frames; f++) {
        d.camU = followCamU(d.camU, shipU(f), 1 / 60, W);
        for (const o of obstacles) {
          drumRectSegs(d, o.cx - o.w / 2, o.cy - o.h / 2, o.w, o.h, front, back);
          for (const passes of [crisp, soft]) {
            for (const pass of passes) {
              for (const [segs, a] of [
                [back, pass.alpha * BACK_ALPHA],
                [front, pass.alpha],
              ] as const) {
                if (segs.length < 4) continue;
                for (let i = 0; i + 3 < segs.length; i += 4) rec.moveTo(segs[i] ?? 0, segs[i + 1] ?? 0).lineTo(segs[i + 2] ?? 0, segs[i + 3] ?? 0);
                rec.stroke({ width: pass.width, color: 0xffffff, alpha: a, cap: 'round', join: 'round' });
              }
            }
          }
        }
      }
    };
    // After: G10 (bucket cache, one list pair, one stroke per pass, faint back passes culled).
    const style = { width: 1, color: 0xffffff, alpha: 1, cap: 'round' as const, join: 'round' as const };
    const strokeSegs = (rec: Rec, segs: readonly number[], width: number, a: number): void => {
      if (segs.length < 4) return;
      for (let i = 0; i + 3 < segs.length; i += 4) rec.moveTo(segs[i] ?? 0, segs[i + 1] ?? 0).lineTo(segs[i + 2] ?? 0, segs[i + 3] ?? 0);
      style.width = width;
      style.alpha = a;
      rec.stroke(style);
    };
    let rebuilds = 0;
    const after = (rec: Rec): void => {
      d.camU = 0;
      let key = Number.NaN;
      for (let f = 0; f < frames; f++) {
        d.camU = followCamU(d.camU, shipU(f), 1 / 60, W);
        const k = drumCamBucket(d.camU);
        if (k === key) continue;
        key = k;
        rebuilds++;
        front.length = 0;
        back.length = 0;
        for (const o of obstacles) drumRectSegsInto(d, o.cx - o.w / 2, o.cy - o.h / 2, o.w, o.h, front, back);
        for (const passes of [crisp, soft]) {
          for (const pass of passes) {
            if (!backCulled(pass.alpha)) strokeSegs(rec, back, pass.width, pass.alpha * BACK_ALPHA);
            strokeSegs(rec, front, pass.width, pass.alpha);
          }
        }
      }
    };
    const run = (fn: (r: Rec) => void): { ms: number; cmds: number; strokes: number } => {
      fn(new Rec());
      const reps = 3;
      let cmds = 0;
      let strokes = 0;
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) {
        const rec = new Rec();
        fn(rec);
        cmds = rec.cmds;
        strokes = rec.strokes.length;
      }
      return { ms: (performance.now() - t0) / reps / frames, cmds: cmds / frames, strokes: strokes / frames };
    };
    const b = run(before);
    rebuilds = 0;
    const a = run(after);
    const perRun = rebuilds / 4;
    console.log(
      `[drum] obstacle proxy per frame: before ${b.ms.toFixed(4)} ms, ${b.cmds.toFixed(0)} path cmds, ${b.strokes.toFixed(1)} strokes; ` +
        `after ${a.ms.toFixed(4)} ms, ${a.cmds.toFixed(0)} path cmds, ${a.strokes.toFixed(1)} strokes; rebuilds ${perRun} of ${frames} frames`,
    );
    expect(a.cmds).toBeLessThan(b.cmds);
    expect(a.strokes).toBeLessThan(b.strokes / 4);
    expect(perRun).toBeLessThan(frames);
  });
});

describe('G10 perf: sampled lines cost', () => {
  it('timing proxy: 6 Charger lanes and 8 shock rings per frame through the drum', () => {
    const d = makeDrum(W, H, 0);
    const rec = new Rec();
    const pen = penBegin(createDrumPen(), rec, d);
    const t = createPenTrace();
    const frame = (f: number): void => {
      d.camU = followCamU(d.camU, -W / 2 + f * 5, 1 / 60, W);
      rec.paths.length = 0;
      rec.pathsAtStroke.length = 0;
      rec.strokes.length = 0;
      rec.fills.length = 0;
      for (let c = 0; c < 6; c++) {
        const a = c * 1.1;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const x = -600 + c * 200;
        traceReset(t);
        traceRay(pen, t, x - dy * 15, dx * 15, dx, dy, 16, 600);
        traceRay(pen, t, x + dy * 15, -dx * 15, dx, dy, 600, 16);
        penFillTrace(pen, t, 0xff8800, 0.2);
        for (let line = 0; line < 3; line++) {
          traceRay(pen, traceReset(t), x, 0, dx, dy, 16, 600);
          for (let pass = 0; pass < 3; pass++) penStrokeTrace(pen, t, 2, 0xff8800, 0.8, 'round');
        }
      }
      for (let r = 0; r < 8; r++) {
        traceRing(pen, traceReset(t), -700 + r * 180, 50, 20 + ((f + r * 7) % 36) * 28);
        for (let pass = 0; pass < 3; pass++) penStrokeTrace(pen, t, 6, 0xffffff, 0.8);
      }
    };
    for (let f = 0; f < 60; f++) frame(f);
    const frames = 600;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) frame(f);
    const ms = (performance.now() - t0) / frames;
    console.log(`[drum] sampled lines proxy: ${ms.toFixed(4)} ms per frame for 6 lanes and 8 rings (CPU side, headless)`);
    expect(ms).toBeLessThan(5);
  });
});
