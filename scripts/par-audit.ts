// Par audit (brief proctor-par-audit, Ryan 2026-11-11: par on level 15 is hard to reach on Normal).
// Run: node scripts/par-audit.ts   (Node 22.18 or later strips the types itself)
//
// For Adventure levels 1 to 50 on AUDIT_SEEDS and every difficulty, the script reports par and the
// star thresholds, the score available in the level time, par as a share of that score, and the
// same share for a score race goal. Outliers are flagged against the median of non guardian levels.
//
// Score available: every scheduled enemy that actually spawns in the level time, killed, at the
// par model's own geom collect rate (V10_COLLECT_RATE), plus the guardian kill bonus. "Actually
// spawns" follows src/game/spawner.ts enqueueDueWaves: each wave plays scaledCount(entries,
// spawnRate) entries (repeats REPEAT_STAGGER s apart), and while a guardian lives each entry goes
// through the WAVE_BUDGET_WITH_BOSS[difficulty] accumulator (src/game/bosses/core.ts
// keepScheduledEntry). Level time is the par model's own window (src/levelgen/pacing.ts):
// objectiveSec on a non guardian level, the entrance plus BOSS_FIGHT_SEC on a guardian level.
// Guardian adds (Broodlings, Ember Leavers, Bastion adds) are not counted.
//
// src/ modules use extensionless imports, which bare Node cannot resolve, so the CLI loads them
// through a vite dev server in middleware mode (as scripts/guide-images.ts does). The audit itself
// is a pure function of injected modules, so the test passes the real modules directly. No clock,
// no PRNG: two runs give byte identical output.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Difficulty, DifficultyTable } from '../src/core/difficulty';
import type { ParTargets } from '../src/core/stars';
import type { EnemyKind, LevelDef, ObjectiveDef } from '../src/levelgen/leveldef';

/** Run seeds of the audit. */
export const AUDIT_SEEDS: readonly number[] = Object.freeze([1, 1000, 424242]);
/** Adventure levels audited. */
export const AUDIT_LEVELS = 50;
/** A share above median x this is flagged high (par harder than usual), below median / this low. */
export const OUTLIER_BAND = 1.25;
/** Seconds of the short fight sensitivity run (guardian levels only). */
export const SHORT_FIGHT_SEC = 60;

/** The parts of src/ the audit reads. Every field is a real export, injected. */
export interface AuditDeps {
  readonly generateLevel: (runSeed: number, levelIndex: number) => LevelDef;
  readonly DIFFICULTIES: readonly Difficulty[];
  readonly DIFFICULTY: Readonly<Record<Difficulty, DifficultyTable>>;
  readonly targetsFor: (level: ParTargets, d: Difficulty) => ParTargets;
  readonly objectiveFor: (o: ObjectiveDef, d: Difficulty) => ObjectiveDef;
  readonly scaledCount: (n: number, rate: number) => number;
  readonly WAVE_BUDGET_WITH_BOSS: Readonly<Record<Difficulty, number>>;
  readonly REPEAT_STAGGER: number;
  readonly bossBonus: (par: number, mode: 'adventure' | 'endless', tier: number) => number;
  readonly objectiveSec: (o: ObjectiveDef, w: LevelDef['waves']) => number;
  readonly ENEMY_BASE: Readonly<Record<EnemyKind, number>>;
  readonly ENEMY_GEOMS: Readonly<Record<EnemyKind, number>>;
  readonly collectRate: number;
  readonly multiplierCap: number;
  readonly bossFightSec: number;
  readonly parMin: number;
  readonly parStep: number;
  /** Share of par the guardian kill pays (scoring.ts BOSS_BONUS_SHARE). */
  readonly bonusShare: number;
}

export type LevelType = 'guardian' | 'race' | 'survive' | 'destroy';

