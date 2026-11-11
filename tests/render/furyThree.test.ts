import { describe, expect, it } from 'vitest';
import {
  BROOD_SPLIT_FLASH_SEC,
  broodSplitFlash,
  ECHO_ALPHA,
  ECHO_U,
  flipInOf,
  FRENZY_GLOW0,
  FRENZY_GLOW1,
  FRENZY_PULSE_HZ,
  FRENZY_SCALE,
  frenzyGlow,
  frenzyOn,
  frenzyPulse,
  frenzyScale,
  frenzySpec,
  GRAV_COLLAPSE_SEC,
  GRAV_HOLD_SEC,
  GRAV_POINT,
  GRAV_POINT_GLOW,
  GRAV_RING_HZ,
  GRAV_RING_SPAN,
  GRAV_SNAP_MUL,
  GRAV_SNAP_SEC,
  gravitasArcStart,
  gravitasCollapseGlow,
  gravitasCollapseScale,
  gravitasFuryTint,
  gravitasRingAngle,
  gravitasRingArcs,
  gravitasRingOn,
  gravitasSnapAccel,
  MIRAGE_SHARDS,
  mirageEchoAlpha,
  mirageEchoOffset,
  mirageEchoOn,
  mirageFuryTint,
  mirageShardCount,
  ripplesOut,
  TIDE_WARN_SEC,
  tideFlash,
  tideLatticeAccel,
  tideOf,
} from '../../src/render/furyThree';
import { FURY_BREAK_SEC } from '../../src/render/wardenFury';
import { broodlingSpec } from '../../src/render/bossShapes';
import { palette as pal } from '../../src/render/neon';
import { pullRipple } from '../../src/render/hazardFx';

const lum = (c: number): number => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);

describe('furyThree view fields', () => {
  it('treats absent fields as off', () => {
    expect(frenzyOn(undefined)).toBe(false);
    expect(frenzyOn(false)).toBe(false);
    expect(frenzyOn(true)).toBe(true);
    expect(tideOf(undefined)).toBe(0);
    expect(tideOf(1)).toBe(1);
    expect(tideOf(-1)).toBe(-1);
    expect(tideOf(0)).toBe(0);
    expect(flipInOf(undefined)).toBe(-1);
    expect(flipInOf(-1)).toBe(-1);
    expect(flipInOf(Number.NaN)).toBe(-1);
    expect(flipInOf(0.5)).toBe(0.5);
  });
});

describe('furyThree Brood', () => {
  it('flashes the Broodlings white once, only just after the split', () => {
    expect(broodSplitFlash(0)).toBe(true);
    expect(broodSplitFlash(BROOD_SPLIT_FLASH_SEC * 0.9)).toBe(true);
    expect(broodSplitFlash(BROOD_SPLIT_FLASH_SEC)).toBe(false);
    expect(broodSplitFlash(Number.POSITIVE_INFINITY)).toBe(false);
    expect(broodSplitFlash(-1)).toBe(false);
  });

  it('pulses quickly within its scale and glow ranges, offset per Broodling', () => {
    expect(frenzyPulse(0, 0)).toBeCloseTo(1);
    expect(frenzyPulse(0.5 / FRENZY_PULSE_HZ, 0)).toBeCloseTo(0);
    expect(frenzyPulse(1 / FRENZY_PULSE_HZ, 0)).toBeCloseTo(1);
    expect(frenzyPulse(0, 0.5)).toBeCloseTo(0);
    expect(frenzyPulse(Number.NaN, Number.NaN)).toBeCloseTo(1);
    expect(frenzyScale(0)).toBe(1);
    expect(frenzyScale(1)).toBeCloseTo(1 + FRENZY_SCALE);
    expect(frenzyScale(5)).toBeCloseTo(1 + FRENZY_SCALE);
    expect(frenzyGlow(0)).toBe(FRENZY_GLOW0);
    expect(frenzyGlow(1)).toBeCloseTo(FRENZY_GLOW0 + FRENZY_GLOW1);
  });

  it('builds a hot green spec with a red core and a white hot inner line', () => {
    const base = broodlingSpec(1);
    const hot = frenzySpec(base);
    expect(hot.radius).toBe(base.radius);
    expect(hot.layers.some((l) => l.colour === 'yellow')).toBe(false);
    const core = hot.layers.filter((l) => l.colour === 'red');
    expect(core.length).toBe(1);
    expect(core[0]?.fill).toBeGreaterThanOrEqual(0.95);
    const green = hot.layers.filter((l) => l.colour === 'bossGreen');
    expect(green.length).toBe(2);
    for (const l of green) expect(l.fill).toBeGreaterThan(0.16);
    const white = hot.layers.filter((l) => l.colour === 'white');
    expect(white.length).toBe(1);
    expect(white[0]?.glow).toBe(false);
    expect(white[0]?.width).toBeLessThan(base.layers[0]?.width ?? 0);
    // The source spec is left as it was.
    expect(base.layers.some((l) => l.colour === 'yellow')).toBe(true);
  });
});

