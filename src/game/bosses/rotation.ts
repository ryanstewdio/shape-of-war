// Attack rotation (release polish item 7: a 3.5 minute fight stays varied). On top of its signature
// attack every boss fires a bullet volley every ROTATION.everyByTier seconds of attack time, cycling
// three patterns in a fixed order: an aimed fan, a radial burst with the ship midway between two
// bullets, and a pincer of pairs either side of the ship's bearing. Each phase past the first adds
// one escalation (one more bullet per side, shorter gaps). The core steps it once per step from
// stepBossSchedule; it pauses with the boss (entrance, ship down, stagger, phase change, shield up).
// Bullets charge for the tier telegraph at the muzzle like every boss shot, fire only with the ship
// ENEMY_BULLET_MIN_RANGE from the muzzle, and never while a signature volley is charging; the
// rotation keeps its own launch tracker, so fx:bossShot fires once per rotation volley too. Speeds follow
// the level scale and are clamped by the pool. No allocation, no PRNG.
import { bus } from '../../core/events';
import { isInside } from '../arena';
import { clampEnemyBulletSpeed, ENEMY_BULLET_MIN_RANGE, ENEMY_BULLET_RADIUS, enemyBulletsOf, spawnEnemyBullet } from '../enemyBullets';
import { Kind, type World } from '../world';
import { hazardTelegraph, pointDist } from './kit';
import type { BossState } from './state';
import { ENRAGE_AFTER_SEC, ENRAGE_RATE, ROTATION, SHOT_RECHECK_SEC, SHOT_VOLLEY_MAX } from './table';
import { BossMode, PartType } from './types';

const DEG = Math.PI / 180;

/** Rotation patterns (BossState.rotLog values). */
export const enum Pattern {
  Fan = 0,
  Burst = 1,
  Pincer = 2,
}

/** Pure: the pattern of the k-th volley (0 based): fan, burst, pincer, then again. */
export function patternAt(k: number): Pattern {
  const m = ((k % ROTATION.patterns) + ROTATION.patterns) % ROTATION.patterns;
  return m === 0 ? Pattern.Fan : m === 1 ? Pattern.Burst : Pattern.Pincer;
}

/** Pure: attack seconds between volleys for a tier (1 to 4) and a 1 based phase. */
export function rotationEvery(tier: number, phase: number): number {
  const t = tier < 1 ? 1 : tier > ROTATION.everyByTier.length ? ROTATION.everyByTier.length : Math.round(tier);
  const base = ROTATION.everyByTier[t - 1] ?? 6;
  const p = phase > 1 ? phase - 1 : 0;
  return base / (1 + ROTATION.phaseRate * p);
}

/** Pure: bullets in a volley of pattern at a 1 based phase (one escalation per phase past the first). */
export function patternBullets(pattern: Pattern, phase: number): number {
  const p = phase > 1 ? Math.round(phase) - 1 : 0;
  if (pattern === Pattern.Fan) {
    const n = ROTATION.fanBase + p;
    return n > SHOT_VOLLEY_MAX ? SHOT_VOLLEY_MAX : n;
  }
  if (pattern === Pattern.Burst) return ROTATION.burstBase + ROTATION.burstPerPhase * p;
  return 2 * (ROTATION.pincerPairs + p);
}

/**
 * Pure: heading of bullet k of n in pattern, given the bearing to the ship. Fan: centred on the
 * bearing. Burst: evenly round, offset half a step so the ship starts between two. Pincer: pairs at
 * pincerDeg, pincerDeg + pincerStepDeg, ... either side, none on the bearing.
 */
export function patternHeading(pattern: Pattern, bearing: number, k: number, n: number): number {
  if (pattern === Pattern.Fan) return bearing + (k - (n - 1) / 2) * ROTATION.fanSpreadDeg * DEG;
  if (pattern === Pattern.Burst) {
    const step = (2 * Math.PI) / (n > 0 ? n : 1);
    return bearing + (k + 0.5) * step;
  }
  const pair = k >> 1;
  const side = (k & 1) === 0 ? 1 : -1;
  return bearing + side * (ROTATION.pincerDeg + pair * ROTATION.pincerStepDeg) * DEG;
}

/** Pure: a rotation bullet speed for a level scale, never past the pool cap. */
export function rotationSpeed(levelScale: number): number {
  return clampEnemyBulletSpeed(ROTATION.speed * (levelScale > 0 ? levelScale : 1));
}

/** Pure: true when no pattern in log[0..count) (oldest first) appears more than twice in a row. */
export function repeatsAtMostTwice(log: ArrayLike<number>, count: number): boolean {
  let run = 0;
  for (let i = 0; i < count; i++) {
    run = i > 0 && log[i] === log[i - 1] ? run + 1 : 1;
    if (run > 2) return false;
  }
  return true;
}

