// glow-fury-orbs: the context guard (no Graphics keeps a retired context), the Gravitas pool orb look
// and the brighter ship pool halo.
import { describe, expect, it } from 'vitest';
import { noRetiredHeld, releaseRetired, type ContextHolder } from '../../src/render/contextGuard';
import { countFrame, createSpriteBuf, F_BAR, F_DOT, F_FILL, F_GLOW, type FxHalo } from '../../src/render/fxSprites';
import {
  ORB_RADIUS_DEFAULT,
  ORB_SHIMMER,
  ORB_TRAIL_HIGH,
  ORB_TRAIL_LOW,
  ORB_TRAIL_STD,
  orbFadeIn,
  orbRadius,
  orbShimmer,
  orbTrailAlpha,
  orbTrailCount,
  orbTrailDist,
  orbTrailScale,
} from '../../src/render/furyOrbs';
import { POOL_HALO_A, POOL_HALO_CORE_A, poolHaloAlpha, poolHaloCoreAlpha, poolHaloCoreTint, poolHaloRingAlpha, POOL_HALO_RING_A } from '../../src/render/furyTune';
import { HAZARD_ORB, planHazard, type HazardInput } from '../../src/render/hazardFx';

interface Ctx {
  id: number;
  destroyed: boolean;
}

function ctx(id: number): Ctx {
  return { id, destroyed: false };
}

describe('context guard', () => {
  it('moves every holder on a retired context onto the fallback and reports each index', () => {
    const a = ctx(1);
    const b = ctx(2);
    const live = ctx(3);
    const empty = ctx(0);
    const holders: (ContextHolder<Ctx> | null)[] = [{ context: a }, null, { context: live }, { context: b }, { context: a }];
    const moved: number[] = [];
    const n = releaseRetired(holders, [a, b], empty, (i) => moved.push(i));
    expect(n).toBe(3);
    expect(moved).toEqual([0, 3, 4]);
    expect(holders[0]?.context).toBe(empty);
    expect(holders[2]?.context).toBe(live);
    expect(noRetiredHeld(holders, [a, b])).toBe(true);
  });

  it('never leaves a retired context attached across a mock frame of the renderer holders', () => {
    // Mock of the renderer: a views pool (one hidden view still on the old fury body, one on an old
    // Broodling look), the boss body (a view of the pool), the Mirage echo sharing the body context,
    // the afterimage and a dash ghost on old shape contexts. The destroy step runs the guard first.
    const furyOld = ctx(10);
    const broodOld = ctx(11);
    const shapeOld = ctx(12);
    const shapeNew = ctx(13);
    const empty = ctx(0);
    const views = [{ context: furyOld }, { context: broodOld }, { context: shapeNew }];
    const viewKind = [40, 41, 7];
    const echo = { context: furyOld };
    const ghost = { context: shapeOld };
    const dash = { context: shapeOld };
    const body = views[0] ?? null;
    const retired = [furyOld, broodOld, shapeOld];
    releaseRetired(views, retired, empty, (i) => (viewKind[i] = -1));
    releaseRetired([ghost, echo, body, dash], retired, empty);
    expect(noRetiredHeld([...views, echo, ghost, dash], retired)).toBe(true);
    expect(viewKind).toEqual([-1, -1, 7]);
    for (const c of retired) c.destroyed = true;
    for (const h of [...views, echo, ghost, dash]) expect(h.context.destroyed).toBe(false);
  });

  it('does nothing with no retired contexts and skips holders already on the fallback', () => {
    const empty = ctx(0);
    const holders = [{ context: empty }, { context: ctx(1) }];
    let calls = 0;
    expect(releaseRetired(holders, [], empty, () => calls++)).toBe(0);
    expect(releaseRetired(holders, [empty], empty, () => calls++)).toBe(0);
    expect(calls).toBe(0);
  });
});

const NO_HALO: FxHalo = { alpha: 0, width: 0 };
const HALO: FxHalo = { alpha: 0.6, width: 1 };

function orb(extra: Partial<HazardInput>): HazardInput {
  return { type: HAZARD_ORB, x: 100, y: 50, rot: 0, radius: 14, vx: 0, vy: 0, age: 0.5, tier: 3, tint: 0x9955ff, timeSec: 0, ...extra };
}

