// V3 wave D: weapon combining (docs/13 SPEC 3.5 "Combining", "Spread as an ingredient", "Drop
// schedule", "The six pairs") and Ryan's orbit redesign (no forward bullet, spikes on the shield, the
// aim push to 1.8x and back over 0.4 s).
import { afterEach, describe, expect, it } from 'vitest';
import { bus, type WeaponKind } from '../../src/core/events';
import { type BulletPool, stepBulletPool, STYLE_ORBIT, STYLE_PIERCE, STYLE_RAPID, STYLE_SPREAD } from '../../src/game/bullets';
import { orbitHits } from '../../src/game/combat';
import * as pinwheel from '../../src/game/enemies/pinwheel';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import { stepShip } from '../../src/game/ship';
import {
  aimWeight,
  bulletRadiusOf,
  COMBO_NAMES,
  COMBO_TABLE,
  comboOf,
  countKill,
  ECLIPSE_SHIELD,
  equipWeapon,
  EXPAND_MAX,
  EXPAND_SEC,
  expansionPulse,
  fireWeapon,
  HAIL_LIFE,
  ORBIT_RADIUS,
  placeBlades,
  ORBIT_SHIELD,
  shieldOf,
  shieldReach,
  stepPush,
  weaponPool,
  weaponRate,
  weaponState,
  WHIRL_SHIELD,
} from '../../src/game/weapons';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { DT, idle, makeGame, put } from './helpers';

afterEach(() => bus.clear());

function aimAt(ax: number, ay: number): InputState {
  return { move: { active: false, x: 0, y: 0 }, aim: { active: true, x: ax, y: ay }, bomb: false, superPressed: false, pause: false };
}

function live(p: BulletPool): number[] {
  const out: number[] = [];
  for (let i = 0; i < p.cap; i++) if (p.alive[i] === 1 && p.style[i] !== STYLE_ORBIT) out.push(i);
  return out;
}

function orbiters(p: BulletPool): number {
  let n = 0;
  for (let i = 0; i < p.cap; i++) if (p.alive[i] === 1 && p.style[i] === STYLE_ORBIT) n++;
  return n;
}

/** A world holding the pair a then b, ship at rest at the origin. */
function pair(a: 'spread' | 'rapid' | 'pierce' | 'orbit', b: 'spread' | 'rapid' | 'pierce' | 'orbit'): World {
  const { w } = makeGame();
  equipWeapon(w, a);
  equipWeapon(w, b);
  return w;
}

/** One volley along +x; returns the forward bullets' angles (degrees), styles, combos and pierce hits. */
function volley(w: World): { deg: number[]; style: number[]; combo: number[]; hits: number[]; y: number[] } {
  const before = new Set(live(w.bullets));
  fireWeapon(w, 0, 0, 0);
  const p = w.bullets;
  const ids = live(p).filter((i) => !before.has(i));
  return {
    deg: ids.map((i) => Math.round((Math.atan2(p.vy[i] ?? 0, p.vx[i] ?? 0) * 180) / Math.PI)),
    style: ids.map((i) => p.style[i] ?? -1),
    combo: ids.map((i) => p.combo[i] ?? -1),
    hits: ids.map((i) => p.pierce[i] ?? -1),
    y: ids.map((i) => Math.round(p.y[i] ?? 0)),
  };
}

