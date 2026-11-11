// Guardian par (version 14; Ryan's ruling 2026-11-11 on docs/qa/par-audit.md). Par on difficulty d
// is GUARDIAN_PAR_SHARE[d] of the score really available on d: every regular enemy that spawns from
// the start to the end of a tiered fight (full waves before the entrance, then the
// WAVE_BUDGET_WITH_BOSS[d] share of them, as the spawner plays them), killed, with geoms collected
// at V10_COLLECT_RATE, plus the guardian kill bonus. Pure: no PRNG, no Date, no DOM, and levelgen
// stays standalone: the game numbers it needs are copied here and pinned by tests to src/game.
import type { Difficulty } from '../core/difficulty';
import { DIFFICULTIES, DIFFICULTY } from '../core/difficulty';
import { BOSS_BONUS_SHARE } from './boss';
import { ENEMY_BASE, ENEMY_GEOMS } from './leveldef';
import type { BossTier, DifficultyPar, DifficultyParEntry, EnemyKind, ObjectiveDef, RosterEntry, WaveDef, WaveSchedule } from './leveldef';
import { R1_MULTIPLIER_CAP, V10_COLLECT_RATE, objectiveSec, r1Stars, wholeLevelTarget } from './pacing';
import { PAR_MIN, PAR_STEP } from './validate';

/** Target share s_d of the available score (the audit's non guardian medians). */
export const GUARDIAN_PAR_SHARE: Readonly<Record<Difficulty, number>> = Object.freeze({ easy: 0.51, normal: 0.49, hard: 0.42, insane: 0.36 });

/**
 * Expected seconds of a guardian fight by tier (Ryan's ruled fight lengths). Separate from
 * BOSS_FIGHT_SEC, which the version 8 to 13 par still reads.
 */
export const GUARDIAN_FIGHT_SEC: Readonly<Record<BossTier, number>> = Object.freeze({ 1: 70, 2: 90, 3: 120, 4: 150 });

/** Copy of src/game/bosses/table.ts WAVE_BUDGET_WITH_BOSS (a test pins the two equal). */
export const PAR_WAVE_BUDGET_WITH_BOSS: Readonly<Record<Difficulty, number>> = Object.freeze({ easy: 0, normal: 0.25, hard: 0.5, insane: 0.6 });

/** Copy of src/game/spawner.ts REPEAT_STAGGER: seconds between repeat passes of a wave (a test pins it). */
export const PAR_REPEAT_STAGGER = 0.35;

/** Pure: seconds of the expected fight of a guardian tier. */
export function guardianFightSec(tier: BossTier): number {
  return GUARDIAN_FIGHT_SEC[tier];
}

/** Pure: copy of src/game/difficulty.ts scaledCount (a test pins the two equal). */
export function parScaledCount(n: number, rate: number): number {
  if (n <= 0) return 0;
  const k = Math.round(n * rate);
  return k < 1 ? 1 : k;
}

/** Pure: copy of src/game/scoring.ts bossBonus in Adventure: BOSS_BONUS_SHARE of par, half up to the grid. */
export function guardianBonus(par: number): number {
  if (!(par > 0) || !Number.isFinite(par)) return 0;
  return Math.floor((par * BOSS_BONUS_SHARE) / PAR_STEP + 0.5) * PAR_STEP;
}

/** Pure: v on the par grid, at least PAR_MIN. */
export function toGuardianGrid(v: number): number {
  return Math.max(PAR_MIN, Math.round(v / PAR_STEP) * PAR_STEP);
}

export interface ParSpawn {
  readonly t: number;
  readonly kind: EnemyKind;
}

/**
 * Pure: the regular enemies that spawn before endSec at spawn rate `rate`, sorted by time. Walks
 * the schedule as the spawner queues it: waves in order, then the loop; each wave plays
 * parScaledCount(entries, rate) entries (repeats PAR_REPEAT_STAGGER s apart), kinds outside the
 * roster are skipped, and every entry of a wave queued at or after bossAtSec goes through the even
 * `share` accumulator (keepScheduledEntry).
 */
