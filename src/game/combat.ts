// Collisions through Forge's spatial grid (collide.ts) and the kill path (docs/03 section 4).
// Pairs: bullet vs enemy, ship vs enemy, ship vs geom. Wells use a direct loop in gravitywell.ts.
// Scored kills call the scoring port's awardKill and emit 'fx:kill'. Scratch buffers are module
// level, so nothing here allocates per step.
import { bus } from '../core/events';
import { bossBodyContact, bossDamageForStyle, bossHittable, damageBoss, damageBossPart } from './bosses/core';
import { BOSS_DAMAGE, ORBIT_BOSS_COOLDOWN } from './bosses/table';
import { BULLET_RADIUS, hasHit, killBullet, passThrough, recordHit, STYLE_ORBIT, STYLE_PIERCE, STYLE_SPREAD, styleRadius } from './bullets';
import { queryCircleInto } from './collide';
import { defOf } from './defs';
import { isWarping } from './enemies/blink';
import { novaDeathRipple } from './enemies/gravitywell';
import { shardColour, shardHolding, splitLeaver } from './enemies/leaver';
import { shieldBlocks } from './enemies/bulwark';
import { isArmed } from './enemies/mine';
import { collectGeom, def as geomDef, PICKUP_RADIUS, spawnGeoms } from './geoms';
import { onScoringKill } from './pickup';
import { killShip } from './player';
import { removeEntity } from './remove';
import { gs, isDroppedHazard, isHostile, isV2Enemy, SNAKE_SEGMENTS, SNAKE_SLOTS, type GameState, type KillFx } from './state';
import { SHIP_RADIUS } from './ship';
import { moveTo } from './steer';
import { turboKill } from './turbo';
import { bulletRadiusOf, capsuleHits, SAW_AT, SWEEP_MAX, SAW_COOL_MULT, sawHitDamage, sawPowered, shieldOf, SPIKE_PIERCE, SPIKE_RADIUS, weaponState } from './weapons';
import { Kind, type World } from './world';

/** Scratch for surface deltas in this module. Read both fields before the next delta call. */
const dd = { x: 0, y: 0 };

const hits = new Int32Array(64);

/** Fill the reused kill payload and emit 'fx:kill'. kind and id name the entity that died. */
export function emitKill(g: GameState, x: number, y: number, colour: KillFx['colour'], kind: Kind, id: number): void {
  const f = g.killFx;
  f.x = x;
  f.y = y;
  f.colour = colour;
  f.kind = kind;
  f.id = id;
  bus.emit('fx:kill', f);
}

/** Fill the reused hit payload and emit 'fx:hit' (damage that did not kill, or a shield block). */
export function emitHit(g: GameState, x: number, y: number, kind: Kind, id: number, blocked: boolean): void {
  const f = g.hitFx;
  f.x = x;
  f.y = y;
  f.kind = kind;
  f.id = id;
  f.blocked = blocked;
  bus.emit('fx:hit', f);
}

/** Kills that count for the destroy objective (segments, wells, Mines, Slime and Leaver shards do not). */
export function countsForDestroy(k: number): boolean {
  return (k >= Kind.Grunt && k <= Kind.SnakeHead) || k === Kind.Spawner || isV2Enemy(k);
}

/**
 * Remove an enemy. Scored kills award points at the current multiplier, count for destroy,
 * drop geoms and emit 'fx:kill'. Unscored removal (bomb, death clear, well) does none of that.
 */
export function killEnemy(w: World, id: number, scored: boolean): void {
  if (id <= 0 || w.alive[id] !== 1) return;
  const k = w.kind[id] ?? 0;
  const d = defOf(k);
  if (!scored || d === null) {
    removeEntity(w, id);
    return;
  }
  if (k === Kind.GravityWell) novaDeathRipple(w, id); // T4: a nova well shot down ripples the pond
  const g = gs(w);
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  if (isDroppedHazard(k)) {
    // A shot Mine pops: a kill flash, but no score, no geoms, no kill count, no pickup progress.
    removeEntity(w, id);
    emitKill(g, x, y, d.colour, k, id);
    bus.emit('sfx', 'explode');
    return;
  }
  g.score += g.scoring.awardKill(w, k);
  if (countsForDestroy(k)) g.kills++;
  turboKill(g); // R3: each scored kill extends a running Turbo
  if (k === Kind.SnakeHead) segmentBurst(w, id);
  const colour = k === Kind.LeaverShard ? shardColour(w.a[id] ?? 0) : d.colour;
  removeEntity(w, id);
  emitKill(g, x, y, colour, k, id);
  bus.emit('sfx', 'explode');
  spawnGeoms(w, x, y, d.geoms);
  onScoringKill(w, x, y);
  // Leaver: the split comes after the removal, so the dead Leaver's cap slot is free for a shard.
  if (k === Kind.Leaver) splitLeaver(w, x, y, id);
}

