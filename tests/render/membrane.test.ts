import { describe, expect, it } from 'vitest';
import type { ArenaDef, Obstacle } from '../../src/levelgen/leveldef';
import {
  MEMBRANE_FILL_ALPHA,
  MEMBRANE_RIPPLE_AMP,
  circleOverlapsObstacle,
  dashOn,
  liftColour,
  membraneObstacles,
  membraneRipple,
  membraneSamples,
  obstacleStyle,
  solidObstacles,
  stepFlash,
} from '../../src/render/membrane';

const solid: Obstacle = { cx: 0, cy: 0, w: 100, h: 20 };
const bar: Obstacle = { cx: 200, cy: 0, w: 20, h: 300, membrane: true };
const arena = { obstacles: [solid, bar] } as unknown as ArenaDef;

describe('membrane style', () => {
  it('a membrane obstacle takes the membrane style and a solid one does not', () => {
    expect(obstacleStyle(bar)).toBe('membrane');
    expect(obstacleStyle(solid)).toBe('solid');
  });
  it('splits an arena into solid and membrane lists', () => {
    expect(solidObstacles(arena)).toEqual([solid]);
    expect(membraneObstacles(arena)).toEqual([bar]);
  });
  it('fill alpha is 0.12', () => expect(MEMBRANE_FILL_ALPHA).toBe(0.12));
  it('lifts the wall colour 20 percent toward white', () => {
    expect(liftColour(0x000000)).toBe(0x333333);
    expect(liftColour(0xffffff)).toBe(0xffffff);
  });
});

describe('membrane motion', () => {
  it('ripple stays within the amplitude and moves with time', () => {
    for (let s = 0; s < 400; s += 17) expect(Math.abs(membraneRipple(s, 1.3, 0.4))).toBeLessThanOrEqual(MEMBRANE_RIPPLE_AMP + 1e-9);
    expect(membraneRipple(30, 0, 0)).not.toBeCloseTo(membraneRipple(30, 1, 0));
  });
  it('dash pattern is two on, one off and scrolls', () => {
    expect([0, 1, 2, 3].map((i) => dashOn(i, 0))).toEqual([true, true, false, true]);
    expect(dashOn(0, 2)).toBe(false);
    expect(dashOn(0, -1)).toBe(false);
  });
  it('sample count is clamped', () => {
    expect(membraneSamples(1)).toBe(4);
    expect(membraneSamples(10000)).toBe(48);
  });
});

describe('membrane overlap flash', () => {
  it('detects an enemy circle overlapping the bar', () => {
    expect(circleOverlapsObstacle(bar, 200, 50, 5)).toBe(true);
    expect(circleOverlapsObstacle(bar, 225, 0, 10)).toBe(false);
    expect(circleOverlapsObstacle(bar, 215, 0, 10)).toBe(true);
  });
  it('flash jumps to 1 on a hit and fades to 0', () => {
    expect(stepFlash(0, 0.016, true)).toBe(1);
    expect(stepFlash(1, 0.1, false)).toBeLessThan(1);
    expect(stepFlash(0.01, 1, false)).toBe(0);
  });
});
