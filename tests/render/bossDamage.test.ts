// Look v33 boss battle damage (GW1): damage by incompleteness. The arc table, the clip of the body
// spec, the damage colours (never darker than DAMAGE_MIN_L), and source guards that no erase or
// multiply blend exists in src/render and the damage draw uses only the damage colours.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  arcShare,
  BREAK_ARCS,
  BREAK_ARCS_MAX,
  BREAK_MIN_R,
  BREAK_SHARE,
  breakArcs,
  brighten,
  clipPrim,
  DAMAGE_MIN_L,
  damageColours,
  damagedSpec,
  DETACH_ARC,
  EDGE_FLICKER,
  EDGE_HUE_SHIFT,
  edgeFlicker,
  inArcs,
  lightnessOf,
  noiseAt,
  NOISE_SIZE,
  rgbToHsl,
  shiftHueToward,
  specOuterRadius,
  STUB_BRIGHT,
} from '../../src/render/bossDamage';
import { BOSS_COUNT, bossColourOf } from '../../src/render/bossLook';
import { BOSS_SPECS, EXPOSED_BOSS_SPECS } from '../../src/render/bossShapes';
import { hueDistance, hueOfRgb } from '../../src/render/emberFlame';
import { PALETTE_KEYS, palette } from '../../src/render/neon';
import type { ShapeSpec } from '../../src/render/shapeSpecs';

const arcs = (stage: number, seed: number, off: number): Float32Array => {
  const out = new Float32Array(BREAK_ARCS_MAX * 2);
  breakArcs(stage, seed, off, out);
  return out;
};

/** Total stroked polyline length of a spec's stroked layers beyond rCut share of its radius. */
function outerStrokeLength(spec: ShapeSpec): number {
  const R = specOuterRadius(spec);
  let len = 0;
  for (const l of spec.layers) {
    if (l.width <= 0) continue;
    for (const p of l.prims) {
      const runs = clipPrim(p, new Float32Array(0), 0, 0, R * 0.02);
      for (const r of runs) {
        for (let k = 2; k + 1 < r.length; k += 2) {
          const mx = ((r[k] ?? 0) + (r[k - 2] ?? 0)) / 2;
          const my = ((r[k + 1] ?? 0) + (r[k - 1] ?? 0)) / 2;
          if (Math.hypot(mx, my) >= R * BREAK_MIN_R) len += Math.hypot((r[k] ?? 0) - (r[k - 2] ?? 0), (r[k + 1] ?? 0) - (r[k - 1] ?? 0));
        }
      }
    }
  }
  return len;
}

describe('noise table (Ember flame)', () => {
  it('stays in 0 to 1 and wraps', () => {
    for (let x = -5; x < 70; x += 0.37) {
      const v = noiseAt(x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(noiseAt(x + NOISE_SIZE)).toBeCloseTo(v, 5);
    }
  });
});

describe('break arc table', () => {
  it('stage 1 removes about 20 percent and stage 2 about 40 percent of the turn', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(breakArcs(0, seed, 0, new Float32Array(BREAK_ARCS_MAX * 2))).toBe(0);
      expect(arcShare(arcs(1, seed, 0.3), BREAK_ARCS[0])).toBeCloseTo(BREAK_SHARE[0], 5);
      expect(arcShare(arcs(2, seed, 0.3), BREAK_ARCS[1])).toBeCloseTo(BREAK_SHARE[1], 5);
    }
  });

  it('is deterministic per seed, varies with the seed, and arcs never overlap', () => {
    expect(Array.from(arcs(2, 7, 1))).toEqual(Array.from(arcs(2, 7, 1)));
    expect(Array.from(arcs(2, 8, 1))).not.toEqual(Array.from(arcs(2, 7, 1)));
    for (let seed = 0; seed < 40; seed++) {
      const a = arcs(2, seed, -0.4);
      for (let k = 0; k + 1 < BREAK_ARCS_MAX; k++) expect(a[k * 2 + 1] ?? 0).toBeLessThan(a[(k + 1) * 2] ?? 0);
      expect((a[(BREAK_ARCS_MAX - 1) * 2 + 1] ?? 0) - (a[0] ?? 0)).toBeLessThan(Math.PI * 2);
    }
  });

  it('every stage 1 arc lies inside the same arc at stage 2', () => {
    for (let seed = 0; seed < 40; seed++) {
      const a1 = arcs(1, seed, 2);
      const a2 = arcs(2, seed, 2);
      for (let k = 0; k < BREAK_ARCS[0]; k++) {
        expect(a2[k * 2] ?? 0).toBeLessThanOrEqual((a1[k * 2] ?? 0) + 1e-6);
        expect(a2[k * 2 + 1] ?? 0).toBeGreaterThanOrEqual((a1[k * 2 + 1] ?? 0) - 1e-6);
      }
    }
    expect(DETACH_ARC).toBeGreaterThanOrEqual(BREAK_ARCS[0]);
    expect(DETACH_ARC).toBeLessThan(BREAK_ARCS[1]);
  });

  it('inArcs wraps angles', () => {
    const a = new Float32Array([3.0, 3.4]);
    expect(inArcs(3.2, a, 1)).toBe(true);
    expect(inArcs(3.2 - Math.PI * 2, a, 1)).toBe(true);
    expect(inArcs(0, a, 1)).toBe(false);
  });
});