/** Snake death burst (docs/01 section 6.4): one 'fx:kill' per live segment, no score, no geoms. */
export function segmentBurst(w: World, head: number): number {
  const g = gs(w);
  const slot = w.a[head] ?? -1;
  if (slot < 0 || slot >= SNAKE_SLOTS || g.snakeHead[slot] !== head) return 0;
  let n = 0;
  for (let s = 0; s < SNAKE_SEGMENTS; s++) {
    const sid = g.snakeSegs[slot * SNAKE_SEGMENTS + s] ?? -1;
    if (sid <= 0 || w.alive[sid] !== 1 || w.kind[sid] !== Kind.SnakeBody || w.a[sid] !== head) continue;
    emitKill(g, w.x[sid] ?? 0, w.y[sid] ?? 0, 'cyan', Kind.SnakeBody, sid);
    n++;
  }
  return n;
}

/**
 * Apply n damage. Returns true if the entity died. Snake segments are invulnerable. A hit that
 * leaves the entity alive emits 'fx:hit' at the target centre (blocked false).
 */
export function damage(w: World, id: number, n: number): boolean {
  return hurt(w, id, n, w.x[id] ?? 0, w.y[id] ?? 0);
}

/** damage() with an explicit impact point for the 'fx:hit' payload (the bullet or blade position). */
function hurt(w: World, id: number, n: number, hx: number, hy: number): boolean {
  if (w.alive[id] !== 1) return false;
  const k = w.kind[id] ?? 0;
  if (k === Kind.SnakeBody || !isHostile(k)) return false;
  const hp = (w.hp[id] ?? 0) - n;
  w.hp[id] = hp;
  if (hp <= 0) {
    killEnemy(w, id, true);
    return true;
  }
  emitHit(gs(w), hx, hy, k, id, false);
  return false;
}

/**
 * Drone shot or Ram damage on any target: a boss or a boss part takes bossAmount tenths of a hit
 * (BOSS_DAMAGE), anything else n hits. (hx, hy) is where the hit lands on a boss (Mirage's shield
 * arc reads it); it defaults to the target centre. Returns true if the target died.
 */
export function damageAny(w: World, id: number, n: number, bossAmount: number, hx: number = w.x[id] ?? 0, hy: number = w.y[id] ?? 0): boolean {
  const k = w.kind[id] ?? 0;
  if (k === Kind.Boss) return damageBoss(w, bossAmount, hx, hy);
  if (k === Kind.BossPart) return damageBossPart(w, id, bossAmount, w.x[id] ?? 0, w.y[id] ?? 0);
  return damage(w, id, n);
}

/** A target that bullets and the ship can touch: hostile, not telegraphing, not a warping Blink. */
export function isTargetable(w: World, id: number): boolean {
  if (w.alive[id] !== 1) return false;
  const k = w.kind[id] ?? 0;
  if (!isHostile(k) || (gs(w).tele[id] ?? 0) > 0) return false;
  return k !== Kind.Blink || !isWarping(w, id);
}

/** Bulwark shield: true when a hit from (px, py) on id lands on a Bulwark's front arc. */
export function shielded(w: World, id: number, px: number, py: number): boolean {
  return w.kind[id] === Kind.Bulwark && shieldBlocks(w, id, px, py);
}

/**
 * Bullet vs enemy. Spread and rapid bullets hit one entity and stop (during Turbo they pass through
 * one enemy first, BulletPool.extra). Pierce bullets hit up to 4
 * different enemies and are stopped by a snake segment. Orbit blades are handled in orbitHits.
 * Wells are handled in gravitywell.ts.
 */
