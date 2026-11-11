// foundry-guardian-par: targetsFor reads a level's per difficulty par when present (version 14
// guardian levels) and falls back to par x parScale when absent.
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY } from '../../src/core/difficulty';
import { isTargetEntry, scaleTarget, targetsFor } from '../../src/core/stars';
import type { ParTargets } from '../../src/core/stars';

const LEVEL: ParTargets = { par: 10_000, stars: [10_000, 12_500, 15_000] };
const OWN: Record<'easy' | 'normal' | 'hard' | 'insane', ParTargets> = {
  easy: { par: 4000, stars: [4000, 5000, 6000] },
  normal: { par: 10_000, stars: [10_000, 12_500, 15_000] },
  hard: { par: 16_000, stars: [16_000, 20_000, 24_000] },
  insane: { par: 21_000, stars: [21_000, 26_500, 31_500] },
};

describe('targetsFor with per difficulty par', () => {
  it('falls back to par x parScale when the level carries no entries', () => {
    for (const d of DIFFICULTIES) {
      const k = DIFFICULTY[d].parScale;
      expect(targetsFor(LEVEL, d)).toEqual({ par: scaleTarget(10_000, k), stars: LEVEL.stars.map((v) => scaleTarget(v, k)) });
    }
  });

  it('reads the entry for the run difficulty, ignoring parScale', () => {
    for (const d of DIFFICULTIES) expect(targetsFor({ ...LEVEL, difficultyPar: OWN }, d)).toEqual(OWN[d]);
    const table = { easy: { parScale: 9 }, normal: { parScale: 9 }, hard: { parScale: 9 }, insane: { parScale: 9 } };
    expect(targetsFor({ ...LEVEL, difficultyPar: OWN }, 'hard', table)).toEqual(OWN.hard);
  });

  it('returns a fresh stars tuple, never the stored one', () => {
    const level = { ...LEVEL, difficultyPar: OWN };
    const t = targetsFor(level, 'easy');
    expect(t.stars).not.toBe(OWN.easy.stars);
  });

  it('falls back per difficulty when an entry is missing or unusable', () => {
    const k = DIFFICULTY.hard.parScale;
    expect(targetsFor({ ...LEVEL, difficultyPar: { easy: OWN.easy } }, 'hard').par).toBe(scaleTarget(10_000, k));
    expect(targetsFor({ ...LEVEL, difficultyPar: { ...OWN, hard: { par: 0, stars: [0, 0, 0] } } }, 'hard').par).toBe(scaleTarget(10_000, k));
    expect(targetsFor({ ...LEVEL, difficultyPar: { ...OWN, hard: { par: Number.NaN, stars: [1, 2, 3] } } }, 'hard').par).toBe(scaleTarget(10_000, k));
    expect(targetsFor({ ...LEVEL, difficultyPar: { easy: OWN.easy } }, 'easy')).toEqual(OWN.easy);
  });

  it('isTargetEntry accepts a positive finite par with three finite stars', () => {
    expect(isTargetEntry(OWN.normal)).toBe(true);
    expect(isTargetEntry(undefined)).toBe(false);
    expect(isTargetEntry({ par: -1, stars: [1, 2, 3] })).toBe(false);
    expect(isTargetEntry({ par: 1000, stars: [1, 2] as unknown as [number, number, number] })).toBe(false);
    expect(isTargetEntry({ par: 1000, stars: [1, Number.POSITIVE_INFINITY, 3] })).toBe(false);
  });
});
