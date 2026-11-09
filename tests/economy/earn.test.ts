import { describe, expect, it } from 'vitest';
import {
  awardsFor,
  bossAwardId,
  EARN_TABLE,
  milestoneAwardId,
  starAwardId,
  totalGems,
  type ResultEvent,
} from '../../src/economy/earn';

const base: ResultEvent = {
  mode: 'adventure',
  levelIndex: 3,
  difficulty: 'normal',
  starsBefore: 0,
  starsAfter: 0,
  bossLevel: false,
  success: true,
  score: 1000,
};

describe('earn table', () => {
  it('holds the docs/16 placeholders', () => {
    expect(EARN_TABLE.perStar).toBe(5);
    expect(EARN_TABLE.bossFirstClear).toBe(50);
    expect(EARN_TABLE.freePlay).toBe(0);
    const gems = EARN_TABLE.endlessMilestones.map((m) => m.gems);
    expect(Math.min(...gems)).toBe(10);
    expect(Math.max(...gems)).toBe(100);
    const scores = EARN_TABLE.endlessMilestones.map((m) => m.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });
});

describe('adventure stars', () => {
  it('pays 5 for the first star and 5 for each further one', () => {
    const a = awardsFor({ ...base, starsBefore: 0, starsAfter: 2 });
    expect(a.map((x) => x.id)).toEqual([starAwardId(3, 1), starAwardId(3, 2)]);
    expect(totalGems(a)).toBe(10);
  });

  it('pays only stars above the stored best', () => {
    const a = awardsFor({ ...base, difficulty: 'hard', starsBefore: 2, starsAfter: 3 });
    expect(a).toEqual([{ id: starAwardId(3, 3), source: 'star', gems: 5 }]);
  });

  it('pays nothing when no new star is reached', () => {
    expect(awardsFor({ ...base, starsBefore: 2, starsAfter: 2 })).toEqual([]);
    expect(awardsFor({ ...base, starsBefore: 2, starsAfter: 1 })).toEqual([]);
  });

  it('caps the stars a run can lift to its difficulty', () => {
    expect(totalGems(awardsFor({ ...base, difficulty: 'easy', starsAfter: 3 }))).toBe(5);
    expect(totalGems(awardsFor({ ...base, difficulty: 'normal', starsAfter: 3 }))).toBe(10);
    expect(totalGems(awardsFor({ ...base, difficulty: 'hard', starsAfter: 4 }))).toBe(15);
    expect(totalGems(awardsFor({ ...base, difficulty: 'insane', starsAfter: 4 }))).toBe(20);
  });

  it('ignores bad star counts and level indexes', () => {
    expect(awardsFor({ ...base, starsAfter: Number.NaN })).toEqual([]);
    expect(awardsFor({ ...base, levelIndex: -1, starsAfter: 2 })).toEqual([]);
    expect(awardsFor({ ...base, levelIndex: 1.5, starsAfter: 2 })).toEqual([]);
  });

  it('pays the boss first clear once per boss level on a win', () => {
    const a = awardsFor({ ...base, bossLevel: true, starsAfter: 1 });
    expect(a.find((x) => x.source === 'bossClear')).toEqual({ id: bossAwardId(3), source: 'bossClear', gems: 50 });
    expect(awardsFor({ ...base, bossLevel: true, success: false })).toEqual([]);
    expect(awardsFor({ ...base, bossLevel: false, success: true })).toEqual([]);
  });

  it('leaves out claimed ids so a replayed star or boss pays nothing', () => {
    const e: ResultEvent = { ...base, bossLevel: true, starsAfter: 2 };
    const claimed = new Set(awardsFor(e).map((a) => a.id));
    expect(awardsFor(e, claimed)).toEqual([]);
  });
});

describe('endless milestones', () => {
  const endless: ResultEvent = { ...base, mode: 'endless', levelIndex: 0 };

  it('pays every milestone the score reached', () => {
    const a = awardsFor({ ...endless, score: 50_000 });
    expect(a.map((x) => x.id)).toEqual([milestoneAwardId(10_000), milestoneAwardId(25_000), milestoneAwardId(50_000)]);
    expect(totalGems(a)).toBe(60);
  });

  it('pays nothing below the first milestone or for a bad score', () => {
    expect(awardsFor({ ...endless, score: 9_999 })).toEqual([]);
    expect(awardsFor({ ...endless, score: Number.POSITIVE_INFINITY })).toEqual([]);
  });

  it('pays each milestone once', () => {
    const claimed = new Set(awardsFor({ ...endless, score: 30_000 }).map((a) => a.id));
    const next = awardsFor({ ...endless, score: 120_000 }, claimed);
    expect(next.map((x) => x.id)).toEqual([milestoneAwardId(50_000), milestoneAwardId(100_000)]);
  });

  it('does not depend on difficulty or stars', () => {
    const a = awardsFor({ ...endless, score: 25_000, difficulty: 'easy' });
    const b = awardsFor({ ...endless, score: 25_000, difficulty: 'insane', starsAfter: 4 });
    expect(a).toEqual(b);
  });
});

describe('free play', () => {
  it('pays nothing whatever the result', () => {
    for (const difficulty of ['easy', 'normal', 'hard', 'insane'] as const) {
      expect(
        awardsFor({ ...base, mode: 'freeplay', difficulty, starsAfter: 4, bossLevel: true, score: 9_999_999 }),
      ).toEqual([]);
    }
  });
});