/** Start the rotation clock: the first volley ROTATION.firstSec of attack time away. The order carries on. */
export function resetRotation(bs: BossState): void {
  bs.rotT = ROTATION.firstSec;
  bs.rotWait = 0;
  bs.rotShotId = -1; // its bullets were cleared with the ship death or never existed
}

/** fx:bossShot once when the charging rotation volley launches (or ended on the launch step). */
function stepRotationLaunch(w: World, bs: BossState): void {
  const id = bs.rotShotId;
  if (id < 0) return;
  const p = enemyBulletsOf(w);
  if (p.alive[id] === 1 && (p.arm[id] ?? 0) > 0) return;
  bs.rotShotId = -1;
  bus.emit('fx:bossShot', bs.rotEv);
}

/** The muzzle body: the boss body, or after a split its first live body part. -1 for none. */
function shooter(w: World, bs: BossState): number {
  if (!bs.split) return bs.id > 0 && w.alive[bs.id] === 1 && w.kind[bs.id] === Kind.Boss ? bs.id : -1;
  for (let k = 0; k < bs.parts.length; k++) {
    const p = bs.parts[k] ?? -1;
    if (p <= 0 || w.alive[p] !== 1 || w.kind[p] !== Kind.BossPart) continue;
    const t = w.a[p] ?? -1;
    if (t === PartType.Broodling || t === PartType.Gravitant || t === PartType.Tempestling) return p;
  }
  return -1;
}

/** Fire the next pattern from body id. False, firing nothing, while the ship is too near the muzzle. */
function fire(w: World, bs: BossState, id: number): boolean {
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  const bx = w.x[id] ?? 0;
  const by = w.y[id] ?? 0;
  const bearing = Math.atan2(sy - by, sx - bx);
  const r = w.radius[id] ?? 0;
  let mx = bx + Math.cos(bearing) * r;
  let my = by + Math.sin(bearing) * r;
  if (!isInside(w.level.arena, mx, my, ENEMY_BULLET_RADIUS)) {
    mx = bx;
    my = by;
  }
  if (pointDist(mx, my, sx, sy) < ENEMY_BULLET_MIN_RANGE) return false;
  const pattern = patternAt(bs.rotCount);
  const n = patternBullets(pattern, bs.phase);
  const tier = bs.row.tier;
  const tele = hazardTelegraph(tier);
  const speed = rotationSpeed(bs.levelScale);
  let firstId = -1;
  for (let k = 0; k < n; k++) {
    const a = patternHeading(pattern, bearing, k, n);
    // Burst and pincer bullets leave from the body edge on their own heading.
    const ox = pattern === Pattern.Fan ? mx : bx + Math.cos(a) * r;
    const oy = pattern === Pattern.Fan ? my : by + Math.sin(a) * r;
    const inside = isInside(w.level.arena, ox, oy, ENEMY_BULLET_RADIUS);
    const b = spawnEnemyBullet(w, inside ? ox : bx, inside ? oy : by, a, speed, ENEMY_BULLET_RADIUS, tier, tele);
    if (firstId < 0) firstId = b;
  }
  if (firstId >= 0) {
    bs.rotShotId = firstId;
    bs.rotEv.x = mx;
    bs.rotEv.y = my;
  }
  bs.rotLog[bs.rotCount % ROTATION.logSize] = pattern;
  bs.rotCount++;
  return true;
}

/**
 * One step of the rotation (call from stepBossSchedule while the boss is alive). Its clock runs on
 * attack time (enrage and cadence) and holds while the boss is entering, the ship is down, the boss
 * is staggered, changing phase or shielded.
 */
export function stepRotation(w: World, bs: BossState, dt: number): void {
  if (bs.status !== 'alive') return;
  stepRotationLaunch(w, bs);
  if (!bs.rotOn || bs.mode === BossMode.Entering || !w.ship.active) return;
  if (bs.stagger > 0 || bs.phaseT > 0 || bs.shielded) return;
  const enraged = bs.hold || bs.age >= ENRAGE_AFTER_SEC;
  const adt = (enraged ? dt * ENRAGE_RATE : dt) * bs.cadence;
  if (bs.rotWait > 0) {
    bs.rotWait -= dt;
    if (bs.rotWait > 0) return;
    bs.rotWait = 0;
  } else {
    bs.rotT -= adt;
    if (bs.rotT > 0) return;
  }
  const id = shooter(w, bs);
  // Wait while any volley charges (one fx:bossShot at a time) or the ship is too near.
  if (id < 0 || bs.shotId >= 0 || bs.rotShotId >= 0 || !fire(w, bs, id)) {
    bs.rotWait = SHOT_RECHECK_SEC;
    return;
  }
  bs.rotT = rotationEvery(bs.row.tier, bs.phase);
}
