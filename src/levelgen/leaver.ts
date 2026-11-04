// Leaver stage (forge-leaver). Ryan's Leaver is a Weaver that splits into six shards on death. It
// joins Adventure from LEAVER_FROM_LEVEL (band 3 and up) and Endless from LEAVER_FROM_SEGMENT (3
// minutes in), on its own salted stream after every other wave draw, so no earlier draw moves.
//
// Mechanism, per level or segment the stage runs on:
// 1. Join. One uniform: below LEAVER_JOIN_CHANCE the Leaver joins, else the def is returned as is.
// 2. Groups. Each group of the (v2 staged) waves draws one uniform; below the swap chance it
//    becomes a Leaver group at the same wave and start time, re-emitted from this stream with
//    the group's own head count, so the live count over time (the R1 and R3 dead air rules) is
//    unchanged. The swap chance is the Leaver weight over the roster weight sum plus the Leaver
//    weight: its share as one more roster kind.
// 3. Roster. When at least one group swapped, the Leaver joins the roster last (ALL_ENEMY_KINDS
//    order) with its weight. When none swapped, the def is returned as is, so a level that gains
//    no Leaver keeps its bytes and its hash.
import type { Rng } from '../core/rng';
import { LEAVER_ENDLESS_WEIGHT, LEAVER_FROM_LEVEL, LEAVER_FROM_SEGMENT, LEAVER_WEIGHTS } from './leveldef';
import type { Band, GenConfig, RosterEntry } from './leveldef';

/** Stream salt for the Leaver stage. ASCII "LEAV". */
export const LEAVER_SALT = 0x4c454156;

/** Chance that the Leaver joins a level or segment the stage runs on. */
export const LEAVER_JOIN_CHANCE = 0.6;

/** Spawn units per Leaver: the Weaver's cost (wave pass of a Free Play roster that names it). */
export const LEAVER_SPAWN_COST = 2;

/** True when the config runs the Leaver stage (it needs the v2 enemies on). */
export const leaverOn = (cfg: Readonly<GenConfig>): boolean => cfg.enableLeaver === true && cfg.enableV2Enemies;

/** Leaver weight for Adventure level n, 0 when the stage does not run there. */
export function leaverLevelWeight(levelIndex: number, band: Band, cfg: Readonly<GenConfig>): number {
  return leaverOn(cfg) && levelIndex >= LEAVER_FROM_LEVEL ? LEAVER_WEIGHTS[band] : 0;
}

/** Leaver weight for Endless segment s, 0 when the stage does not run there. */
export function leaverSegmentWeight(segment: number, band: Band, cfg: Readonly<GenConfig>): number {
  if (!leaverOn(cfg) || segment < LEAVER_FROM_SEGMENT) return 0;
  return LEAVER_WEIGHTS[band] > 0 ? LEAVER_WEIGHTS[band] : LEAVER_ENDLESS_WEIGHT;
}

/** Pure: the per group swap chance for a roster: weight / (roster weight sum + weight). */
export function leaverSwapChance(roster: readonly RosterEntry[], weight: number): number {
  if (!(weight > 0)) return 0;
  const sum = roster.reduce((a, e) => a + (e.weight > 0 ? e.weight : 0), 0);
  return weight / (sum + weight);
}

/** Pure: Leavers a swapped group spawns: the group's head count, at least 1. */
export function leaverGroupCount(count: number): number {
  return Math.max(1, Math.floor(count));
}

/** Pure: the roster with the Leaver appended (it is last in ALL_ENEMY_KINDS order). */
export function rosterWithLeaver(roster: readonly RosterEntry[], weight: number): RosterEntry[] {
  const out = roster.filter((e) => e.kind !== 'leaver').map((e) => ({ ...e }));
  out.push({ kind: 'leaver', weight });
  return out;
}

/** Stage 1: one uniform. True when the Leaver joins. */
export function leaverJoins(r: Rng): boolean {
  return r() < LEAVER_JOIN_CHANCE;
}