describe('furyThree Mirage', () => {
  const mag = pal.bossMagenta;

  it('flickers magenta to white over the break, hot magenta enraged, plain otherwise', () => {
    expect(mirageFuryTint(0, 0, mag)).toBe(mag);
    let whites = 0;
    let base = 0;
    for (let t = 0; t < FURY_BREAK_SEC; t += 0.01) {
      const c = mirageFuryTint(1, t, mag);
      if (lum(c) > lum(mag) + 150) whites++;
      else base++;
      // Never crosses to red: blue stays well up (magenta and white both carry blue).
      expect(c & 255).toBeGreaterThan(150);
    }
    expect(whites).toBeGreaterThan(50);
    expect(base).toBeGreaterThan(50);
    const hot = mirageFuryTint(2, 3, mag);
    expect(lum(hot)).toBeGreaterThan(lum(mag));
    expect(hot).toBe(mirageFuryTint(2, 99, mag));
  });

  it('shatters fewer shards on Low, more with mirrors standing', () => {
    expect(mirageShardCount('low', 0)).toBe(MIRAGE_SHARDS.low);
    expect(mirageShardCount('low', 0)).toBeLessThan(mirageShardCount('standard', 0));
    expect(mirageShardCount('standard', 0)).toBeLessThan(mirageShardCount('high', 0));
    expect(mirageShardCount('standard', 2)).toBeGreaterThan(mirageShardCount('standard', 0));
    expect(mirageShardCount('standard', 9)).toBe(mirageShardCount('standard', 2));
    expect(mirageShardCount('standard', -3)).toBe(mirageShardCount('standard', 0));
  });

  it('keeps the double image a few units off and flickering, enraged only', () => {
    expect(mirageEchoOn(2)).toBe(true);
    expect(mirageEchoOn(1)).toBe(false);
    expect(mirageEchoOn(0)).toBe(false);
    const o = { x: 0, y: 0 };
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 4; t += 0.013) {
      mirageEchoOffset(t, o);
      const d = Math.hypot(o.x, o.y);
      expect(d).toBeGreaterThan(ECHO_U * 0.6);
      expect(d).toBeLessThanOrEqual(ECHO_U + 1e-9);
      const a = mirageEchoAlpha(t);
      expect(a).toBeGreaterThanOrEqual(ECHO_ALPHA[0]);
      expect(a).toBeLessThanOrEqual(ECHO_ALPHA[1]);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    expect(hi - lo).toBeGreaterThan(0.2);
    expect(mirageEchoOffset(1.3, o)).toBe(o);
    mirageEchoOffset(Number.NaN, o);
    expect(Number.isFinite(o.x) && Number.isFinite(o.y)).toBe(true);
  });
});

