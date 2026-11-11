// Shared guardian fury (Ryan 2026-11-11: every guardian gets a fury mid point). A guardian opts in
// with BossDef.fury true and by routing clampDamage, afterDamage, phaseOf and onPhase through here.
// At the stage 1 crack (hp stops at furyBreakHp, just below CRACK_AT[0]) it breaks for
// FURY_BREAK_SEC: it stops, its hazards and Hornets clear, any shield drops, its core closes and no
// hit moves the bar. 'sim:bossFury' break fires once, then phase 2 (the break replaces the phase
// change pause), then 'on' once at the break's end: enraged to its death. BossState.fury and furyT
// hold the stage (a ship death keeps it; armState clears it). The guardian's own extras (Warden's
// dash, Spindle's arms, Ember's state) go in the onBreak and onEnrage hooks, which run before the
// matching event is emitted. No allocation.
import type { World } from '../world';
import { bus } from '../../core/events';
import { clearHazards, clearHornets, phaseFor } from './core';
import { setShield } from './shield';
import type { BossState } from './state';
import { CRACK_AT, FURY_BREAK_SEC } from './table';
import { BossMode } from './types';

/** A guardian's own reset at a fury edge (module level functions, never closures per step). */
export type FuryHook = (w: World, id: number, bs: BossState) => void;

/**
 * Pure: the hit points (tenths) a body stops at when the stage 1 bar empties: the largest whole
 * value below CRACK_AT[0] of maxHp, so the stage 1 crack and the break land on the same hit.
 */
export function furyBreakHp(maxHp: number): number {
  if (!(maxHp > 0)) return 0;
  const v = Math.ceil(maxHp * CRACK_AT[0] - 1e-9) - 1;
  return v > 0 ? v : 0;
}

/** Pure: tenths of a hit of amount that land on a body at hp in fury stage fury (maxHp its maximum). */
export function furyClamp(fury: number, hp: number, maxHp: number, amount: number): number {
  if (fury === 1) return 0; // the break: no hit moves the bar
  if (fury !== 0) return amount;
  const room = hp - furyBreakHp(maxHp);
  return room > 0 && amount > room ? room : amount; // the crossing hit stops where the bar empties
}

/** Pure: the phase a fury guardian belongs in: 1 before the break, at least 2 from it on. */
export function furyPhase(fury: number, hp: number, maxHp: number, phases: number): number {
  if (fury < 1) return 1;
  const p = phaseFor(hp, maxHp, phases);
  return p > 2 ? p : 2;
}

/** Emit 'sim:bossFury' at the body (reused payload). */
export function emitFury(w: World, id: number, bs: BossState, stage: 'break' | 'on', sec: number): void {
  const e = bs.furyEv;
  e.id = bs.spec.id;
  e.stage = stage;
  e.sec = sec;
  e.x = w.x[id] ?? 0;
  e.y = w.y[id] ?? 0;
  bus.emit('sim:bossFury', e);
}

/** The stage 1 bar emptied: the invincible break starts ('sim:bossFury' break, once). */
export function startFuryBreak(w: World, id: number, bs: BossState, onBreak: FuryHook | null): void {
  bs.fury = 1;
  bs.furyT = 0;
  clearHazards(w);
  clearHornets(w, bs);
  setShield(bs, false, w.x[id] ?? 0, w.y[id] ?? 0, 0);
  if (onBreak !== null) onBreak(w, id, bs);
  bs.retry = 0;
  bs.open = false;
  bs.openLeft = -1;
  bs.mode = BossMode.Guarded;
  emitFury(w, id, bs, 'break', FURY_BREAK_SEC);
}

/** Hit hook: the break takes no damage, and the crossing hit stops where the stage 1 bar empties. */
export function furyClampDamage(w: World, id: number, bs: BossState, amount: number): number {
  return furyClamp(bs.fury, w.hp[id] ?? 0, bs.maxHp, amount);
}

/** After a hit the body lived: true when the break should start now (the stage 1 bar is empty). */
export function furyDue(w: World, id: number, bs: BossState): boolean {
  return bs.fury === 0 && (w.hp[id] ?? 0) <= furyBreakHp(bs.maxHp);
}

/** Phase hook body: phase 2 starts at the break (not at a hit point share). */
export function furyPhaseOf(w: World, id: number, bs: BossState, hp: number): number {
  return furyPhase(bs.fury, hp, bs.maxHp, bs.row.phases);
}

/** onPhase body: the break is the phase 2 pause, so no second pause stacks on it (later phases keep theirs). */
export function furyOnPhase(bs: BossState, phase: number): void {
  if (bs.fury >= 1 && phase === 2) bs.phaseT = 0;
}

/**
 * One step of the fury clock. In the break the body stands still with its core closed; at the
 * break's end it turns enraged (onEnrage, then 'sim:bossFury' on). Returns true when the def must
 * skip the rest of this step (the break, and the step it ends on). Enraged, furyT keeps counting.
 */
export function stepFury(w: World, id: number, bs: BossState, dt: number, onEnrage: FuryHook | null): boolean {
  if (bs.fury === 1) {
    bs.furyT += dt;
    bs.open = false;
    bs.openLeft = -1;
    bs.mode = BossMode.Guarded;
    if (bs.furyT < FURY_BREAK_SEC - 1e-9) return true;
    bs.fury = 2;
    bs.furyT = 0;
    if (onEnrage !== null) onEnrage(w, id, bs);
    emitFury(w, id, bs, 'on', 0);
    return true;
  }
  if (bs.fury === 2) bs.furyT += dt;
  return false;
}
