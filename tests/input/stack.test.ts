import { describe, expect, it } from 'vitest';
import { LABEL_RISE, pauseBottom, stackTopMin } from '../../src/input/stack';

describe('pauseBottom', () => {
  it.each([
    [0, 60],
    [24, 84],
  ])('returns %i inset plus the pause geometry as %i', (insetTop, expected) => {
    expect(pauseBottom(insetTop)).toBe(expected);
  });

  it('returns a finite number at zero inset', () => {
    expect(Number.isFinite(pauseBottom(0))).toBe(true);
  });
});

describe('stackTopMin', () => {
  it('leaves room for the 12 px label rise at zero inset', () => {
    expect(LABEL_RISE).toBe(12);
    expect(stackTopMin(0)).toBe(pauseBottom(0) + LABEL_RISE);
  });

  it.each([0, 24, 48])('keeps the same offset at inset %i', (insetTop) => {
    expect(stackTopMin(insetTop) - pauseBottom(insetTop)).toBe(
      stackTopMin(0) - pauseBottom(0),
    );
  });

  it('returns a finite number at zero inset', () => {
    expect(Number.isFinite(stackTopMin(0))).toBe(true);
  });
});
