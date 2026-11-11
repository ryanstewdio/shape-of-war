// Render contract for the boss (docs/12-v3-plan.md V3-W0, docs/13 "Render contract for the boss").
// The only way render and HUD code read a boss. With no boss alive it reports active false, so
// nothing draws. Reads only: never changes the simulation.
import { BOSS_IDS } from '../../levelgen/leveldef';
import { Kind, type World } from '../world';
import { barHpOf, barMaxOf } from './core';
import { bossOf } from './state';
import { dashAimOf, dashHeadingOf } from './warden';

/** One boss as render and HUD see it. No allocation: callers pass one reused object as out. */
export interface BossView {
  /** False when no boss is alive. Every other field is then meaningless. */
  active: boolean;
  /** Index in BOSS_IDS. */
  id: number;
  /** 0 entering, 1 guarded, 2 attacking, 3 vulnerable, 4 stunned, 5 phase change, 6 dying. */
  mode: number;
  phase: number;
  /** Current hit points. */
  hp: number;
  /** Maximum hit points. */
  maxHp: number;
  /** Seconds spent in the current mode. */
  modeT: number;
  x: number;
  y: number;
  /** Facing in radians. */
  rot: number;
  radius: number;
  /**
   * G3A addition: true while the core takes damage (the counter window, never a bomb stagger).
   * Optional so existing literals compile; readBoss always writes it. Glow: colour change and
   * blink; Chorus: the alert on 'sim:bossExposed'.
   */
  exposed?: boolean;
  /** Seconds left in a timed exposed window, -1 for an open ended one (Spindle) or while closed. */
  exposedLeft?: number;
  /** Seconds spent in the current exposed state (blink phase). */
  exposedT?: number;
  /** Boss abilities wave: true while Warden's shield is up; shieldLeft the seconds left, 0 when down. */
  shielded?: boolean;
  shieldLeft?: number;
  /**
   * Boss health (Ryan 2026-11-11), read by bossBar. True while the guardian has a bar to show: alive,
   * entrance included, and after a split while its parts carry the fight (active is then false, as no
   * body is left to draw). Optional so existing literals compile; readBoss always writes these.
   */
  barOn?: boolean;
  /** Hit points on the bar now: the body's, or after a split the live parts' sum (tenths). */
  barHp?: number;
  /** The bar's full value: maxHp, or the Broodlings' starting sum after Brood splits (tenths). */
  barMax?: number;
  /** True after Brood split: the bar is the Broodlings' own, labelled "Broodlings". */
  broodlings?: boolean;
  /**
   * Warden fury (contract stub, Ryan 2026-11-11). 0 none, 1 the invincible break, 2 enraged. furyT is
   * the seconds into the current stage. Optional so existing literals compile; Swarm writes them.
   */
  fury?: 0 | 1 | 2;
  furyT?: number;
  /** Dash charge aim: seconds of aim left (-1 when not aiming) and the dash heading in radians. */
  dashAim?: number;
  dashHeading?: number;
  /** Hit feedback (contract stub): seconds since the last landed hit on this guardian, -1 before any. */
  hitT?: number;
  /**
   * Fury three (contract stub, Ryan 2026-11-11; Swarm writes, Glow reads). frenzy: true once the
   * Broodlings are enraged (the first Broodling died); Brood's body has no fury. tide: Gravitas enraged,
   * 1 while it pulls, -1 while it pushes, 0 otherwise. tideFlipIn: seconds until the next flip, -1 when none.
   */
  frenzy?: boolean;
  tide?: -1 | 0 | 1;
  tideFlipIn?: number;
}

/** Fill out from the boss of the world and return it. No allocation: out is the caller's object. */
export function readBoss(w: World, out: BossView): BossView {
  const bs = bossOf(w);
  const id = bs === null ? -1 : bs.id;
  const on = bs !== null && bs.status === 'alive' && (bs.split || (id > 0 && w.alive[id] === 1 && w.kind[id] === Kind.Boss));
  out.barOn = on;
  out.barHp = on && bs !== null ? barHpOf(w, bs) : 0;
  out.barMax = on && bs !== null ? barMaxOf(bs) : 0;
  out.broodlings = on && bs !== null && bs.split && bs.splitMax > 0;
  // Fury: written every frame for any guardian on the shared fury (0 for the others or no boss); the
  // dash aim and heading stay Warden's own (-1 and 0 otherwise).
  const live = bs !== null && bs.status === 'alive';
  const fury = live && bs !== null && bs.def.fury === true;
  out.fury = fury && bs !== null ? bs.fury : 0;
  out.furyT = fury && bs !== null ? bs.furyT : 0;
  const warden = live && bs !== null && bs.spec.id === 'warden';
  out.dashAim = warden && bs !== null ? dashAimOf(bs) : -1;
  out.dashHeading = warden && bs !== null ? dashHeadingOf(bs) : 0;
  // Hit feedback: seconds since the last landed hit, -1 before any (or with no boss alive).
  out.hitT = live && bs !== null ? bs.hitT : -1;
  if (bs === null || bs.status !== 'alive' || id <= 0 || w.alive[id] !== 1 || w.kind[id] !== Kind.Boss) {
    out.active = false;
    return out;
  }
  out.active = true;
  out.id = BOSS_IDS.indexOf(bs.spec.id);
  out.mode = bs.viewMode;
  out.phase = bs.phase;
  out.hp = w.hp[id] ?? 0;
  out.maxHp = bs.maxHp;
  out.modeT = bs.modeT;
  out.x = w.x[id] ?? 0;
  out.y = w.y[id] ?? 0;
  out.rot = w.rot[id] ?? 0;
  out.radius = w.radius[id] ?? 0;
  out.exposed = bs.exposed;
  out.exposedLeft = bs.exposed ? bs.openLeft : -1;
  out.exposedT = bs.exposedT;
  out.shielded = bs.shielded;
  out.shieldLeft = bs.shieldLeft;
  return out;
}

/** A fresh BossView for a caller to keep and reuse (allocates once; call at setup, not per frame). */
export function createBossView(): BossView {
  return { active: false, id: 0, mode: 0, phase: 1, hp: 0, maxHp: 0, modeT: 0, x: 0, y: 0, rot: 0, radius: 0, exposed: false, exposedLeft: -1, exposedT: 0, shielded: false, shieldLeft: 0, barOn: false, barHp: 0, barMax: 0, broodlings: false, fury: 0, furyT: 0, dashAim: -1, dashHeading: 0, hitT: -1 };
}
