// Look v33 (GW1): every boss part type and pickup kind has its own look, the drone modes have a
// colour and a glyph, the Hornet buzzes, and the decoy pulses red orange.
import { describe, expect, it } from 'vitest';
import { PartType } from '../../src/game/bosses/types';
import { GRAVITANT, HORNET, TEMPESTLING } from '../../src/game/bosses/table';
import { DRONE_MODES } from '../../src/core/events';
import { Kind } from '../../src/game/world';
import { BOSS_MIRAGE, BOSS_TEMPEST, bossColourOf } from '../../src/render/bossLook';
import {
  bossBodyR,
  buildPartSpec,
  GRAVITANT_R,
  HORNET_R,
  isBakedPart,
  MIRROR_ALPHA,
  PART_GRAVITANT,
  PART_HORNET,
  PART_MIRROR,
  PART_SPEC_TYPES,
  PART_TEMPESTLING,
  TEMPEST_NOSE,
  TEMPESTLING_SHARE,
  tempestKite,
  PART_TYPES,
  partR,
  partSpecIndex,
} from '../../src/render/bossShapes';
import { hueDistance, hueOfRgb } from '../../src/render/emberFlame';
import { palette } from '../../src/render/neon';
import {
  decoyPulse,
  decoyTint,
  dronePickupRot,
  DRONE_MODE_LOOKS,
  glyphDots,
  glyphSegments,
  partJitter,
  partLook,
  PART_LOOKS,
  TEMPESTLING_SWIRL_HZ,
  tempestlingLead,
  tempestlingSwirl,
  PICKUP_LOOKS,
} from '../../src/render/partLooks';
import { DRONE_PICKUP_SPEC, DRONE_SPEC, DRONE_TWIN_SPEC, partSlot, specFor, specForSlot } from '../../src/render/shapeSpecs';

const ALL_PART_TYPES = [
  PartType.Pod,
  PartType.Anchor,
  PartType.Turret,
  PartType.Twin,
  PartType.Broodling,
  PartType.Hornet,
  PartType.Gravitant,
  PartType.Mirror,
  PartType.Tempestling,
];

describe('part look registry', () => {
  it('has one entry per sim PartType, in value order', () => {
    expect(PART_LOOKS.length).toBe(ALL_PART_TYPES.length);
    for (const t of ALL_PART_TYPES) expect(partLook(t)).toBe(PART_LOOKS[t]);
    expect(PART_HORNET).toBe(PartType.Hornet);
    expect(PART_GRAVITANT).toBe(PartType.Gravitant);
    expect(PART_MIRROR).toBe(PartType.Mirror);
    expect(partLook(99)).toBe(PART_LOOKS[PartType.Pod]);
  });

  it('every part type except the twin body has its own spec; the new parts are not the generic pod', () => {
    const specs = new Set<number>();
    for (const t of ALL_PART_TYPES) {
      const l = partLook(t);
      if (t === PartType.Twin) {
        expect(l.spec).toBe(-1);
        continue;
      }
      expect(l.spec).toBe(partSpecIndex(t));
      expect(PART_SPEC_TYPES[l.spec]).toBe(t);
      specs.add(l.spec);
    }
    expect(specs.size).toBe(PART_TYPES);
    for (const t of [PartType.Hornet, PartType.Gravitant, PartType.Mirror]) {
      expect(partSlot(t, 2)).not.toBe(partSlot(PartType.Pod, 2));
      expect(specForSlot(partSlot(t, 2))).toEqual(buildPartSpec(t, 2));
      expect(isBakedPart(t)).toBe(true);
      expect(partLook(t).tint).toBe('baked');
    }
  });

  it('draws the new parts at their sim radii', () => {
    expect(HORNET_R).toBe(HORNET.radius);
    expect(GRAVITANT_R).toBe(GRAVITANT.radius);
    expect(partR(PART_HORNET)).toBe(HORNET.radius);
    expect(partR(PART_GRAVITANT)).toBe(GRAVITANT.radius);
    expect(partR(PART_MIRROR)).toBe(bossBodyR(BOSS_MIRAGE));
  });

  it('Hornet is a small amber dart, Gravitant a violet well with a rim, Mirror a magenta ghost with no fill', () => {
    const h = buildPartSpec(PART_HORNET, 1);
    expect(h.layers[0]?.colour).toBe('bossOrange');
    expect(h.layers[0]?.prims[0]?.t).toBe('poly');
    expect(h.radius).toBeLessThan(20);
    const g = buildPartSpec(PART_GRAVITANT, 2);
    for (const l of g.layers) expect(l.colour).toBe('bossViolet');
    expect(g.layers.some((l) => l.prims.some((p) => p.t === 'circle' && p.r > GRAVITANT_R))).toBe(true);
    const m = buildPartSpec(PART_MIRROR, 2);
    expect(m.layers.length).toBeGreaterThan(2);
    for (const l of m.layers) {
      expect(l.colour).toBe('bossMagenta');
      expect(l.fill).toBe(0);
      expect(l.alpha).toBeLessThanOrEqual(MIRROR_ALPHA + 1e-9);
    }
  });

  it('only the Hornet buzzes, quickly and within its amplitude', () => {
    const o = { x: 0, y: 0 };
    for (const t of ALL_PART_TYPES) {
      if (t === PartType.Hornet) continue;
      partJitter(t, 1.3, 0.4, o);
      expect(o).toEqual({ x: 0, y: 0 });
    }
    const xs: number[] = [];
    for (let k = 0; k < 30; k++) {
      partJitter(PartType.Hornet, k / 120, 0.4, o);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(partLook(PartType.Hornet).jitter + 1e-9);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(partLook(PartType.Hornet).jitter + 1e-9);
      xs.push(o.x);
    }
    let turns = 0;
    for (let k = 1; k + 1 < xs.length; k++) if (Math.sign((xs[k] ?? 0) - (xs[k - 1] ?? 0)) !== Math.sign((xs[k + 1] ?? 0) - (xs[k] ?? 0))) turns++;
    expect(turns).toBeGreaterThanOrEqual(6);
  });
});

