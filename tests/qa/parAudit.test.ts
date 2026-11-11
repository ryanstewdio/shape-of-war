// Par audit (brief proctor-par-audit): scripts/par-audit.ts on one seed, run twice, must give the
// same rows and byte identical reports. The script's pure core takes the real src/ modules.
import { describe, expect, it } from 'vitest';
import * as coreDifficulty from '../../src/core/difficulty';
import * as stars from '../../src/core/stars';
import * as bossTable from '../../src/game/bosses/table';
import * as gameDifficulty from '../../src/game/difficulty';
import * as scoring from '../../src/game/scoring';
import * as spawner from '../../src/game/spawner';
import * as boss from '../../src/levelgen/boss';
import * as generator from '../../src/levelgen/generator';
import * as levelDef from '../../src/levelgen/leveldef';
import * as pacing from '../../src/levelgen/pacing';
import * as validate from '../../src/levelgen/validate';
import { auditPar, depsFrom, median, proposeGuardianPar, renderProposal, renderReport } from '../../scripts/par-audit';

const deps = depsFrom({ generator, coreDifficulty, stars, gameDifficulty, bossTable, spawner, scoring, pacing, levelDef, boss, validate });
const OPTS = { seeds: [1], levels: 20 } as const;

describe('par audit', () => {
  it('is deterministic on one seed: same rows, same report, same proposal', () => {
    const a = auditPar(deps, OPTS);
    const b = auditPar(deps, OPTS);
    expect(b.rows).toEqual(a.rows);
    expect(renderReport(b, deps.DIFFICULTIES)).toBe(renderReport(a, deps.DIFFICULTIES));
    const pa = proposeGuardianPar(deps, a, OPTS);
    const pb = proposeGuardianPar(deps, b, OPTS);
    expect(renderProposal(pb, deps.DIFFICULTIES)).toBe(renderProposal(pa, deps.DIFFICULTIES));
  });

  it('covers every level and difficulty with finite shares, and par matches targetsFor', () => {
    const res = auditPar(deps, OPTS);
    expect(res.rows).toHaveLength(OPTS.levels * deps.DIFFICULTIES.length);
    for (const r of res.rows) {
      expect(r.available).toBeGreaterThan(0);
      expect(Number.isFinite(r.parShare)).toBe(true);
      const def = generator.generateLevel(r.seed, r.level);
      expect(r.par).toBe(stars.targetsFor({ par: def.par, stars: def.stars }, r.difficulty).par);
      expect(r.goal === null).toBe(def.objective.kind !== 'scoreInTime');
    }
  });

  it('a guardian level on Easy plays no regular enemy after the entrance', () => {
    const res = auditPar(deps, OPTS);
    const full = auditPar({ ...deps, WAVE_BUDGET_WITH_BOSS: { easy: 1, normal: 1, hard: 1, insane: 1 } }, OPTS);
    const g = res.rows.filter((r) => r.type === 'guardian');
    expect(g.length).toBeGreaterThan(0);
    for (const r of g) {
      const f = full.rows.find((q) => q.seed === r.seed && q.level === r.level && q.difficulty === r.difficulty);
      expect(f).toBeDefined();
      if (f === undefined) continue;
      expect(r.spawns).toBeLessThanOrEqual(f.spawns);
      if (r.difficulty === 'easy') expect(r.spawns).toBeLessThan(f.spawns);
    }
  });

  it('median is the middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
