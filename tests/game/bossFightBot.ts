// The fight length bot (shared by bossFightLength and the boss health tests; not a test file).
// A scripted gunner with the default weapon who keeps the core in its sights: it lands the docs/13
// open fire figure (18 spread hits a second, 180 tenths a second, half of the 36 bullets the spread
// fires) whenever the core is exposed, pops one breakable part every POD_REACTION seconds while one
// lives (Brood pods, Gravitas anchors, Bastion turrets, Prism pods and nodes, Mirage mirrors), and
// after a split keeps the same fire on the body parts one at a time. It measures the seconds from
// the end of the entrance to the kill, windows included. Deterministic: no PRNG, no wall clock.
//
// Gate aware (fury fixes, 2026-11-12): for a guardian whose def has a gate (Mirage's shield arc),
// each hit lands on the body edge on the ship's side, and before firing each step the ship circles
// toward the arc centre (w.rot of the body) at CHASE_SPEED, its distance held in CHASE_MIN to
// CHASE_MAX, moving only to points inside the arena (otherwise it stays). Every other guardian is
// shot on the body centre with the ship parked, as before.
import { isInsideOn } from '../../src/game/arena';
import { damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { angleToOn, pointDistOn, wrapPi } from '../../src/game/bosses/kit';
import { SHIP_RADIUS, SHIP_SPEED } from '../../src/game/ship';
import { bossNominalLevel, MAX_PARTS } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
import { stepGame } from '../../src/game/game';
import type { World } from '../../src/game/world';
import type { Difficulty } from '../../src/core/difficulty';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { bs, bossGame, enter, park } from './bossHelpers';
import { DT, idle } from './helpers';

/** Tenths of a hit a second the bot lands while the core takes damage. */
export const OPEN_FIRE = 180;
/** Seconds the bot takes to pop each breakable part. */
export const POD_REACTION = 0.5;
/** The bot gives up after this many seconds (fightSeconds returns Infinity). */
export const FIGHT_CAP_SEC = 600;
/** Gate aware bot: the ship's circling speed round a gated guardian, u/s (half the ship speed). */
export const CHASE_SPEED = SHIP_SPEED / 2;
/** Gate aware bot: the distance band the circling ship holds from the body, u. */
export const CHASE_MIN = 200;
export const CHASE_MAX = 300;

const spot = { x: 0, y: 0 };

/**
 * Gate aware ship step: circle toward the arc centre (w.rot of body b) at CHASE_SPEED, the distance
 * clamped to [CHASE_MIN, CHASE_MAX]; the ship moves only to a point inside the arena.
 */
export function chaseArc(w: World, b: number, dt: number): void {
  if (!w.ship.active) return;
  const bx = w.x[b] ?? 0;
  const by = w.y[b] ?? 0;
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  const bearing = angleToOn(w.surface, bx, by, sx, sy);
  const d0 = pointDistOn(w.surface, bx, by, sx, sy);
  const d = d0 < CHASE_MIN ? CHASE_MIN : d0 > CHASE_MAX ? CHASE_MAX : d0;
  const diff = wrapPi((w.rot[b] ?? 0) - bearing);
  const most = (CHASE_SPEED * dt) / d;
  const turn = Math.abs(diff) < most ? diff : Math.sign(diff) * most;
  spot.x = bx + Math.cos(bearing + turn) * d;
  spot.y = by + Math.sin(bearing + turn) * d;
  w.surface.wrap(spot);
  if (!isInsideOn(w.surface, w.level.arena, spot.x, spot.y, SHIP_RADIUS)) return;
  w.x[0] = spot.x;
  w.y[0] = spot.y;
  w.vx[0] = 0;
  w.vy[0] = 0;
}

export interface FightOptions {
  difficulty?: Difficulty;
  /** Campaign level (default: the boss's nominal level, 5 for the first row up to 50). */
  levelIndex?: number;
  /** Boss hpMul (default 1; Adventure's first fight is FIRST_FIGHT_HP_MUL). */
  hpMul?: number;
  /** Called once per step before the bot fires (tests sample the bar here). */
  onStep?: (w: World) => void;
}

/** Seconds from the end of the entrance to the kill on the bot, Infinity past FIGHT_CAP_SEC. */
export function fightSeconds(id: BossId, opt: FightOptions = {}): number {
  const level = opt.levelIndex ?? bossNominalLevel(BOSS_IDS.indexOf(id));
  const w = bossGame(id, { lives: 99, levelIndex: level }, { difficulty: opt.difficulty ?? 'normal' }, true, 0.25, true);
  const s = bs(w);
  if (opt.hpMul !== undefined) s.spec = { ...s.spec, hpMul: opt.hpMul };
  park(w, 500, 300);
  enter(w);
  let acc = 0;
  let podClock = 0;
  for (let i = 0; i < 120 * FIGHT_CAP_SEC; i++) {
    if (opt.onStep !== undefined) opt.onStep(w);
    let pod = -1;
    for (let k = 0; k < MAX_PARTS && pod < 0; k++) {
      const p = livePart(w, s, k);
      // A Twin is the second body (its hits come off the shared bar), not a part to pop.
      if (p > 0 && w.a[p] !== PartType.Broodling && w.a[p] !== PartType.Twin) pod = p;
    }
    if (s.split) {
      acc += OPEN_FIRE * DT;
      const n = Math.floor(acc);
      let target = -1;
      for (let k = 0; k < MAX_PARTS && target < 0; k++) target = livePart(w, s, k);
      if (n > 0 && target > 0) {
        damageBossPart(w, target, n, 0, 0);
        acc -= n;
      }
    } else if (pod > 0) {
      podClock += DT;
      if (podClock >= POD_REACTION) {
        damageBossPart(w, pod, 9999, 0, 0);
        podClock = 0;
      }
    } else {
      podClock = 0;
    }
    const gated = s.def.gate !== undefined && s.id > 0 && w.alive[s.id] === 1;
    if (gated) chaseArc(w, s.id, DT);
    if (s.exposed) {
      acc += OPEN_FIRE * DT;
      const n = Math.floor(acc);
      if (n > 0) {
        const bx = w.x[s.id] ?? 0;
        const by = w.y[s.id] ?? 0;
        if (gated) {
          // The body edge on the ship's side (the surface aware bearing from the body to the ship).
          const a = angleToOn(w.surface, bx, by, w.x[0] ?? 0, w.y[0] ?? 0);
          const r = w.radius[s.id] ?? 0;
          damageBoss(w, n, bx + Math.cos(a) * r, by + Math.sin(a) * r);
        } else {
          damageBoss(w, n, bx, by); // the body centre
        }
        acc -= n;
      }
    }
    if (s.status === 'defeated') return i / 120;
    stepGame(w, DT, idle());
  }
  return Infinity;
}