describe('pickup and drone looks', () => {
  it('the drone pickup is a white and cyan ring glyph, distinct from the weapon pickup', () => {
    expect(specFor(Kind.DronePickup)).toBe(DRONE_PICKUP_SPEC);
    expect(DRONE_PICKUP_SPEC).not.toEqual(specFor(Kind.WeaponPickup));
    const colours = new Set(DRONE_PICKUP_SPEC.layers.map((l) => l.colour));
    expect(colours.has('white')).toBe(true);
    expect(colours.has('cyan')).toBe(true);
    expect(DRONE_PICKUP_SPEC.layers[0]?.prims.every((p) => p.t === 'line')).toBe(true);
    expect(PICKUP_LOOKS.drone.dir).toBe(-PICKUP_LOOKS.weapon.dir);
    expect(dronePickupRot(1, 0)).toBeCloseTo(-PICKUP_LOOKS.drone.spin);
  });

  it('the second drone is the drone look with a cyan tint', () => {
    expect(specFor(Kind.DroneTwin)).toBe(DRONE_TWIN_SPEC);
    expect(DRONE_TWIN_SPEC.layers).toBe(DRONE_SPEC.layers);
    expect(DRONE_TWIN_SPEC.tint).toBe('cyan');
    expect(specFor(Kind.Drone)).toBe(DRONE_SPEC);
  });

  it('every drone mode has its own colour and glyph: H, D, R, a doubled dot', () => {
    expect(DRONE_MODES.map((m) => DRONE_MODE_LOOKS[m].glyph)).toEqual(['H', 'D', 'R', 'dots']);
    expect(new Set(DRONE_MODES.map((m) => DRONE_MODE_LOOKS[m].key)).size).toBe(DRONE_MODES.length);
    for (const g of ['H', 'D', 'R'] as const) {
      const seg = glyphSegments(g, 4);
      expect(seg.length % 4).toBe(0);
      expect(seg.length).toBeGreaterThanOrEqual(12);
      for (const v of seg) expect(Math.abs(v)).toBeLessThanOrEqual(4);
    }
    expect(glyphSegments('dots', 4)).toEqual([]);
    expect(glyphDots(4).pts.length).toBe(4);
  });

  it('the detach decoy pulses between red and orange', () => {
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 1; t += 0.01) {
      const p = decoyPulse(t);
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
      const c = decoyTint(palette.red, palette.orange, t);
      expect(hueDistance(hueOfRgb(c), hueOfRgb(palette.red)) + hueDistance(hueOfRgb(c), hueOfRgb(palette.orange))).toBeLessThan(
        hueDistance(hueOfRgb(palette.red), hueOfRgb(palette.orange)) + 4,
      );
    }
    expect(lo).toBeLessThan(0.05);
    expect(hi).toBeGreaterThan(0.95);
  });
});

describe('Tempestling look (GW3)', () => {
  it('has its own baked spec, not the pod, and matches the sim part type and size share', () => {
    expect(PART_TEMPESTLING).toBe(PartType.Tempestling);
    expect(TEMPESTLING_SHARE).toBe(TEMPESTLING.sizeShare);
    const l = partLook(PartType.Tempestling);
    expect(l.name).toBe('tempestling');
    expect(l.tint).toBe('baked');
    expect(isBakedPart(PART_TEMPESTLING)).toBe(true);
    expect(partSlot(PART_TEMPESTLING, 3)).not.toBe(partSlot(PartType.Pod, 3));
    expect(specForSlot(partSlot(PART_TEMPESTLING, 3))).toEqual(buildPartSpec(PART_TEMPESTLING, 3));
  });

  it('is the Tempest kite in the Tempest storm colour at 60 percent of the body size', () => {
    const R = bossBodyR(BOSS_TEMPEST);
    expect(partR(PART_TEMPESTLING)).toBeCloseTo(R * 0.6, 6);
    const spec = buildPartSpec(PART_TEMPESTLING, 3);
    const body = spec.layers[0];
    expect(body?.colour).toBe(bossColourOf(BOSS_TEMPEST));
    expect(body?.prims[0]).toEqual(tempestKite(R * 0.6, 1));
    expect(spec.radius).toBeLessThan(TEMPEST_NOSE * R);
    expect(spec.layers.some((x) => x.colour === 'slime')).toBe(true);
  });

  it('swirls fast and leads with its move direction', () => {
    expect(TEMPESTLING_SWIRL_HZ).toBeGreaterThanOrEqual(1);
    const a = tempestlingSwirl(0, 0.3, 0);
    const b = tempestlingSwirl(0.1, 0.3, 0);
    expect(b - a).toBeCloseTo(0.1 * TEMPESTLING_SWIRL_HZ * Math.PI * 2, 6);
    expect(tempestlingLead(0, 50, 0)).toBeCloseTo(Math.PI / 2);
    expect(tempestlingLead(0, 0, 1.2)).toBe(1.2);
    expect(Number.isFinite(tempestlingLead(Number.NaN, Number.NaN, Number.NaN))).toBe(true);
  });
});