describe('furyThree Gravitas', () => {
  const vio = pal.bossViolet;

  it('collapses the body to a point and swells it back over the break', () => {
    expect(gravitasCollapseScale(0, 1)).toBe(1);
    expect(gravitasCollapseScale(2, 1)).toBe(1);
    expect(gravitasCollapseScale(1, 0)).toBe(1);
    expect(gravitasCollapseScale(1, GRAV_COLLAPSE_SEC)).toBeCloseTo(GRAV_POINT);
    expect(gravitasCollapseScale(1, GRAV_COLLAPSE_SEC + GRAV_HOLD_SEC * 0.5)).toBe(GRAV_POINT);
    expect(gravitasCollapseScale(1, FURY_BREAK_SEC)).toBeCloseTo(1);
    let prev = 0;
    for (let t = GRAV_COLLAPSE_SEC + GRAV_HOLD_SEC; t <= FURY_BREAK_SEC; t += 0.05) {
      const s = gravitasCollapseScale(1, t);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s;
    }
    expect(gravitasCollapseGlow(1)).toBe(1);
    expect(gravitasCollapseGlow(0)).toBeCloseTo(1 + GRAV_POINT_GLOW);
  });

  it('snaps the lattice inward at the break start only', () => {
    expect(gravitasSnapAccel(1, 0, -100)).toBeCloseTo(-100 * GRAV_SNAP_MUL);
    expect(gravitasSnapAccel(1, 0, 100)).toBeCloseTo(-100 * GRAV_SNAP_MUL);
    expect(gravitasSnapAccel(1, GRAV_SNAP_SEC / 2, -100)).toBeCloseTo(-50 * GRAV_SNAP_MUL);
    expect(gravitasSnapAccel(1, GRAV_SNAP_SEC, -100)).toBe(0);
    expect(gravitasSnapAccel(2, 0, -100)).toBe(0);
    expect(gravitasSnapAccel(0, 0, -100)).toBe(0);
  });

  it('stays violet, flashing white over the break and hot enraged', () => {
    expect(gravitasFuryTint(0, 0, vio)).toBe(vio);
    let whites = 0;
    for (let t = 0; t < FURY_BREAK_SEC; t += 0.01) {
      const c = gravitasFuryTint(1, t, vio);
      if (c !== vio) whites++;
      expect(c & 255).toBeGreaterThan(150);
    }
    expect(whites).toBeGreaterThan(50);
    expect(lum(gravitasFuryTint(2, 0, vio))).toBeGreaterThan(lum(vio));
  });

  it('spins its white ring enraged only, fewer arcs on Low', () => {
    expect(gravitasRingOn(2)).toBe(true);
    expect(gravitasRingOn(1)).toBe(false);
    expect(gravitasRingAngle(0)).toBe(0);
    expect(gravitasRingAngle(1 / GRAV_RING_HZ)).toBeCloseTo(2 * Math.PI);
    expect(gravitasRingArcs('low')).toBeLessThan(gravitasRingArcs('high'));
    expect(gravitasRingArcs('standard')).toBe(gravitasRingArcs('high'));
    const n = 3;
    expect(gravitasArcStart(0, 1, n) - gravitasArcStart(0, 0, n)).toBeCloseTo((2 * Math.PI) / n);
    expect(gravitasArcStart(0, 0, n)).toBeCloseTo(-GRAV_RING_SPAN / 2);
  });

  it('flashes a ring only in the last TIDE_WARN_SEC before a flip, quickening', () => {
    expect(tideFlash(-1)).toBe(0);
    expect(tideFlash(TIDE_WARN_SEC + 0.01)).toBe(0);
    expect(tideFlash(3)).toBe(0);
    expect(tideFlash(Number.NaN)).toBe(0);
    expect(tideFlash(TIDE_WARN_SEC)).toBe(1);
    const edges = (from: number, to: number): number => {
      let n = 0;
      let last = tideFlash(from);
      for (let f = from; f >= to; f -= 0.001) {
        const v = tideFlash(f);
        if (v !== last) n++;
        last = v;
      }
      return n;
    };
    const span = TIDE_WARN_SEC / 2;
    expect(edges(span, 0)).toBeGreaterThan(edges(TIDE_WARN_SEC, span));
    for (let f = 0; f <= TIDE_WARN_SEC; f += 0.01) expect(tideFlash(f)).toBeGreaterThan(0);
  });

  it('runs the ripples and the lattice outward while the tide pushes', () => {
    expect(ripplesOut(-1)).toBe(true);
    expect(ripplesOut(1)).toBe(false);
    expect(ripplesOut(0)).toBe(false);
    expect(tideLatticeAccel(-50, -1)).toBe(50);
    expect(tideLatticeAccel(-50, 1)).toBe(-50);
    expect(tideLatticeAccel(-50, 0)).toBe(-50);
    // hazardFx: the same ripple runs the other way.
    for (const age of [0, 0.3, 1.1]) {
      for (const k of [0, 1]) {
        expect(pullRipple(age, k, true)).toBeCloseTo(1 - pullRipple(age, k));
      }
    }
    const a = pullRipple(0.1, 0, true);
    const b = pullRipple(0.2, 0, true);
    expect(b).toBeGreaterThan(a);
    expect(pullRipple(0.2, 0)).toBeLessThan(pullRipple(0.1, 0));
  });
});
