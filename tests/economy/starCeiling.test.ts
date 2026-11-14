import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../../src/core/difficulty';
import { awardStars, INSANE_STARS, STAR_CAP } from '../../src/core/stars';
import { awardsFor, starCeiling, totalGems, type ResultEvent } from '../../src/economy/earn';

function run(difficulty: Difficulty, starsBefore: number, starsAfter: number): ResultEvent {
  return {
    mode: 'adventure',
    levelIndex: 2,
    difficulty,
    starsBefore,
    starsAfter,
    bossLevel: false,
    success: true,
    score: 1000,
  };
}

describe('starCeiling', () => {
  it.each([
    ['easy', 1],
    ['normal', 2],
    ['hard', 3],
    ['insane', 4],
  ] as const)('%s has a ceiling of %i stars', (difficulty, ceiling) => {
    expect(starCeiling(difficulty)).toBe(ceiling);
  });

  it('uses the score caps and the separate insane completion award', () => {
    expect(starCeiling('easy')).toBe(STAR_CAP.easy);
    expect(starCeiling('normal')).toBe(STAR_CAP.normal);
    expect(starCeiling('hard')).toBe(STAR_CAP.hard);
    expect(starCeiling('insane')).toBe(INSANE_STARS);
    expect(STAR_CAP.insane).toBe(3);
  });

  it('returns repeatable integers in difficulty order', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard', 'insane']);
    expect(DIFFICULTIES.map(starCeiling)).toEqual([1, 2, 3, 4]);
    for (const difficulty of DIFFICULTIES) {
      const ceiling = starCeiling(difficulty);
      expect(Number.isInteger(ceiling)).toBe(true);
      expect(starCeiling(difficulty)).toBe(ceiling);
    }
  });

  it.each(['nightmare', ''])('falls back to normal for unknown difficulty %j', (value) => {
    const difficulty = value as unknown as Difficulty;
    expect(starCeiling(difficulty)).toBe(2);
    expect(starCeiling(difficulty)).toBe(STAR_CAP.normal);
  });

  it.each(DIFFICULTIES)('agrees with awardStars on %s', (difficulty) => {
    expect(awardStars(99, difficulty, true)).toBe(starCeiling(difficulty));
    expect(awardStars(99, difficulty, false)).toBe(0);
  });
});

describe('starCeiling in adventure awards', () => {
  const expectedIds: Record<Difficulty, readonly string[]> = {
    easy: ['earn:star:2:1'],
    normal: ['earn:star:2:1', 'earn:star:2:2'],
    hard: ['earn:star:2:1', 'earn:star:2:2', 'earn:star:2:3'],
    insane: ['earn:star:2:1', 'earn:star:2:2', 'earn:star:2:3', 'earn:star:2:4'],
  };

  it.each(DIFFICULTIES)('pays one award per star up to the %s ceiling', (difficulty) => {
    const ceiling = starCeiling(difficulty);
    const awards = awardsFor(run(difficulty, 0, 4));
    expect(awards).toHaveLength(ceiling);
    expect(awards.map((award) => award.id)).toEqual(expectedIds[difficulty]);
    for (const award of awards) {
      expect(award.source).toBe('star');
      expect(award.gems).toBe(5);
    }
    expect(totalGems(awards)).toBe(5 * ceiling);
  });

  it('pays the capped totals in difficulty order', () => {
    expect(DIFFICULTIES.map((difficulty) => totalGems(awardsFor(run(difficulty, 0, 4)))))
      .toEqual([5, 10, 15, 20]);
  });

  it.each(DIFFICULTIES)('caps huge claims and ignores nonfinite claims on %s', (difficulty) => {
    expect(awardsFor(run(difficulty, 0, 99))).toHaveLength(starCeiling(difficulty));
    expect(awardsFor(run(difficulty, 0, Number.POSITIVE_INFINITY))).toEqual([]);
  });

  it('keeps a stored best of three and pays only the insane fourth star', () => {
    expect(awardsFor(run('easy', 3, 4))).toEqual([]);
    expect(awardsFor(run('normal', 3, 4))).toEqual([]);
    expect(awardsFor(run('hard', 3, 4))).toEqual([]);
    expect(awardsFor(run('insane', 3, 4))).toEqual([
      { id: 'earn:star:2:4', source: 'star', gems: 5 },
    ]);
  });

  it('pays only new stars below the ceiling when the stored best is one', () => {
    expect(awardsFor(run('easy', 1, 3))).toEqual([]);
    expect(awardsFor(run('normal', 1, 3))).toEqual([
      { id: 'earn:star:2:2', source: 'star', gems: 5 },
    ]);
    expect(awardsFor(run('hard', 1, 3)).map((award) => award.id)).toEqual([
      'earn:star:2:2', 'earn:star:2:3',
    ]);
  });

  it.each(DIFFICULTIES)('pays through the %s ceiling and nothing beyond it', (difficulty) => {
    const ceiling = starCeiling(difficulty);
    expect(awardsFor(run(difficulty, 0, ceiling))).toHaveLength(ceiling);
    expect(awardsFor(run(difficulty, ceiling, 4))).toEqual([]);
    if (ceiling > 1) {
      expect(awardsFor(run(difficulty, 0, ceiling - 1))).toHaveLength(ceiling - 1);
    }
  });
});
