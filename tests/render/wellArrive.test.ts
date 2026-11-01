// Look GW2: the well arrival ring and the nova snake emergence.
import { describe, expect, it } from 'vitest';
import {
  ARRIVE_DOTS,
  ARRIVE_FLASH_SEC,
  ARRIVE_R0,
  ARRIVE_R1,
  arriveAny,
  arriveDot,
  arriveEvent,
  arriveFlash,
  arriveProgress,
  arriveRadius,
  createArriveState,
  createEmergeState,
  EMERGE_LIFE,
  EMERGE_MATCH_R,
  EMERGE_TRAIL,
  emergeAny,
  emergeEvent,
  emergeFlash,
  emergePush,
  emergeRing,
  emergeTrack,
  emergeTrailAlpha,
  stepArrive,
  stepEmerge,
  type DustPoint,
} from '../../src/render/wellArrive';
import { turnsClockwise } from '../../src/render/wellNova';

describe('well arrival', () => {
  it('the ring tightens from R0 to the well radius over inSec', () => {
    expect(arriveRadius(0)).toBeCloseTo(ARRIVE_R0);
    expect(arriveRadius(1)).toBeCloseTo(ARRIVE_R1);
    let prev = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const r = arriveRadius(p);
      expect(r).toBeLessThanOrEqual(prev);
      prev = r;
    }
    expect(arriveProgress(0.75, 1.5)).toBeCloseTo(0.5);
    expect(arriveProgress(5, 1.5)).toBe(1);
  });

  it('dust points sit on the ring and turn clockwise as it tightens', () => {
    const a: DustPoint = { x: 0, y: 0, a: 0 };
    const b: DustPoint = { x: 0, y: 0, a: 0 };
    for (let k = 0; k < ARRIVE_DOTS; k++) {
      arriveDot(4, k, 0.3, a);
      arriveDot(4, k, 0.32, b);
      const r = Math.hypot(a.x, a.y);
      expect(r).toBeGreaterThanOrEqual(arriveRadius(0.3) * 0.9 - 1e-6);
      expect(r).toBeLessThanOrEqual(arriveRadius(0.3) * 1.1 + 1e-6);
      expect(turnsClockwise(a.x, a.y, b.x, b.y)).toBe(true);
      expect(a.a).toBeGreaterThan(0);
      expect(a.a).toBeLessThanOrEqual(1);
    }
  });

  it('flashes only when the well appears, then frees the slot', () => {
    expect(arriveFlash(0.5, 1)).toBe(0);
    expect(arriveFlash(1, 1)).toBe(1);
    expect(arriveFlash(1 + ARRIVE_FLASH_SEC + 0.01, 1)).toBe(0);
    const s = createArriveState();
    expect(arriveAny(s)).toBe(false);
    arriveEvent(s, 2, 10, 20, 0.5);
    expect(arriveAny(s)).toBe(true);
    for (let f = 0; f < 60; f++) stepArrive(s, 1 / 60);
    expect(arriveAny(s)).toBe(false);
  });

  it('a junk telegraph length falls back to a default, slots are reused', () => {
    const s = createArriveState();
    const k = arriveEvent(s, 1, 0, 0, Number.NaN);
    expect(s.inSec[k]).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) arriveEvent(s, i, 0, 0, 1);
    expect(s.age.length).toBe(4);
  });
});

describe('snake emergence', () => {
  it('a burst flashes at once, its ring grows and the trail fades over the life', () => {
    expect(emergeFlash(0)).toBeCloseTo(1);
    expect(emergeFlash(0.3)).toBeLessThan(emergeFlash(0.05));
    expect(emergeFlash(EMERGE_LIFE + 0.1)).toBe(0);
    expect(emergeRing(EMERGE_LIFE)).toBeGreaterThan(emergeRing(0));
    expect(emergeTrailAlpha(0)).toBe(1);
    expect(emergeTrailAlpha(EMERGE_LIFE)).toBe(0);
  });

  it('claims the nearby snake head, trails from the well centre and follows it', () => {
    const s = createEmergeState();
    const k = emergeEvent(s, 100, 100);
    expect(emergeTrack(s, 9, 100 + EMERGE_MATCH_R + 10, 100)).toBe(-1);
    expect(emergeTrack(s, 5, 110, 100)).toBe(k);
    expect(s.count[k]).toBe(2);
    expect(s.trail[0]).toBe(100);
    stepEmerge(s, 1 / 60);
    expect(emergeTrack(s, 5, 120, 100)).toBe(k);
    expect(s.count[k]).toBe(3);
    for (let f = 0; f < 120; f++) stepEmerge(s, 1 / 60);
    expect(emergeAny(s)).toBe(false);
  });

  it('the trail keeps the newest EMERGE_TRAIL points', () => {
    const s = createEmergeState();
    const k = emergeEvent(s, 0, 0);
    for (let i = 0; i < EMERGE_TRAIL + 5; i++) emergePush(s, k, i, 0);
    expect(s.count[k]).toBe(EMERGE_TRAIL);
    expect(s.trail[(EMERGE_TRAIL - 1) * 2]).toBe(EMERGE_TRAIL + 4);
    expect(s.trail[0]).toBe(5);
  });
});
