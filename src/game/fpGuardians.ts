// Free Play guardians (Ryan, 2026-11-10): with the guardian option on (FreePlayBosses 'every3',
// labelled "Every 2 min"), one guardian at a time. The first enters at FP_GUARDIAN_FIRST_SEC of
// play, and each next one FP_GUARDIAN_GAP_SEC after the previous one is freed. Play time is the
// wave clock: it stops while the game is paused, during the respawn delay and while a guardian
// lives, so the gap counts only time in play with no guardian on the field. Guardians follow the
// Free Play ladder (freePlayBossFor, the Adventure order). The segments' own bosses are ignored
// for this option (endless.ts loadSegment), so two can never be alive. The single chosen boss
// option and plain Endless keep the segment cadence. No PRNG.
import { FREE_PLAY_BOSS_EVERY_SEGMENTS, FREE_PLAY_BOSS_FIRST_SEGMENT, freePlayBossFor } from '../levelgen/boss';
import type { BossSpec, EndlessDef } from '../levelgen/leveldef';
import { armBossFromSpec } from './bosses/index';
import { bossOf } from './bosses/state';
import { gs } from './state';
import type { World } from './world';

/** Wave clock second of the first guardian's entrance. */
export const FP_GUARDIAN_FIRST_SEC = 120;
/** Wave clock seconds from a guardian being freed to the next one's entrance. */
export const FP_GUARDIAN_GAP_SEC = 120;

interface GuardianRun {
  cylinder: boolean;
  /** Boss number (1 based) of the guardian armed now. */
  number: number;
}

const runs = new WeakMap<World, GuardianRun>();

/** Pure: true when this Endless def is a Free Play run with the guardian option on. */
export function guardiansTimed(def: EndlessDef): boolean {
  return def.freePlay?.options?.bosses === 'every3';
}

/**
 * Pure: guardian number j (1 based) of a Free Play run, or null past the ladder. The spec is the
 * one freePlayBossFor gives the j-th Free Play boss segment, so the order, hit point ladder and
 * drum rule stay Foundry's; only the entrance time moves to the game side.
 */
export function guardianSpec(j: number, cylinder: boolean): BossSpec | null {
  if (!Number.isInteger(j) || j < 1) return null;
  return freePlayBossFor('every3', FREE_PLAY_BOSS_FIRST_SEGMENT + (j - 1) * FREE_PLAY_BOSS_EVERY_SEGMENTS, cylinder);
}

/** True while this world runs the timed guardian schedule (endless.ts skips segment bosses). */
export function guardianRunActive(w: World): boolean {
  return runs.has(w);
}

/** Start the schedule on a fresh Endless world when the def asks for it. No op otherwise. */
export function startFreePlayGuardians(w: World, def: EndlessDef): void {
  if (!guardiansTimed(def)) return;
  const run: GuardianRun = { cylinder: def.surface === 'cylinder', number: 1 };
  runs.set(w, run);
  const spec = guardianSpec(1, run.cylinder);
  if (spec !== null) armBossFromSpec(w, spec, FP_GUARDIAN_FIRST_SEC);
}

/**
 * Arm the next guardian once the current one is freed, FP_GUARDIAN_GAP_SEC of wave clock later.
 * Call once per step before stepSpawner, so the clock read is the one the guardian was freed on.
 */
export function stepFreePlayGuardians(w: World): void {
  const run = runs.get(w);
  if (run === undefined) return;
  const bs = bossOf(w);
  if (bs === null || bs.status !== 'defeated') return;
  const spec = guardianSpec(run.number + 1, run.cylinder);
  if (spec === null) return; // past the ladder: no more guardians, segment bosses stay off
  run.number++;
  armBossFromSpec(w, spec, gs(w).waveClock + FP_GUARDIAN_GAP_SEC);
}

/** Guardian number armed or alive now (1 based), 0 outside the timed schedule. */
export function guardianNumber(w: World): number {
  return runs.get(w)?.number ?? 0;
}
