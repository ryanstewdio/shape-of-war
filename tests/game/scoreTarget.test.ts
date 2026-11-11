// foundry-score-target: the scoreInTime target follows DIFFICULTY[d].parScale, applied once in createGame.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { targetsFor } from '../../src/core/stars';
import { levelWithTarget, objectiveFor } from '../../src/game/difficulty';
import { createGame } from '../../src/game/game';
import { evaluateObjective, objectiveMet } from '../../src/game/objective';
import { generateLevel } from '../../src/levelgen/generator';
import { V10_GEN_CONFIG, type LevelDef, type ObjectiveDef } from '../../src/levelgen/leveldef';

afterEach(() => bus.clear());

const TESTER_L4 = (): LevelDef => generateLevel(2471588027, 4, V10_GEN_CONFIG); // V11 made this level a survive; pin V10

function scoreTarget(o: ObjectiveDef): number {
  if (o.kind !== 'scoreInTime') throw new Error('not a score level');
  return o.target;
}

describe('objectiveFor and levelWithTarget', () => {
  it('scales a scoreInTime target by parScale like par and the stars', () => {
    const o: ObjectiveDef = { kind: 'scoreInTime', target: 600_000, timeLimitSec: 200 };
    expect(scoreTarget(objectiveFor(o, 'easy'))).toBe(480_000);
    expect(scoreTarget(objectiveFor(o, 'hard'))).toBe(690_000);
    expect(scoreTarget(objectiveFor(o, 'insane'))).toBe(780_000);
    expect(objectiveFor(o, 'normal')).toBe(o);
  });

  it('leaves survive and destroy alone, and never mutates', () => {
    const s: ObjectiveDef = { kind: 'survive', durationSec: 90 };
    const d: ObjectiveDef = { kind: 'destroy', count: 40 };
    for (const k of DIFFICULTIES) {
      expect(objectiveFor(s, k)).toBe(s);
      expect(objectiveFor(d, k)).toBe(d);
    }
    const lv = TESTER_L4();
    const before = JSON.stringify(lv);
    const hard = levelWithTarget(lv, 'hard');
    expect(JSON.stringify(lv)).toBe(before);
    expect(hard).not.toBe(lv);
    expect(hard.waves).toBe(lv.waves);
    expect(levelWithTarget(lv, 'normal')).toBe(lv);
  });

  it('the target never exceeds the 1 star line at any difficulty (200 levels)', () => {
    let n = 0;
    for (let s = 1; s <= 10; s++) {
      for (let l = 1; l <= 60; l += 3) {
        const def = generateLevel(s * 104729, l);
        if (def.objective.kind !== 'scoreInTime') continue;
        n++;
        for (const k of DIFFICULTIES) expect(scoreTarget(objectiveFor(def.objective, k, undefined, def.difficultyPar?.[k]?.goal))).toBeLessThanOrEqual(targetsFor(def, k).stars[0]);
      }
    }
    expect(n).toBeGreaterThan(10);
  }, 60_000);
});

describe('createGame applies the target once', () => {
  it('Normal keeps the generated level object, so a normal run is bit identical', () => {
    const lv = TESTER_L4();
    const w = createGame(lv, { difficulty: 'normal' });
    expect(w.level).toBe(lv);
  });

  for (const d of ['easy', 'insane'] as const) {
    it(`${d}: the sim's success check reads the scaled target`, () => {
      const lv = TESTER_L4();
      const w = createGame(lv, { difficulty: d });
      const t = scoreTarget(w.level.objective);
      expect(t).toBe(Math.round(scoreTarget(lv.objective) * DIFFICULTY[d].parScale));
      const base = { objective: w.level.objective, mode: 'adventure' as const, kills: 0, lives: 3, clock: 300 };
      expect(objectiveMet({ ...base, score: t })).toBe(true);
      expect(objectiveMet({ ...base, score: t - 1 })).toBe(false);
      expect(evaluateObjective({ ...base, score: t })).toBe('won');
      expect(evaluateObjective({ ...base, score: t - 1 })).toBe('lost');
    });
  }
});
