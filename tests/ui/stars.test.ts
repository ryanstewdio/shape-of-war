// R1: stars include the relative difficulty. Score stars are capped per difficulty (Easy 1,
// Normal 2, Hard 3), an Insane win is 4 outright, and a saved best keeps the higher star count with
// the difficulty it was earned on.
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../../src/core/difficulty';
import {
  ADVENTURE_SCORES_KEY,
  loadAdventureScores,
  mergeAdventureScore,
  parseAdventureScores,
  recordAdventureScore,
  type StorageLike,
} from '../../src/core/settings';
import { asStarCount, awardStars, INSANE_STARS, STAR_CAP } from '../../src/core/stars';
import { levelButtonLabel, levelPage } from '../../src/ui/levelSelect';
import { resultLines } from '../../src/ui/results';
import type { LevelResult } from '../../src/ui/flow';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('star caps per difficulty', () => {
  it('caps the score stars at Easy 1, Normal 2, Hard 3', () => {
    expect(STAR_CAP).toEqual({ easy: 1, normal: 2, hard: 3, insane: 3 });
    for (const s of [0, 1, 2, 3]) {
      expect(awardStars(s, 'easy', true), `easy ${s}`).toBe(Math.min(s, 1));
      expect(awardStars(s, 'normal', true), `normal ${s}`).toBe(Math.min(s, 2));
      expect(awardStars(s, 'hard', true), `hard ${s}`).toBe(s);
    }
  });

  it('no difficulty below Hard can give 3 stars', () => {
    for (const d of ['easy', 'normal'] as const) for (const s of [0, 1, 2, 3, 99]) expect(awardStars(s, d, true)).toBeLessThan(3);
  });

  it('completing a level on Insane gives 4 whatever the score', () => {
    expect(INSANE_STARS).toBe(4);
    for (const s of [0, 1, 2, 3]) expect(awardStars(s, 'insane', true)).toBe(4);
  });

  it('R2 P0: a failed attempt gives 0 stars on every difficulty, whatever the score', () => {
    for (const d of DIFFICULTIES) for (const s of [0, 1, 2, 3, 99]) expect(awardStars(s, d, false), `${d} ${s}`).toBe(0);
  });

  it('only Insane can ever give 4, and junk counts give 0', () => {
    for (const d of DIFFICULTIES) if (d !== 'insane') for (const ok of [true, false]) expect(awardStars(3, d, ok)).toBeLessThan(4);
    expect(awardStars(Number.NaN, 'hard', true)).toBe(0);
    expect(awardStars(-2, 'normal', true)).toBe(0);
    expect(asStarCount(5)).toBe(0);
    expect(asStarCount('4')).toBe(0);
    expect(asStarCount(4)).toBe(4);
  });
});

describe('best stars replacement', () => {
  it('a better star count replaces a worse one, with its difficulty', () => {
    let s = mergeAdventureScore({}, 3, 5000, 1, 'easy').scores;
    expect(s['3']).toEqual({ best: 5000, stars: 1, difficulty: 'easy' });
    s = mergeAdventureScore(s, 3, 4000, 3, 'hard').scores;
    expect(s['3']).toEqual({ best: 5000, stars: 3, difficulty: 'hard' });
    s = mergeAdventureScore(s, 3, 1000, 4, 'insane').scores;
    expect(s['3']).toEqual({ best: 5000, stars: 4, difficulty: 'insane' });
  });

  it('an equal or worse star count keeps the stored stars and difficulty', () => {
    let s = mergeAdventureScore({}, 2, 3000, 2, 'normal').scores;
    s = mergeAdventureScore(s, 2, 9000, 2, 'hard').scores;
    expect(s['2']).toEqual({ best: 9000, stars: 2, difficulty: 'normal' });
    s = mergeAdventureScore(s, 2, 100, 1, 'easy').scores;
    expect(s['2']).toEqual({ best: 9000, stars: 2, difficulty: 'normal' });
  });

  it('a pre R1 entry without a difficulty loads, and is upgraded by a better result', () => {
    const old = parseAdventureScores(JSON.stringify({ '1': { best: 4000, stars: 3 }, '2': { best: 10, stars: 1, difficulty: 'nightmare' } }));
    expect(old['1']).toEqual({ best: 4000, stars: 3 });
    expect(old['2']).toEqual({ best: 10, stars: 1 });
    expect(mergeAdventureScore(old, 1, 10, 2, 'normal').scores['1']).toEqual({ best: 4000, stars: 3 });
    expect(mergeAdventureScore(old, 1, 10, 4, 'insane').scores['1']).toEqual({ best: 4000, stars: 4, difficulty: 'insane' });
  });

  it('round trips 4 stars and the difficulty through the one scores key', () => {
    const st = memory();
    recordAdventureScore(5, 2500, 4, st, 'insane');
    expect([...st.data.keys()]).toEqual([ADVENTURE_SCORES_KEY]);
    expect(loadAdventureScores(st)['5']).toEqual({ best: 2500, stars: 4, difficulty: 'insane' });
    recordAdventureScore(5, 9000, 2, st, 'normal');
    expect(loadAdventureScores(st)['5']).toEqual({ best: 9000, stars: 4, difficulty: 'insane' });
  });
});

describe('4 stars on screen', () => {
  const base: LevelResult = { mode: 'adventure', levelIndex: 4, score: 900, stars: 4, success: true, par: 1000, best: 900, newBest: true, hash: 'ABCD1234' };

  it('results show three glyphs, the 4th star flag and the difficulty line', () => {
    const t = resultLines({ ...base, difficulty: 'insane' });
    expect(t.stars).toBe('★★★');
    expect(t.fourthStar).toBe(true);
    expect(t.difficulty).toBe('Insane');
    const n = resultLines({ ...base, stars: 2, difficulty: 'normal' });
    expect(n.stars).toBe('★★☆');
    expect(n.fourthStar).toBe(false);
    expect(n.difficulty).toBe('Normal');
    expect(resultLines({ ...base, stars: 1 }).difficulty).toBe('');
  });

  it('level select carries the 4 stars from the saved best', () => {
    const page = levelPage(2, { '1': { best: 900, stars: 4, difficulty: 'insane' } }, 0);
    expect(page.entries[0]?.stars).toBe(4);
    expect(levelButtonLabel({ index: 1, stars: 4, best: 900 })).toBe('1\n★★★');
  });
});