export interface AuditRow {
  readonly seed: number;
  readonly level: number;
  readonly type: LevelType;
  readonly guardian: string;
  readonly difficulty: Difficulty;
  /** Seconds of level time the available score counts. */
  readonly levelSec: number;
  readonly par: number;
  readonly stars: readonly [number, number, number];
  /** Score race goal on this difficulty, else null. */
  readonly goal: number | null;
  /** Regular enemies spawned in the level time. */
  readonly spawns: number;
  /** Guardian kill bonus (0 off guardian levels). */
  readonly bonus: number;
  readonly available: number;
  readonly parShare: number;
  readonly goalShare: number | null;
  readonly flag: Flag;
  /** The same test on goalShare against the race goal median (empty off races). */
  readonly goalFlag: Flag;
}

export type Flag = '' | 'high' | 'low';

export interface AuditOptions {
  readonly seeds?: readonly number[];
  readonly levels?: number;
  /** Seconds of guardian fight counted (default deps.bossFightSec, the par model's own). */
  readonly fightSec?: number;
}

export interface AuditResult {
  readonly rows: readonly AuditRow[];
  /** Median par share of non guardian rows, by difficulty. */
  readonly parMedian: Readonly<Record<Difficulty, number>>;
  /** Median goal share of non guardian race rows, by difficulty. */
  readonly goalMedian: Readonly<Record<Difficulty, number>>;
}

interface Spawn {
  readonly t: number;
  readonly kind: EnemyKind;
}

/** Pure: median of a list (0 when empty). */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

/** Pure: the level type. */
export function levelType(def: LevelDef): LevelType {
  if (def.boss !== undefined) return 'guardian';
  return def.objective.kind === 'scoreInTime' ? 'race' : def.objective.kind;
}

/**
 * Pure: the regular enemies that spawn before endSec on difficulty d, sorted by time. Walks the
 * schedule as enqueueDueWaves does: waves in order, then the loop; a wave queued at or after
 * bossAtSec has each entry thinned by the guardian share accumulator.
 */
