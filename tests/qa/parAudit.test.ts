// Par audit (brief proctor-par-audit): scripts/par-audit.ts on one seed, run twice, must give the
// same rows and byte identical reports. The script's pure core takes the real src/ modules.
// foundry-guardian-par: after V14 the guardian par is s_d of the available score at the tiered fight.
import { describe, expect, it } from 'vitest';
import * as coreDifficulty from '../../src/core/difficulty';
import * as stars from '../../src/core/stars';
import * as bossTable from '../../src/game/bosses/table';
import * as gameDifficulty from '../../src/game/difficulty';
import * as scoring from '../../src/game/scoring';
import * as spawner from '../../src/game/spawner';
import * as boss from '../../src/levelgen/boss';
import * as generator from '../../src/levelgen/generator';
import * as guardianPar from '../../src/levelgen/guardianPar';
import * as levelDef from '../../src/levelgen/leveldef';
import * as pacing from '../../src/levelgen/pacing';
import * as validate from '../../src/levelgen/validate';
import { AUDIT_SEEDS, V14_SHARE_TOLERANCE, auditPar, depsFrom, guardianShareSummary, median, proposeGuardianPar, renderAfterV14, renderProposal, renderReport } from '../../scripts/par-audit';

const deps = depsFrom({ generator, coreDifficulty, stars, gameDifficulty, bossTable, spawner, scoring, pacing, levelDef, boss, validate, guardianPar });
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
      expect(r.par).toBe(stars.targetsFor(def, r.difficulty).par);
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

  it('after V14: guardian par / available is within 0.02 of s_d at the tiered fight, levels 5 to 50, every seed and difficulty', () => {
    const res = auditPar(deps, { seeds: AUDIT_SEEDS, levels: 50, tieredFight: true });
    const g = res.rows.filter((r) => r.type === 'guardian');
    expect(g).toHaveLength(10 * AUDIT_SEEDS.length * deps.DIFFICULTIES.length);
    for (const r of g) {
      expect(r.levelSec, `seed ${r.seed} level ${r.level}`).toBeLessThanOrEqual(85 + 150);
      expect(Math.abs(r.parShare - deps.guardianParShare[r.difficulty]), `seed ${r.seed} level ${r.level} ${r.difficulty}`).toBeLessThanOrEqual(V14_SHARE_TOLERANCE);
      expect(r.flag).toBe('');
    }
    const sum = guardianShareSummary(res, deps);
    for (const d of deps.DIFFICULTIES) expect(sum[d].worst).toBeLessThanOrEqual(V14_SHARE_TOLERANCE);
    const text = renderAfterV14(res, deps, [{ fightSec: 30, res: auditPar(deps, { seeds: AUDIT_SEEDS, levels: 50, fightSec: 30 }) }]);
    expect(text).toContain('### Guardian par after V14 (tiered fight)');
    expect(text.split('\n').filter((l) => /^\| \d+ \| \d+ \| [a-z]+ \|/.test(l))).toHaveLength(10 * AUDIT_SEEDS.length);
  });

  it('non guardian rows keep their par share with the tiered fight on', () => {
    const a = auditPar(deps, OPTS);
    const b = auditPar(deps, { ...OPTS, tieredFight: true });
    const plain = (r: (typeof a.rows)[number]): boolean => r.type !== 'guardian';
    expect(b.rows.filter(plain)).toEqual(a.rows.filter(plain));
  });

  it('median is the middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