describe('pair table', () => {
  it('six canonical pairs with Ryan\'s names, any collection order', () => {
    expect(COMBO_TABLE.map((c) => c.name)).toEqual(['Hail', 'Trident', 'Halo', 'Needle', 'Whirl', 'Eclipse']);
    expect(COMBO_TABLE.map((c) => c.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(comboOf('rapid', 'spread')).toBe('spread+rapid');
    expect(comboOf('orbit', 'pierce')).toBe('pierce+orbit');
    expect(comboOf('rapid', 'rapid')).toBeNull();
    for (const c of COMBO_TABLE) expect(COMBO_NAMES[c.id]).toBe(c.name);
  });

  it('Hail: 3 rapid bullets at -5, 0, +5 deg, 22 volleys a second, life 0.9', () => {
    const w = pair('rapid', 'spread'); // spread first would do nothing: nothing is active yet
    expect(weaponState(w).kind).toBe('spread+rapid');
    expect(weaponRate(w)).toBe(22);
    const v = volley(w);
    expect(v.deg.sort((a, b) => a - b)).toEqual([-5, 0, 5]);
    expect(v.style).toEqual([STYLE_RAPID, STYLE_RAPID, STYLE_RAPID]);
    expect(v.combo).toEqual([1, 1, 1]);
    for (let i = 0; i < w.bullets.cap; i++) if (w.bullets.alive[i] === 1 && w.bullets.combo[i] === 1) expect(w.bullets.life[i]).toBeCloseTo(0.9, 5);
  });

  it('Trident: 3 pierce bullets at -8, 0, +8 deg with 2 hits, radius 5, 10 volleys', () => {
    const w = pair('pierce', 'spread');
    expect(weaponState(w).kind).toBe('spread+pierce');
    expect(weaponRate(w)).toBe(10);
    const v = volley(w);
    expect(v.deg.sort((a, b) => a - b)).toEqual([-8, 0, 8]);
    expect(v.style).toEqual([STYLE_PIERCE, STYLE_PIERCE, STYLE_PIERCE]);
    expect(v.hits).toEqual([2, 2, 2]);
    expect(bulletRadiusOf(STYLE_PIERCE, 2)).toBe(5);
  });

  it('Halo: spread forward plus the orbit shield (4 blades, 4 spikes)', () => {
    const w = pair('orbit', 'spread');
    expect(weaponState(w).kind).toBe('spread+orbit');
    expect(weaponRate(w)).toBe(10);
    const v = volley(w);
    expect(v.deg.sort((a, b) => a - b)).toEqual([-6, 0, 6]);
    expect(v.style).toEqual([STYLE_SPREAD, STYLE_SPREAD, STYLE_SPREAD]);
    expect(v.combo).toEqual([3, 3, 3]);
    expect(orbiters(w.bullets)).toBe(8);
  });

  it('Needle: 2 parallel pierce bullets 5 u either side, 3 hits, radius 4, 14 volleys', () => {
    const w = pair('rapid', 'pierce');
    expect(weaponRate(w)).toBe(14);
    const v = volley(w);
    expect(v.deg).toEqual([0, 0]);
    expect(v.y.sort((a, b) => a - b)).toEqual([-5, 5]);
    expect(v.hits).toEqual([3, 3]);
    expect(bulletRadiusOf(STYLE_PIERCE, 4)).toBe(4);
  });

  it('Whirl: 2 parallel rapid bullets plus a shield turning at 3.0 rev/s, 18 volleys', () => {
    const w = pair('orbit', 'rapid');
    expect(weaponState(w).kind).toBe('rapid+orbit');
    expect(weaponRate(w)).toBe(18);
    const v = volley(w);
    expect(v.style).toEqual([STYLE_RAPID, STYLE_RAPID]);
    expect(v.combo).toEqual([5, 5]);
    expect(shieldOf('rapid+orbit')).toBe(WHIRL_SHIELD);
    expect(WHIRL_SHIELD.rev).toBe(3.0);
    expect(orbiters(w.bullets)).toBe(8);
  });

  it('Eclipse: 1 pierce bullet (3 hits) plus 5 blades at 100 u and 5 piercing spikes', () => {
    const w = pair('pierce', 'orbit');
    expect(weaponRate(w)).toBe(8);
    const v = volley(w);
    expect(v.hits).toEqual([3]);
    expect(v.combo).toEqual([6]);
    expect(ECLIPSE_SHIELD).toMatchObject({ blades: 5, spikes: 5, radius: 100, rev: 2.0, cooldown: 0.15, piercing: true });
    expect(orbiters(w.bullets)).toBe(10);
  });
});

describe('collection rules', () => {
  it('nothing active: a spread pickup changes nothing, any other equips for 20 s', () => {
    const { w } = makeGame();
    let huds = 0;
    bus.on('hud:weapon', () => huds++);
    expect(equipWeapon(w, 'spread')).toBe(false);
    expect(weaponState(w).kind).toBe('spread');
    expect(weaponState(w).timer).toBe(0);
    expect(huds).toBe(0);
    expect(equipWeapon(w, 'pierce')).toBe(true);
    expect(weaponState(w).kind).toBe('pierce');
    expect(weaponState(w).timer).toBe(20);
  });

  it('spread combines while another weapon is active', () => {
    const w = pair('rapid', 'spread');
    expect(weaponState(w).kind).toBe('spread+rapid');
  });

  it('a third kind replaces the older ingredient; an ingredient refreshes without reordering', () => {
    const combines: string[] = [];
    bus.on('fx:weaponCombine', (e) => combines.push(`${e.kind}:${e.a}:${e.b}`));
    const { w } = makeGame();
    equipWeapon(w, 'rapid');
    equipWeapon(w, 'pierce'); // {rapid, pierce}, rapid older
    expect(weaponState(w).kind).toBe('rapid+pierce');
    for (let i = 0; i < 120 * 5; i++) stepGame(w, DT, idle());
    equipWeapon(w, 'rapid'); // refresh: rapid stays the older
    expect(weaponState(w).timer).toBe(20);
    expect(weaponState(w).older).toBe('rapid');
    equipWeapon(w, 'orbit'); // replaces rapid (older): {pierce, orbit}
    expect(weaponState(w).kind).toBe('pierce+orbit');
    expect(weaponState(w).older).toBe('pierce');
    expect(weaponState(w).newer).toBe('orbit');
    equipWeapon(w, 'spread'); // replaces pierce: {orbit, spread} = Halo
    expect(weaponState(w).kind).toBe('spread+orbit');
    expect(combines).toEqual(['rapid+pierce:rapid:pierce', 'pierce+orbit:pierce:orbit', 'spread+orbit:spread:orbit']);
  });

  it('hud:weapon carries the pair name; expiry emits fx:weaponExpire, a death does not', () => {
    const names: (string | undefined)[] = [];
    const expired: WeaponKind[] = [];
    bus.on('hud:weapon', (e) => names.push(e.title));
    bus.on('fx:weaponExpire', (e) => expired.push(e.kind));
    const w = pair('rapid', 'orbit');
    expect(names[names.length - 1]).toBe('Whirl');
    for (let i = 0; i < 20 * 120 + 2; i++) stepGame(w, DT, idle());
    expect(weaponState(w).kind).toBe('spread');
    expect(expired).toEqual(['rapid+orbit']);
    equipWeapon(w, 'pierce');
    killShip(w);
    expect(weaponState(w).kind).toBe('spread');
    expect(expired).toEqual(['rapid+orbit']);
  });
});

describe('drops while armed', () => {
  it('spread joins the pool only while a weapon is active', () => {
    expect(weaponPool(1, false, false)).toEqual(['rapid']);
    expect(weaponPool(1, false, true)).toEqual(['rapid', 'spread']);
    expect(weaponPool(2, false, true)).toEqual(['rapid', 'pierce', 'spread']);
    expect(weaponPool(4, false, true)).toEqual(['rapid', 'pierce', 'orbit', 'spread']);
    expect(weaponPool(1, true, true)).toEqual(['rapid', 'pierce', 'orbit', 'spread']);
  });

  it('armed, the next drop falls due within 12 kills', () => {
    const c = { kills: 0, nextDropAt: 15, pending: false };
    for (let i = 0; i < 15; i++) countKill(c);
    expect(c.pending).toBe(true);
    expect(c.nextDropAt).toBe(40);
    c.pending = false;
    countKill(c, true);
    expect(c.nextDropAt).toBe(16 + 12);
  });
});

describe('orbit shield redesign', () => {
  it('the push goes out to 1.8x and back over 0.4 s on the aim side only', () => {
    expect(EXPAND_MAX).toBe(1.8);
    expect(EXPAND_SEC).toBe(0.4);
    expect(expansionPulse(0)).toBe(0);
    expect(expansionPulse(0.5)).toBeCloseTo(1);
    expect(expansionPulse(1)).toBeCloseTo(0);
    expect(shieldReach(0, 1)).toBeCloseTo(1.8);
    expect(shieldReach(Math.PI, 1)).toBe(1);
    expect(shieldReach(Math.PI / 2, 1)).toBeCloseTo(1);
    expect(aimWeight(Math.PI / 4)).toBeCloseTo(0.5);
    // Rises then falls inside one 0.4 s swing.
    let prev = 0;
    let peak = 0;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const v = expansionPulse(u);
      if (u <= 0.5) expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      else expect(v).toBeLessThanOrEqual(prev + 1e-9);
      peak = Math.max(peak, v);
      prev = v;
    }
    expect(peak).toBeCloseTo(1);
  });

  it('the push cycles while the stick is held and finishes its swing when released', () => {
    const s = weaponState(makeGame().w);
    for (let i = 0; i < 24; i++) stepPush(s, true, DT); // 0.2 s
    expect(s.pushT).toBeCloseTo(0.2, 5);
    for (let i = 0; i < 48; i++) stepPush(s, true, DT); // wraps
    expect(s.pushT).toBeLessThan(EXPAND_SEC);
    stepPush(s, false, DT);
    expect(s.pushT).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) stepPush(s, false, DT);
    expect(s.pushT).toBe(0);
  });

  it('every shield carries 4 to 6 spikes', () => {
    for (const k of ['orbit', 'spread+orbit', 'rapid+orbit', 'pierce+orbit'] as const) {
      const sh = shieldOf(k);
      expect(sh).not.toBeNull();
      expect(sh?.spikes ?? 0).toBeGreaterThanOrEqual(4);
      expect(sh?.spikes ?? 0).toBeLessThanOrEqual(6);
    }
    expect(ORBIT_SHIELD.spikes).toBe(4);
  });

  it('holding the stick pushes aim side blades out toward 144 u while the far side stays at 80 u', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    let far = 0;
    let back = Infinity;
    for (let i = 0; i < 48; i++) {
      stepGame(w, DT, aimAt(1, 0));
      const s = weaponState(w);
      for (let k = 0; k < ORBIT_SHIELD.blades; k++) {
        const b = s.blades[k] ?? -1;
        const dx = (w.bullets.x[b] ?? 0) - (w.x[0] ?? 0);
        const dy = (w.bullets.y[b] ?? 0) - (w.y[0] ?? 0);
        const d = Math.hypot(dx, dy);
        if (dx > 0 && Math.abs(dy) < d * 0.3) far = Math.max(far, d);
        if (dx < -ORBIT_RADIUS * 0.9) back = Math.min(back, d);
      }
    }
    expect(far).toBeGreaterThan(ORBIT_RADIUS * 1.6);
    expect(far).toBeLessThanOrEqual(ORBIT_RADIUS * EXPAND_MAX + 1e-3);
    expect(back).toBeCloseTo(ORBIT_RADIUS, 3);
  });

  it('a spike damages like a blade: once, then it rests the shield cooldown', () => {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const spike = s.blades[ORBIT_SHIELD.blades] ?? -1; // first spike
    const id = put(w, pinwheel.def, w.bullets.x[spike] ?? 0, w.bullets.y[spike] ?? 0);
    w.hp[id] = 100;
    orbitHits(w, DT);
    expect(w.hp[id]).toBeLessThan(100);
    const after = w.hp[id] ?? 0;
    expect(s.bladeCool[ORBIT_SHIELD.blades]).toBeCloseTo(ORBIT_SHIELD.cooldown, 5);
    orbitHits(w, DT);
    expect(w.hp[id]).toBe(after);
  });

  it('Eclipse spikes pierce: one spike hits every enemy it touches (up to 3)', () => {
    const w = pair('pierce', 'orbit');
    const s = weaponState(w);
    const spike = s.blades[ECLIPSE_SHIELD.blades] ?? -1;
    const x = w.bullets.x[spike] ?? 0;
    const y = w.bullets.y[spike] ?? 0;
    const ids = [put(w, pinwheel.def, x, y), put(w, pinwheel.def, x + 1, y), put(w, pinwheel.def, x, y + 1)];
    for (const id of ids) w.hp[id] = 100;
    // Keep the blades out of the way: only the spike touches them.
    orbitHits(w, DT);
    for (const id of ids) expect(w.hp[id]).toBeLessThan(100);
  });

  it('a pushed blade shoves a surviving enemy outward', () => {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    s.pushT = EXPAND_SEC / 2; // peak push
    w.ship.aimAngle = 0;
    s.orbitPhase = 0; // blade 0 on the aim line
    placeBlades(w);
    const b = s.blades[0] ?? -1;
    expect(w.bullets.x[b] ?? 0).toBeCloseTo(ORBIT_RADIUS * EXPAND_MAX, 3);
    const bx = w.bullets.x[b] ?? 0;
    const id = put(w, pinwheel.def, bx, w.bullets.y[b] ?? 0);
    w.hp[id] = 100;
    const x0 = w.x[id] ?? 0;
    orbitHits(w, DT);
    expect(w.hp[id]).toBeLessThan(100);
    expect(w.x[id] ?? 0).toBeGreaterThan(x0 + 10);
  });
});