export function bulletHits(w: World): void {
  const p = w.bullets;
  // V3 bosses: the body is too large for the grid query, so it gets a direct circle test. Any
  // bullet that touches it stops there, pierce included. -1 in every boss free world.
  const boss = bossHittable(w);
  for (let b = 0; b < p.cap; b++) {
    if (p.alive[b] !== 1) continue;
    const style = p.style[b] ?? STYLE_SPREAD;
    if (style === STYLE_ORBIT) continue;
    const combo = p.combo[b] ?? 0;
    const r = style === STYLE_SPREAD && combo === 0 ? BULLET_RADIUS : bulletRadiusOf(style, combo);
    const bx = p.x[b] ?? 0;
    const by = p.y[b] ?? 0;
    if (boss > 0 && bossBodyContact(w, boss, bx, by, r)) {
      killBullet(p, b);
      damageBoss(w, bossDamageForStyle(style), bx, by);
      continue;
    }
    const n = queryCircleInto(w.grid, w, bx, by, r, hits);
    for (let i = 0; i < n; i++) {
      const id = hits[i] ?? 0;
      if (id === 0) continue;
      if (w.kind[id] === Kind.BossPart) {
        // Pods, anchors and turrets: hit like an enemy (a pierce bullet passes on), BOSS_DAMAGE.
        if (style === STYLE_PIERCE) {
          if (hasHit(p, b, id)) continue;
          const stopped = recordHit(p, b, id);
          damageBossPart(w, id, bossDamageForStyle(style), bx, by);
          if (stopped) break;
          continue;
        }
        if (p.lastHit[b] === id) continue; // passed through it already (Turbo)
        const through = passThrough(p, b, id);
        if (!through) killBullet(p, b);
        damageBossPart(w, id, bossDamageForStyle(style), bx, by);
        if (through) continue;
        break;
      }
      if (!isTargetable(w, id)) continue;
      const k = w.kind[id] ?? 0;
      if (k === Kind.GravityWell) continue;
      if (k === Kind.Bulwark) {
        // A pierce bullet already through this Bulwark ignores it. Pierce (and any combo with it)
        // passes through the front arc; every other bullet is absorbed by it.
        if (style === STYLE_PIERCE && hasHit(p, b, id)) continue;
        if (style !== STYLE_PIERCE && shielded(w, id, bx, by)) {
          emitHit(gs(w), bx, by, Kind.Bulwark, id, true);
          killBullet(p, b);
          break;
        }
      }
      if (style === STYLE_PIERCE && k !== Kind.SnakeBody) {
        if (hasHit(p, b, id)) continue;
        const stopped = recordHit(p, b, id);
        hurt(w, id, 1, bx, by);
        if (stopped) break;
        continue;
      }
      if (k !== Kind.SnakeBody) {
        // Turbo: a spread, rapid or drone bullet with an extra hit passes through one enemy.
        if (p.lastHit[b] === id) continue;
        if (passThrough(p, b, id)) {
          hurt(w, id, 1, bx, by);
          continue;
        }
      }
      killBullet(p, b);
      if (k !== Kind.SnakeBody) hurt(w, id, 1, bx, by);
      break;
    }
  }
}

/**
 * Orbit v2 spikes vs enemy (orbit and the orbit pairs, GW1). Each spike is a capsule swept from its
 * previous to its current position (GW3: fast spikes on the chainsaw bar never tunnel), lengthened by
 * p.spikeLen at either end, SPIKE_RADIUS wide. A jump longer than SWEEP_MAX uses the spike alone along
 * its direction of travel (p.vx, p.vy). A resting spike
 * damages the first targetable enemy it touches (wells included, snake segments ignored) by 1 like a
 * blade; Eclipse resting spikes pierce up to SPIKE_PIERCE. A stretched spike (the chainsaw) hits every
 * enemy along its length. Then the spike rests the shield's cooldown. No push. Never consumed.
 */
