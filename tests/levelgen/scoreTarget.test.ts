// foundry-score-target (tester 1): on whole level par levels the scoreInTime goal is 0.6 x par.
import { describe, expect, it } from 'vitest';
import { generateLevel, wholeLevelTarget, WHOLE_TARGET_FRACTION } from '../../src/levelgen/generator';
import { V1_GEN_CONFIG, V2_GEN_CONFIG, V3_GEN_CONFIG, V4_GEN_CONFIG, V5_GEN_CONFIG, V6_GEN_CONFIG, type GenConfig, type LevelDef } from '../../src/levelgen/leveldef';
import { PAR_MIN, PAR_STEP, validateLevel } from '../../src/levelgen/validate';

const SEEDS = 500;
/** Seed i plays the levels l with l mod 10 === i mod 10: 6 levels per seed, 50 seeds per level, 3000 levels. */
const seedAt = (i: number): number => (Math.imul(i + 1, 2654435761) ^ 0x5bd1e995) >>> 0;

function scoreLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let i = 0; i < SEEDS; i++) {
    for (let l = 1 + (i % 10); l <= 60; l += 10) {
      const d = generateLevel(seedAt(i), l);
      if (d.objective.kind === 'scoreInTime') out.push(d);
    }
  }
  return out;
}

describe('wholeLevelTarget', () => {
  it('is 0.6 x par on the PAR_STEP grid, at least PAR_MIN, at most par', () => {
    expect(WHOLE_TARGET_FRACTION).toBe(0.6);
    expect(wholeLevelTarget(1_000_000)).toBe(600_000);
    expect(wholeLevelTarget(788_000)).toBe(473_000);
    expect(wholeLevelTarget(1000)).toBe(1000);
    expect(wholeLevelTarget(1500)).toBe(1000);
    for (const par of [1000, 2500, 13_500, 777_500, 9_999_500]) {
      const t = wholeLevelTarget(par);
      expect(t % PAR_STEP).toBe(0);
      expect(t).toBeGreaterThanOrEqual(PAR_MIN);
      expect(t).toBeLessThanOrEqual(par);
    }
  });
});

describe('scoreInTime target on the release config', () => {
  const levels = scoreLevels();

  it('500 seeds over levels 1 to 60: every target is 0.6 x par within one PAR_STEP and validates', () => {
    expect(levels.length).toBeGreaterThan(300);
    const seen = new Set(levels.map((d) => d.levelIndex));
    expect(seen.size).toBeGreaterThan(40);
    for (const d of levels) {
      if (d.objective.kind !== 'scoreInTime') throw new Error('kind');
      expect(Math.abs(d.objective.target - 0.6 * d.par), `L${d.levelIndex} seed ${d.seed}`).toBeLessThanOrEqual(PAR_STEP);
      expect(d.objective.target).toBeLessThanOrEqual(d.stars[0]);
    }
    for (const d of levels.slice(0, 60)) expect(validateLevel(d).errors).toEqual([]);
  }, 120_000);

  it("level 4 of a tester style random seed: goal near 600K at Normal (was about 11K)", () => {
    const d = generateLevel(2471588027, 4);
    expect(d.objective.kind).toBe('scoreInTime');
    if (d.objective.kind !== 'scoreInTime') return;
    expect(d.objective.target).toBe(576_500);
    expect(d.objective.target).toBeGreaterThan(500_000);
    expect(d.objective.target).toBeLessThan(700_000);
    expect(d.objective.target).toBe(wholeLevelTarget(d.par));
  });

  it('V6 (R1, whole level par) levels take the new target too', () => {
    let n = 0;
    for (let s = 1; s <= 10; s++) {
      for (let l = 1; l <= 30; l++) {
        const d = generateLevel(s, l, V6_GEN_CONFIG);
        if (d.objective.kind !== 'scoreInTime' || d.generatorVersion !== 6) continue;
        expect(d.objective.target).toBe(wholeLevelTarget(d.par));
        n++;
      }
    }
    expect(n).toBeGreaterThan(5);
  });
});

describe('legacy configs keep their old targets', () => {
  // Sums of every scoreInTime target, seeds 1 to 6, levels 1 to 30, pinned on main at ec2c391.
  const PINS: readonly [string, Readonly<GenConfig>, number, number][] = [
    ['V1', V1_GEN_CONFIG, 61, 2105500],
    ['V2', V2_GEN_CONFIG, 61, 8045000],
    ['V3', V3_GEN_CONFIG, 61, 8045000],
    ['V4', V4_GEN_CONFIG, 61, 7951000],
    ['V5', V5_GEN_CONFIG, 61, 8331500],
  ];
  for (const [name, cfg, count, sum] of PINS) {
    it(`${name} targets are unchanged`, () => {
      const t: number[] = [];
      for (let s = 1; s <= 6; s++) {
        for (let l = 1; l <= 30; l++) {
          const d = generateLevel(s, l, cfg);
          if (d.objective.kind === 'scoreInTime') t.push(d.objective.target);
        }
      }
      expect(t.length).toBe(count);
      expect(t.reduce((a, b) => a + b, 0)).toBe(sum);
    }, 60_000);
  }
});