describe('combined weapon budget and determinism', () => {
  it('Hail under Turbo stays at or under 130 live player bullets (rate x 3 x life x 2)', () => {
    const hail = COMBO_TABLE[0];
    expect(hail?.name).toBe('Hail');
    const steady = (hail?.rate ?? 0) * 2 * 3 * HAIL_LIFE;
    expect(steady).toBeCloseTo(118.8, 5);
    expect(steady).toBeLessThanOrEqual(130);
    // And the sim agrees: 3 s of Turbo Hail with the real bullet step never passes it.
    const w = pair('rapid', 'spread');
    setInvulnerable(w, true);
    w.ship.fireRateScale = 2;
    let peak = 0;
    for (let i = 0; i < 120 * 3; i++) {
      stepShip(w, DT, aimAt(0, 1)); // bullets end by their life or at a wall
      stepBulletPool(w.bullets, w.level.arena, DT);
      equipWeapon(w, 'rapid'); // refresh keeps Hail
      peak = Math.max(peak, w.bullets.liveCount);
    }
    expect(peak).toBeLessThanOrEqual(130);
    expect(w.bullets.dropped).toBe(0);
  });

  it('two identical runs through combos give identical bullets and weapon state', () => {
    const once = (): string => {
      const { w } = makeGame();
      setInvulnerable(w, true);
      const order = ['rapid', 'orbit', 'pierce', 'spread'] as const;
      for (let i = 0; i < 120 * 12; i++) {
        if (i % 360 === 0) equipWeapon(w, order[(i / 360) % order.length] ?? 'rapid');
        stepGame(w, DT, aimAt(Math.cos(i * 0.01), Math.sin(i * 0.013)));
      }
      const p = w.bullets;
      let h = 0;
      for (let b = 0; b < p.cap; b++) if (p.alive[b] === 1) h = (h * 31 + Math.round((p.x[b] ?? 0) * 10) + (p.combo[b] ?? 0) * 7 + (p.style[b] ?? 0)) | 0;
      const s = weaponState(w);
      const out = `${s.kind}|${s.timer}|${s.orbitPhase}|${s.pushT}|${h}`;
      bus.clear();
      return out;
    };
    expect(once()).toBe(once());
  });
});