export function spawnsOn(deps: AuditDeps, def: LevelDef, d: Difficulty, endSec: number, bossAtSec: number | null): Spawn[] {
  const w = def.waves;
  const rate = deps.DIFFICULTY[d].spawnRate;
  const share = deps.WAVE_BUDGET_WITH_BOSS[d];
  const roster = new Set(def.roster.map((r) => r.kind));
  const out: Spawn[] = [];
  let acc = 0;
  const keep = (at: number): boolean => {
    if (bossAtSec === null || at < bossAtSec) return true;
    if (share <= 0) return false;
    acc += share;
    if (acc >= 1 - 1e-9) {
      acc -= 1;
      return true;
    }
    return false;
  };
  const play = (wave: LevelDef['waves']['waves'][number], shift: number): void => {
    const at = wave.atSec + shift;
    const len = wave.entries.length;
    const n = deps.scaledCount(len, rate);
    for (let i = 0; i < n; i++) {
      const e = wave.entries[i % len];
      if (e === undefined || !roster.has(e.kind) || !keep(at)) continue;
      const t = at + e.tOffsetSec + (i < len ? 0 : Math.floor(i / len) * deps.REPEAT_STAGGER);
      if (t < endSec) out.push({ t, kind: e.kind });
    }
  };
  for (const wave of w.waves) {
    if (wave.atSec >= endSec) break;
    play(wave, 0);
  }
  const loopStart = w.waves[w.loopFromIndex];
  if (w.loopFromIndex >= 0 && w.loopPeriodSec > 0 && loopStart !== undefined) {
    for (let k = 1; loopStart.atSec + k * w.loopPeriodSec < endSec; k++) {
      for (let i = w.loopFromIndex; i < w.waves.length; i++) {
        const wave = w.waves[i];
        if (wave !== undefined && wave.atSec + k * w.loopPeriodSec < endSec) play(wave, k * w.loopPeriodSec);
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Pure: score of killing every spawn in order, collecting collectRate of each kill's geoms (the par model's multiplier). */
export function killAllScore(deps: AuditDeps, spawns: readonly Spawn[]): number {
  let score = 0;
  let geoms = 0;
  for (const s of spawns) {
    score += deps.ENEMY_BASE[s.kind] * Math.min(deps.multiplierCap, 1 + deps.collectRate * geoms);
    geoms += deps.ENEMY_GEOMS[s.kind];
  }
  return score;
}

/** Pure: high above m x OUTLIER_BAND, low below m / OUTLIER_BAND, else empty. */
export function flagOf(share: number, m: number): Flag {
  return share > m * OUTLIER_BAND ? 'high' : share < m / OUTLIER_BAND ? 'low' : '';
}

/** Pure: the audit over seeds, levels and every difficulty. */
export function auditPar(deps: AuditDeps, opts: AuditOptions = {}): AuditResult {
  const seeds = opts.seeds ?? AUDIT_SEEDS;
  const levels = opts.levels ?? AUDIT_LEVELS;
  const fightSec = opts.fightSec ?? deps.bossFightSec;
  const raw: Omit<AuditRow, 'flag' | 'goalFlag'>[] = [];
  for (const seed of seeds) {
    for (let level = 1; level <= levels; level++) {
      const def = deps.generateLevel(seed, level);
      const type = levelType(def);
      const objSec = deps.objectiveSec(def.objective, def.waves);
      const bossAt = def.boss === undefined ? null : def.boss.atSec;
      const levelSec = bossAt === null ? objSec : Math.min(objSec, bossAt + fightSec);
      for (const d of deps.DIFFICULTIES) {
        const t = deps.targetsFor({ par: def.par, stars: def.stars }, d);
        const o = deps.objectiveFor(def.objective, d);
        const spawns = spawnsOn(deps, def, d, levelSec, bossAt);
        // The game pays the bonus on the level's own (Normal) par: core.ts bossBonus(w.level.par).
        const bonus = def.boss === undefined ? 0 : deps.bossBonus(def.par, 'adventure', def.boss.tier);
        const available = Math.round(killAllScore(deps, spawns)) + bonus;
        const goal = o.kind === 'scoreInTime' ? o.target : null;
        raw.push({
          seed,
          level,
          type,
          guardian: def.boss?.id ?? '',
          difficulty: d,
          levelSec,
          par: t.par,
          stars: t.stars,
          goal,
          spawns: spawns.length,
          bonus,
          available,
          parShare: available > 0 ? t.par / available : Infinity,
          goalShare: goal === null ? null : available > 0 ? goal / available : Infinity,
        });
      }
    }
  }
  const parMedian = {} as Record<Difficulty, number>;
  const goalMedian = {} as Record<Difficulty, number>;
  for (const d of deps.DIFFICULTIES) {
    parMedian[d] = median(raw.filter((r) => r.difficulty === d && r.type !== 'guardian').map((r) => r.parShare));
    goalMedian[d] = median(raw.filter((r) => r.difficulty === d && r.type !== 'guardian' && r.goalShare !== null).map((r) => r.goalShare ?? 0));
  }
  const rows = raw.map((r): AuditRow => ({
    ...r,
    flag: flagOf(r.parShare, parMedian[r.difficulty]),
    goalFlag: r.goalShare === null ? '' : flagOf(r.goalShare, goalMedian[r.difficulty]),
  }));
  return { rows, parMedian, goalMedian };
}

// Report.

const f2 = (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : 'inf');
const k1 = (v: number): string => `${(v / 1000).toFixed(1)}k`;
const TYPE_LETTER: Readonly<Record<LevelType, string>> = { guardian: 'G', race: 'R', survive: 'S', destroy: 'D' };

/** Pure: mean of a list (0 when empty). */
function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Pure: the markdown report of an audit. */
export function renderReport(res: AuditResult, difficulties: readonly Difficulty[]): string {
  const out: string[] = [];
  const seeds = [...new Set(res.rows.map((r) => r.seed))];
  const levels = [...new Set(res.rows.map((r) => r.level))].sort((a, b) => a - b);
  out.push(`Seeds ${seeds.join(', ')}. Levels ${levels[0] ?? 0} to ${levels[levels.length - 1] ?? 0}. Flag: a par share (or a race goal share) above ${OUTLIER_BAND} x or below 1 / ${OUTLIER_BAND} x the non guardian median of its difficulty.`);
  out.push('');
  out.push('### Medians of non guardian levels');
  out.push('');
  out.push(`| Share | ${difficulties.join(' | ')} |`);
  out.push(`|---|${difficulties.map(() => '---:').join('|')}|`);
  out.push(`| par / available | ${difficulties.map((d) => f2(res.parMedian[d])).join(' | ')} |`);
  out.push(`| race goal / available | ${difficulties.map((d) => f2(res.goalMedian[d])).join(' | ')} |`);
  out.push('');
  out.push('### By level (mean over seeds)');
  out.push('');
  out.push(`Type per seed: G guardian, R score race, S survive, D destroy. Par and available on Normal. Shares by difficulty (${difficulties.join(', ')}).`);
  out.push('');
  out.push(`| Lvl | Types | Guardian | Par N | Avail N | ${difficulties.map((d) => `Share ${d}`).join(' | ')} | Flags |`);
  out.push(`|---:|---|---|---:|---:|${difficulties.map(() => '---:').join('|')}|---|`);
  for (const level of levels) {
    const at = res.rows.filter((r) => r.level === level);
    const normal = at.filter((r) => r.difficulty === 'normal');
    const types = seeds.map((s) => TYPE_LETTER[at.find((r) => r.seed === s)?.type ?? 'survive']).join('');
    const shares = difficulties.map((d) => f2(mean(at.filter((r) => r.difficulty === d).map((r) => r.parShare))));
    const flags = difficulties
      .map((d) => {
        const n = at.filter((r) => r.difficulty === d && r.flag === 'high').length;
        const l = at.filter((r) => r.difficulty === d && r.flag === 'low').length;
        const g = at.filter((r) => r.difficulty === d && r.goalFlag !== '').length;
        const par = n > 0 ? `${d[0] ?? ''} high ${n}/${seeds.length}` : l > 0 ? `${d[0] ?? ''} low ${l}/${seeds.length}` : '';
        return [par, g > 0 ? `${d[0] ?? ''} goal ${g}/${seeds.length}` : ''].filter((x) => x !== '').join(', ');
      })
      .filter((s) => s !== '')
      .join(', ');
    out.push(`| ${level} | ${types} | ${at[0]?.guardian ?? ''} | ${k1(mean(normal.map((r) => r.par)))} | ${k1(mean(normal.map((r) => r.available)))} | ${shares.join(' | ')} | ${flags} |`);
  }
  out.push('');
  out.push('### Every seed and level');
  out.push('');
  out.push('Normal par and stars; other difficulties are those times parScale. Goal: the score race target on Normal and its share by difficulty.');
  out.push('');
  out.push(`| Seed | Lvl | Type | Sec | Par N | Stars N | ${difficulties.map((d) => `Avail ${d}`).join(' | ')} | ${difficulties.map((d) => `Par/av ${d}`).join(' | ')} | Goal N | Goal/av N |`);
  out.push(`|---:|---:|---|---:|---:|---|${difficulties.map(() => '---:').join('|')}|${difficulties.map(() => '---:').join('|')}|---:|---:|`);
  for (const seed of seeds) {
    for (const level of levels) {
      const at = res.rows.filter((r) => r.seed === seed && r.level === level);
      const n = at.find((r) => r.difficulty === 'normal');
      if (n === undefined) continue;
      const by = (d: Difficulty): AuditRow | undefined => at.find((r) => r.difficulty === d);
      const avail = difficulties.map((d) => k1(by(d)?.available ?? 0));
      const share = difficulties.map((d) => {
        const r = by(d);
        return r === undefined ? '' : `${f2(r.parShare)}${r.flag === 'high' ? ' H' : r.flag === 'low' ? ' L' : ''}`;
      });
      const type = n.guardian === '' ? n.type : `G ${n.guardian}`;
      out.push(
        `| ${seed} | ${level} | ${type} | ${n.levelSec.toFixed(0)} | ${k1(n.par)} | ${n.stars.map(k1).join(' ')} | ${avail.join(' | ')} | ${share.join(' | ')} | ${n.goal === null ? '' : k1(n.goal)} | ${n.goalShare === null ? '' : `${f2(n.goalShare)}${n.goalFlag === 'high' ? ' H' : n.goalFlag === 'low' ? ' L' : ''}`} |`,
      );
    }
  }
  return out.join('\n');
}

/** Pure: the guardian rows of a short fight run, one line per guardian level and seed, shares by difficulty. */
export function renderGuardianSensitivity(res: AuditResult, difficulties: readonly Difficulty[], fightSec: number): string {
  const out: string[] = [];
  out.push(`### Guardian levels with a ${fightSec} s fight`);
  out.push('');
  out.push(`| Seed | Lvl | Guardian | ${difficulties.map((d) => `Par/av ${d}`).join(' | ')} |`);
  out.push(`|---:|---:|---|${difficulties.map(() => '---:').join('|')}|`);
  const g = res.rows.filter((r) => r.type === 'guardian' && r.difficulty === 'normal');
  for (const n of g) {
    const shares = difficulties.map((d) => f2(res.rows.find((r) => r.seed === n.seed && r.level === n.level && r.difficulty === d)?.parShare ?? 0));
    out.push(`| ${n.seed} | ${n.level} | ${n.guardian} | ${shares.join(' | ')} |`);
  }
  return out.join('\n');
}

// Proposal (a proposal only: no game number changes). One rule for every level type: par on
// difficulty d is TARGET share s_d of the score available on d, where s_d is today's non guardian
// median (auditPar parMedian, 2 decimals). Non guardian levels already sit there, so they keep
// their par. A guardian level's available score counts the waves that actually play (full to the
// entrance, then WAVE_BUDGET_WITH_BOSS[d] of them) over an expected fight of PROPOSED_FIGHT_SEC,
// plus the bonus. The bonus is a share B of the Normal par, so on Normal P = s K / (1 - B s), with
// K the kill score without the bonus. Every par lands on the PAR_STEP grid.

/** Expected seconds of a guardian fight in the proposal (BOSS_FIGHT_SEC is 180 today). */
export const PROPOSED_FIGHT_SEC = 90;
/** Actual fight lengths the proposal's Normal share is also checked at. */
export const CHECK_FIGHT_SEC: readonly number[] = Object.freeze([30, 180]);

/** Pure: v on the par grid, at least parMin. */
export function toGrid(deps: AuditDeps, v: number): number {
  return Math.max(deps.parMin, Math.round(v / deps.parStep) * deps.parStep);
}

export interface ProposalRow {
  readonly seed: number;
  readonly level: number;
  readonly guardian: string;
  readonly difficulty: Difficulty;
  readonly parNow: number;
  readonly parProposed: number;
  readonly available: number;
  /** parProposed over available at PROPOSED_FIGHT_SEC. */
  readonly share: number;
  /** parProposed over available when the fight lasts each CHECK_FIGHT_SEC entry. */
  readonly shareAt: readonly number[];
}

export interface ProposalResult {
  /** Target share s_d by difficulty. */
  readonly target: Readonly<Record<Difficulty, number>>;
  readonly rows: readonly ProposalRow[];
  /** Median proposed share by difficulty. */
  readonly shareMedian: Readonly<Record<Difficulty, number>>;
}

/** Pure: the proposal over the guardian levels of the audit seeds and levels. */
export function proposeGuardianPar(deps: AuditDeps, audit: AuditResult, opts: AuditOptions = {}): ProposalResult {
  const seeds = opts.seeds ?? AUDIT_SEEDS;
  const levels = opts.levels ?? AUDIT_LEVELS;
  const fightSec = opts.fightSec ?? PROPOSED_FIGHT_SEC;
  const target = {} as Record<Difficulty, number>;
  for (const d of deps.DIFFICULTIES) target[d] = Math.round(audit.parMedian[d] * 100) / 100;
  const rows: ProposalRow[] = [];
  for (const seed of seeds) {
    for (let level = 1; level <= levels; level++) {
      const def = deps.generateLevel(seed, level);
      if (def.boss === undefined) continue;
      const at = def.boss.atSec;
      const objSec = deps.objectiveSec(def.objective, def.waves);
      const kill = (d: Difficulty, f: number): number => Math.round(killAllScore(deps, spawnsOn(deps, def, d, Math.min(objSec, at + f), at)));
      const sN = target.normal;
      const parN = toGrid(deps, (sN * kill('normal', fightSec)) / (1 - deps.bonusShare * sN));
      const bonus = deps.bossBonus(parN, 'adventure', def.boss.tier);
      for (const d of deps.DIFFICULTIES) {
        const available = kill(d, fightSec) + bonus;
        const parProposed = d === 'normal' ? parN : toGrid(deps, target[d] * available);
        rows.push({
          seed,
          level,
          guardian: def.boss.id,
          difficulty: d,
          parNow: deps.targetsFor({ par: def.par, stars: def.stars }, d).par,
          parProposed,
          available,
          share: parProposed / available,
          shareAt: CHECK_FIGHT_SEC.map((f) => parProposed / (kill(d, f) + bonus)),
        });
      }
    }
  }
  const shareMedian = {} as Record<Difficulty, number>;
  for (const d of deps.DIFFICULTIES) shareMedian[d] = median(rows.filter((r) => r.difficulty === d).map((r) => r.share));
  return { target, rows, shareMedian };
}

/** Pure: the markdown of a proposal. */
export function renderProposal(p: ProposalResult, difficulties: readonly Difficulty[], fightSec: number = PROPOSED_FIGHT_SEC): string {
  const out: string[] = [];
  out.push(`### Proposed guardian par (fight ${fightSec} s)`);
  out.push('');
  out.push(`| | ${difficulties.join(' | ')} |`);
  out.push(`|---|${difficulties.map(() => '---:').join('|')}|`);
  out.push(`| target share s_d | ${difficulties.map((d) => p.target[d].toFixed(2)).join(' | ')} |`);
  out.push(`| median proposed par / available | ${difficulties.map((d) => f2(p.shareMedian[d])).join(' | ')} |`);
  out.push('');
  out.push(`Shares by difficulty at a ${fightSec} s fight; the last columns are Normal when the fight lasts ${CHECK_FIGHT_SEC.join(' or ')} s instead.`);
  out.push('');
  out.push(`| Seed | Lvl | Guardian | ${difficulties.map((d) => `Par now ${d}`).join(' | ')} | ${difficulties.map((d) => `Proposed ${d}`).join(' | ')} | ${difficulties.map((d) => `Share ${d}`).join(' | ')} | ${CHECK_FIGHT_SEC.map((f) => `N at ${f} s`).join(' | ')} |`);
  out.push(`|---:|---:|---|${difficulties.map(() => '---:').join('|')}|${difficulties.map(() => '---:').join('|')}|${difficulties.map(() => '---:').join('|')}|${CHECK_FIGHT_SEC.map(() => '---:').join('|')}|`);
  for (const n of p.rows.filter((r) => r.difficulty === 'normal')) {
    const by = difficulties.map((d) => p.rows.find((r) => r.seed === n.seed && r.level === n.level && r.difficulty === d));
    out.push(
      `| ${n.seed} | ${n.level} | ${n.guardian} | ${by.map((r) => k1(r?.parNow ?? 0)).join(' | ')} | ${by.map((r) => k1(r?.parProposed ?? 0)).join(' | ')} | ${by.map((r) => f2(r?.share ?? 0)).join(' | ')} | ${n.shareAt.map(f2).join(' | ')} |`,
    );
  }
  return out.join('\n');
}

// Module loading. Each module type is the real src/ module's type.

type GeneratorModule = typeof import('../src/levelgen/generator');
type CoreDifficultyModule = typeof import('../src/core/difficulty');
type StarsModule = typeof import('../src/core/stars');
type GameDifficultyModule = typeof import('../src/game/difficulty');
type BossTableModule = typeof import('../src/game/bosses/table');
type SpawnerModule = typeof import('../src/game/spawner');
type ScoringModule = typeof import('../src/game/scoring');
type PacingModule = typeof import('../src/levelgen/pacing');
type LevelDefModule = typeof import('../src/levelgen/leveldef');
type BossModule = typeof import('../src/levelgen/boss');
type ValidateModule = typeof import('../src/levelgen/validate');

export interface AuditModules {
  readonly generator: Pick<GeneratorModule, 'generateLevel'>;
  readonly coreDifficulty: Pick<CoreDifficultyModule, 'DIFFICULTY' | 'DIFFICULTIES'>;
  readonly stars: Pick<StarsModule, 'targetsFor'>;
  readonly gameDifficulty: Pick<GameDifficultyModule, 'objectiveFor' | 'scaledCount'>;
  readonly bossTable: Pick<BossTableModule, 'WAVE_BUDGET_WITH_BOSS'>;
  readonly spawner: Pick<SpawnerModule, 'REPEAT_STAGGER'>;
  readonly scoring: Pick<ScoringModule, 'bossBonus' | 'BOSS_BONUS_SHARE'>;
  readonly pacing: Pick<PacingModule, 'objectiveSec' | 'V10_COLLECT_RATE' | 'R1_MULTIPLIER_CAP'>;
  readonly levelDef: Pick<LevelDefModule, 'ENEMY_BASE' | 'ENEMY_GEOMS'>;
  readonly boss: Pick<BossModule, 'BOSS_FIGHT_SEC'>;
  readonly validate: Pick<ValidateModule, 'PAR_MIN' | 'PAR_STEP'>;
}

/** Pure: the audit's dependencies from the real modules. */
export function depsFrom(m: AuditModules): AuditDeps {
  return {
    generateLevel: (seed, level) => m.generator.generateLevel(seed, level),
    DIFFICULTIES: m.coreDifficulty.DIFFICULTIES,
    DIFFICULTY: m.coreDifficulty.DIFFICULTY,
    targetsFor: (level, d) => m.stars.targetsFor(level, d),
    objectiveFor: (o, d) => m.gameDifficulty.objectiveFor(o, d),
    scaledCount: m.gameDifficulty.scaledCount,
    WAVE_BUDGET_WITH_BOSS: m.bossTable.WAVE_BUDGET_WITH_BOSS,
    REPEAT_STAGGER: m.spawner.REPEAT_STAGGER,
    bossBonus: m.scoring.bossBonus,
    objectiveSec: m.pacing.objectiveSec,
    ENEMY_BASE: m.levelDef.ENEMY_BASE,
    ENEMY_GEOMS: m.levelDef.ENEMY_GEOMS,
    collectRate: m.pacing.V10_COLLECT_RATE,
    multiplierCap: m.pacing.R1_MULTIPLIER_CAP,
    bossFightSec: m.boss.BOSS_FIGHT_SEC,
    parMin: m.validate.PAR_MIN,
    parStep: m.validate.PAR_STEP,
    bonusShare: m.scoring.BOSS_BONUS_SHARE,
  };
}

export async function loadModules(root: string): Promise<AuditModules> {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const load = (url: string): Promise<Record<string, unknown>> => server.ssrLoadModule(url);
    return {
      generator: (await load('/src/levelgen/generator.ts')) as unknown as GeneratorModule,
      coreDifficulty: (await load('/src/core/difficulty.ts')) as unknown as CoreDifficultyModule,
      stars: (await load('/src/core/stars.ts')) as unknown as StarsModule,
      gameDifficulty: (await load('/src/game/difficulty.ts')) as unknown as GameDifficultyModule,
      bossTable: (await load('/src/game/bosses/table.ts')) as unknown as BossTableModule,
      spawner: (await load('/src/game/spawner.ts')) as unknown as SpawnerModule,
      scoring: (await load('/src/game/scoring.ts')) as unknown as ScoringModule,
      pacing: (await load('/src/levelgen/pacing.ts')) as unknown as PacingModule,
      levelDef: (await load('/src/levelgen/leveldef.ts')) as unknown as LevelDefModule,
      boss: (await load('/src/levelgen/boss.ts')) as unknown as BossModule,
      validate: (await load('/src/levelgen/validate.ts')) as unknown as ValidateModule,
    };
  } finally {
    await server.close();
  }
}

async function main(): Promise<void> {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const deps = depsFrom(await loadModules(root));
  const audit = auditPar(deps);
  console.log(renderReport(audit, deps.DIFFICULTIES));
  console.log('');
  console.log(renderGuardianSensitivity(auditPar(deps, { fightSec: SHORT_FIGHT_SEC }), deps.DIFFICULTIES, SHORT_FIGHT_SEC));
  console.log('');
  console.log(renderProposal(proposeGuardianPar(deps, audit), deps.DIFFICULTIES));
}

// Run only when started as a script, so tests can import the pure functions above.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