describe('pool orb look', () => {
  it('draws a glow, a hot core and the trail, never a telegraph or lethal band', () => {
    for (const age of [0.2, 1, 5, 30]) {
      const b = createSpriteBuf(64);
      const n = planHazard(orb({ age }), b, HALO);
      expect(n).toBe(b.count);
      expect(countFrame(b, F_DOT)).toBe(1);
      expect(countFrame(b, F_GLOW)).toBe(1 + ORB_TRAIL_STD);
      expect(countFrame(b, F_BAR)).toBe(0);
      expect(countFrame(b, F_FILL)).toBe(0);
    }
  });

  it('lays the trail behind the orb along w.rot', () => {
    const b = createSpriteBuf(64);
    planHazard(orb({ rot: 0 }), b, NO_HALO);
    for (let i = 0; i < b.count; i++) if (b.frame[i] === F_GLOW && b.x[i] !== 100) expect(b.x[i] ?? 0).toBeLessThan(100);
    const up = createSpriteBuf(64);
    planHazard(orb({ rot: Math.PI / 2 }), up, NO_HALO);
    for (let i = 0; i < up.count; i++) expect(up.y[i] ?? 0).toBeLessThanOrEqual(50 + 1e-6);
  });

  it('core is brighter and whiter than the glow, and Low pays fewer trail puffs', () => {
    const b = createSpriteBuf(64);
    planHazard(orb({ fx: 'low' }), b, NO_HALO);
    expect(countFrame(b, F_GLOW)).toBe(1 + ORB_TRAIL_LOW);
    const core = b.frame.indexOf(F_DOT);
    expect(b.alpha[core]).toBe(1);
    expect(b.tint[core]).not.toBe(0x9955ff);
    expect(orbTrailCount('high')).toBe(ORB_TRAIL_HIGH);
    expect(orbTrailCount(undefined)).toBe(ORB_TRAIL_STD);
  });

  it('pure helpers: radius default, fade in, shimmer range, trail shape', () => {
    expect(orbRadius(0)).toBe(ORB_RADIUS_DEFAULT);
    expect(orbRadius(Number.NaN)).toBe(ORB_RADIUS_DEFAULT);
    expect(orbRadius(20)).toBe(20);
    expect(orbFadeIn(0)).toBe(0);
    expect(orbFadeIn(1)).toBe(1);
    expect(orbFadeIn(Number.NaN)).toBe(1);
    for (let t = 0; t < 2; t += 0.013) {
      const s = orbShimmer(t);
      expect(s).toBeGreaterThanOrEqual(1 - ORB_SHIMMER - 1e-9);
      expect(s).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(orbTrailDist(1, 10)).toBeGreaterThan(orbTrailDist(0, 10));
    expect(orbTrailScale(0, 4)).toBe(1);
    expect(orbTrailScale(3, 4)).toBeLessThan(1);
    expect(orbTrailAlpha(0, 4)).toBe(1);
    expect(orbTrailAlpha(3, 4)).toBeLessThan(orbTrailAlpha(1, 4));
    expect(orbTrailAlpha(4, 4)).toBe(0);
  });

  it('a fresh orb at age 0 draws nothing, then fades in', () => {
    const b = createSpriteBuf(64);
    expect(planHazard(orb({ age: 0 }), b, NO_HALO)).toBe(0);
  });
});

describe('ship pool halo, brighter', () => {
  it('peaks clearly above the old faint halo (0.22) and ring (0.35)', () => {
    let hi = 0;
    for (let t = 0; t < 3; t += 0.01) hi = Math.max(hi, poolHaloAlpha(1, t));
    expect(hi).toBeGreaterThan(0.4);
    expect(poolHaloRingAlpha(POOL_HALO_A)).toBeGreaterThan(0.6);
    expect(POOL_HALO_RING_A).toBeGreaterThan(0.35);
  });

  it('core glow follows the halo alpha and is whiter than the violet', () => {
    expect(poolHaloCoreAlpha(POOL_HALO_A)).toBeCloseTo(POOL_HALO_CORE_A, 9);
    expect(poolHaloCoreAlpha(0)).toBe(0);
    expect(poolHaloCoreTint(0x8000ff)).not.toBe(0x8000ff);
  });
});