export function guardianSpawns(w: WaveSchedule, roster: readonly RosterEntry[], rate: number, share: number, endSec: number, bossAtSec: number): ParSpawn[] {
  const kinds = new Set(roster.map((r) => r.kind));
  const out: ParSpawn[] = [];
  let acc = 0;
  const keep = (at: number): boolean => {
    if (at < bossAtSec) return true;
    if (share <= 0) return false;
    acc += share;
    if (acc >= 1 - 1e-9) {
      acc -= 1;
      return true;
    }
    return false;
  };
  const play = (wave: WaveDef, shift: number): void => {
    const at = wave.atSec + shift;
    const len = wave.entries.length;
    const n = parScaledCount(len, rate);
    for (let i = 0; i < n; i++) {
      const e = wave.entries[i % len];
      if (e === undefined || !kinds.has(e.kind) || !keep(at)) continue;
      const t = at + e.tOffsetSec + (i < len ? 0 : Math.floor(i / len) * PAR_REPEAT_STAGGER);
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
export function killAllScore(spawns: readonly ParSpawn[], collectRate: number = V10_COLLECT_RATE): number {
  let score = 0;
  let geoms = 0;
  for (const s of spawns) {
    score += ENEMY_BASE[s.kind] * Math.min(R1_MULTIPLIER_CAP, 1 + collectRate * geoms);
    geoms += ENEMY_GEOMS[s.kind];
  }
  return score;
}

/** What the guardian par reads from a level. */
export interface GuardianParInput {
  readonly waves: WaveSchedule;
  readonly roster: readonly RosterEntry[];
  readonly objective: ObjectiveDef;
  /** Wave clock second of the entrance. */
  readonly atSec: number;
  readonly tier: BossTier;
}

/** Pure: seconds of waves the par counts: to the end of the tiered fight, or the objective time if sooner. */
export function guardianParEndSec(g: GuardianParInput): number {
  return Math.min(objectiveSec(g.objective, g.waves), g.atSec + guardianFightSec(g.tier));
}

/** Pure: the kill score (no bonus) available on difficulty d, rounded to a point. */
export function guardianKillScore(g: GuardianParInput, d: Difficulty): number {
  const spawns = guardianSpawns(g.waves, g.roster, DIFFICULTY[d].spawnRate, PAR_WAVE_BUDGET_WITH_BOSS[d], guardianParEndSec(g), g.atSec);
  return Math.round(killAllScore(spawns));
}

/** Pure: one difficulty's entry: par, its R1 stars and, on a score race, the goal. */
export function parEntry(par: number, race: boolean): DifficultyParEntry {
  return race ? { par, stars: r1Stars(par), goal: wholeLevelTarget(par) } : { par, stars: r1Stars(par) };
}

/**
 * Pure: the version 14 guardian targets. The bonus is a share B of the Normal par, so on Normal
 * P = s K / (1 - B s), K the kill score; every other difficulty takes s_d (K_d + bonus). Each par
 * on the PAR_STEP grid.
 */
export function guardianLevelPar(g: GuardianParInput): DifficultyPar {
  const race = g.objective.kind === 'scoreInTime';
  const sN = GUARDIAN_PAR_SHARE.normal;
  const parN = toGuardianGrid((sN * guardianKillScore(g, 'normal')) / (1 - BOSS_BONUS_SHARE * sN));
  const bonus = guardianBonus(parN);
  const out = {} as DifficultyPar;
  for (const d of DIFFICULTIES) {
    out[d] = parEntry(d === 'normal' ? parN : toGuardianGrid(GUARDIAN_PAR_SHARE[d] * (guardianKillScore(g, d) + bonus)), race);
  }
  return out;
}

/** Pure: the score available on d at the tiered fight (kill score plus the bonus on the Normal par). */
export function guardianAvailable(g: GuardianParInput, d: Difficulty, parNormal: number): number {
  return guardianKillScore(g, d) + guardianBonus(parNormal);
}