describe('damaged body spec', () => {
  it('a circle loses the arcs and keeps the rest as open runs on the outline', () => {
    const a = arcs(1, 3, 0);
    const runs = clipPrim({ t: 'circle', r: 50 }, a, BREAK_ARCS[0], 30, 2);
    expect(runs.length).toBe(BREAK_ARCS[0]);
    for (const r of runs) {
      for (let k = 0; k + 1 < r.length; k += 2) {
        const x = r[k] ?? 0;
        const y = r[k + 1] ?? 0;
        expect(Math.abs(Math.hypot(x, y) - 50)).toBeLessThan(0.5);
        expect(inArcs(Math.atan2(y, x), a, BREAK_ARCS[0])).toBe(false);
      }
    }
  });

  it('every boss silhouette loses close to the stage share of its outer outline', () => {
    for (let b = 0; b < BOSS_COUNT; b++) {
      for (const spec of [BOSS_SPECS[b * 3], EXPOSED_BOSS_SPECS[b * 3]]) {
        if (spec === undefined) continue;
        const full = outerStrokeLength(spec);
        for (const stage of [1, 2]) {
          const a = arcs(stage, b * 17, 0.5);
          const lost = 1 - outerStrokeLength(damagedSpec(spec, a, BREAK_ARCS[stage - 1] ?? 3)) / full;
          const want = BREAK_SHARE[stage - 1] ?? 0.2;
          expect(lost, `boss ${b} stage ${stage}`).toBeGreaterThan(want * 0.5);
          expect(lost, `boss ${b} stage ${stage}`).toBeLessThan(want * 1.8);
        }
      }
    }
  });

  it('keeps every fill at its normal alpha and colour, never a dark fill', () => {
    for (let b = 0; b < BOSS_COUNT; b++) {
      const spec = BOSS_SPECS[b * 3];
      if (spec === undefined) continue;
      const d = damagedSpec(spec, arcs(2, b, 0), BREAK_ARCS[1]);
      const fills = (s: ShapeSpec): string[] => s.layers.filter((l) => l.fill > 0).map((l) => `${l.colour}:${l.fill}`);
      expect(fills(d)).toEqual(fills(spec));
      expect(specOuterRadius(d)).toBeLessThanOrEqual(specOuterRadius(spec) + 1e-6);
    }
  });
});

describe('damage colours', () => {
  it('no damage colour has HSL lightness under 30 percent, for every boss and palette key', () => {
    const out = { edge: 0, stub: 0, frag: 0 };
    const keys = [...PALETTE_KEYS];
    for (let b = 0; b < BOSS_COUNT; b++) {
      const p = palette[bossColourOf(b)];
      for (const k of keys) {
        damageColours(p, palette[k], out);
        for (const c of [out.edge, out.stub, out.frag]) expect(lightnessOf(c)).toBeGreaterThanOrEqual(DAMAGE_MIN_L);
      }
      damageColours(0x101010, 0x000000, out);
      for (const c of [out.edge, out.stub, out.frag]) expect(lightnessOf(c)).toBeGreaterThanOrEqual(DAMAGE_MIN_L);
    }
  });

  it('the edge shifts 25 degrees toward the accent and the stub is the primary at 1.3x', () => {
    const red = 0xff2020;
    const yellow = 0xffff20;
    const e = shiftHueToward(red, yellow, EDGE_HUE_SHIFT);
    expect(hueDistance(hueOfRgb(e), hueOfRgb(red))).toBeCloseTo(EDGE_HUE_SHIFT, -0.3);
    expect(hueDistance(hueOfRgb(e), hueOfRgb(yellow))).toBeLessThan(hueDistance(hueOfRgb(red), hueOfRgb(yellow)));
    const blue = 0x3060c0;
    const s = brighten(blue, STUB_BRIGHT);
    expect((s & 255) / (blue & 255)).toBeCloseTo(STUB_BRIGHT, 1);
    expect(hueDistance(hueOfRgb(s), hueOfRgb(blue))).toBeLessThan(3);
    expect(rgbToHsl(0xffffff)[2]).toBeCloseTo(1);
  });

  it('the edge flickers unevenly inside its range', () => {
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 4; t += 0.03) {
      const v = edgeFlicker(t, 1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      expect(v).toBeGreaterThanOrEqual(EDGE_FLICKER[0] - 1e-9);
      expect(v).toBeLessThanOrEqual(EDGE_FLICKER[1] + 1e-9);
    }
    expect(hi - lo).toBeGreaterThan(0.3);
  });
});

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('no dark damage anywhere (source guards)', () => {
  const root = new URL('../../src/render', import.meta.url).pathname;

  it('no erase or multiply blend mode is used anywhere in src/render', () => {
    for (const f of tsFiles(root)) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/['"](erase|multiply)['"]/);
      expect(src, f).not.toMatch(new RegExp(['BLEND', 'MODES'].join('_')));
    }
  });

  it('the damage draw uses only the damage colours, no black, no fill inside the body', () => {
    const src = readFileSync(join(root, 'renderer.ts'), 'utf8');
    const i = src.indexOf('function drawDamage(');
    expect(i).toBeGreaterThan(0);
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).not.toMatch(/0x0{6}/);
    expect(body).not.toMatch(/dimRgb|mixRgb/);
    const colours = [...body.matchAll(/color: ([\w.]+)/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThanOrEqual(3);
    for (const c of colours) expect(['dmgCol.edge', 'dmgCol.stub']).toContain(c);
  });
});