export function orbitHits(w: World, dt: number): void {
  const s = weaponState(w);
  const sh = shieldOf(s.kind);
  if (sh === null) return;
  const p = w.bullets;
  const boss = bossHittable(w);
  const r = SPIKE_RADIUS;
  for (let i = 0; i < s.hitters; i++) {
    const cool = (s.bladeCool[i] ?? 0) - dt;
    s.bladeCool[i] = cool > 0 ? cool : 0;
    if (cool > 1e-9) continue;
    const b = s.blades[i] ?? -1;
    if (b < 0 || p.alive[b] !== 1 || p.style[b] !== STYLE_ORBIT) continue;
    const bx = p.x[b] ?? 0;
    const by = p.y[b] ?? 0;
    w.surface.delta(p.prevX[b] ?? bx, p.prevY[b] ?? by, bx, by, dd);
    const ex = dd.x;
    const ey = dd.y;
    const seg = Math.sqrt(ex * ex + ey * ey);
    let tx: number;
    let ty: number;
    let cx = bx;
    let cy = by;
    let half = (p.spikeLen[b] ?? 0) / 2;
    if (seg > 1e-6 && seg <= SWEEP_MAX) {
      tx = ex / seg;
      ty = ey / seg;
      cx = bx - ex / 2;
      cy = by - ey / 2;
      half += seg / 2;
    } else {
      const vx = p.vx[b] ?? 0;
      const vy = p.vy[b] ?? 0;
      const l = Math.sqrt(vx * vx + vy * vy);
      const a = p.phase[b] ?? 0;
      tx = l > 1e-9 ? vx / l : -Math.sin(a);
      ty = l > 1e-9 ? vy / l : Math.cos(a);
    }
    if (boss > 0 && capsuleHits(w.x[boss] ?? 0, w.y[boss] ?? 0, w.radius[boss] ?? 0, cx, cy, tx, ty, half, r, w.surface)) {
      // Against a boss body a hitter rests 0.25 s (boss rule 8), its shield cooldown otherwise.
      damageBoss(w, BOSS_DAMAGE.orbit, bx, by);
      s.bladeCool[i] = ORBIT_BOSS_COOLDOWN;
      continue;
    }
    const saw = (s.stretch[i] ?? 1) > SAW_AT;
    const powered = sawPowered(s.saw);
    const most = saw ? hits.length : sh.piercing ? SPIKE_PIERCE : 1;
    let struck = 0;
    const n = queryCircleInto(w.grid, w, cx, cy, half + r, hits);
    for (let j = 0; j < n && struck < most; j++) {
      const id = hits[j] ?? 0;
      if (id === 0) continue;
      if (!capsuleHits(w.x[id] ?? 0, w.y[id] ?? 0, w.radius[id] ?? 0, cx, cy, tx, ty, half, r, w.surface)) continue;
      if (w.kind[id] === Kind.BossPart) {
        p.lastHit[b] = id;
        damageBossPart(w, id, BOSS_DAMAGE.orbit, bx, by);
        struck++;
        continue;
      }
      if (!isTargetable(w, id) || w.kind[id] === Kind.SnakeBody) continue;
      p.lastHit[b] = id;
      // A hitter on a Bulwark's front arc is absorbed: it rests without dealing damage.
      if (shielded(w, id, bx, by)) emitHit(gs(w), bx, by, Kind.Bulwark, id, true);
      else hurt(w, id, powered ? sawHitDamage(w) : 1, bx, by);
      struck++;
    }
    if (struck > 0) s.bladeCool[i] = powered ? sh.cooldown * SAW_COOL_MULT : sh.cooldown;
  }
}

/** Ship vs enemy contact (wells excluded, see gravitywell.ts). Returns true if the ship died. */
export function shipHits(w: World): boolean {
  if (!w.ship.active || w.ship.invuln > 0 || gs(w).invulnerable) return false;
  const n = queryCircleInto(w.grid, w, w.x[0] ?? 0, w.y[0] ?? 0, SHIP_RADIUS, hits);
  for (let i = 0; i < n; i++) {
    const id = hits[i] ?? 0;
    if (id === 0 || !isTargetable(w, id) || w.kind[id] === Kind.GravityWell) continue;
    if (w.kind[id] === Kind.Mine && !isArmed(w, id)) continue; // arming delay: harmless
    killShip(w);
    return true;
  }
  return false;
}

/** Ship vs geom: collect every geom whose centre is within PICKUP_RADIUS of the ship centre. */
export function shipPickups(w: World): void {
  if (!w.ship.active) return;
  const n = queryCircleInto(w.grid, w, w.x[0] ?? 0, w.y[0] ?? 0, PICKUP_RADIUS - geomDef.radius, hits);
  for (let i = 0; i < n; i++) {
    const id = hits[i] ?? 0;
    if (w.alive[id] === 1 && w.kind[id] === Kind.Geom) collectGeom(w, id);
  }
}

export const SEPARATION_SPEED = 80;

/** Soft push between same kind enemies closer than the sum of their radii (docs/01 section 6.1). */
export function separate(w: World, dt: number): void {
  const g = gs(w);
  const push = SEPARATION_SPEED * dt;
  for (let id = 1; id < w.cap; id++) {
    if (w.alive[id] !== 1) continue;
    const k = w.kind[id] ?? 0;
    // Leaver shards join once their hold ends, so the fling lands exactly 40 u out and holds.
    if (!((k >= Kind.Grunt && k <= Kind.Dart) || isV2Enemy(k) || (k === Kind.LeaverShard && !shardHolding(w, id))) || (g.tele[id] ?? 0) > 0) continue;
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    const r = w.radius[id] ?? 0;
    const n = queryCircleInto(w.grid, w, x, y, r, hits);
    let px = 0;
    let py = 0;
    for (let i = 0; i < n; i++) {
      const o = hits[i] ?? 0;
      if (o === id || w.kind[o] !== k) continue;
      w.surface.delta(w.x[o] ?? 0, w.y[o] ?? 0, x, y, dd);
      let dx = dd.x;
      let dy = dd.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-6) {
        // Exactly stacked: split by id order.
        dx = id < o ? 1 : -1;
        dy = 0;
        d = 1;
      }
      px += dx / d;
      py += dy / d;
    }
    const pl = Math.sqrt(px * px + py * py);
    if (pl > 1e-9) moveTo(w, id, x + (px / pl) * push, y + (py / pl) * push);
  }
}
