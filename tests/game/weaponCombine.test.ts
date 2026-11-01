// V3 wave D: weapon combining (docs/13 SPEC 3.5 "Combining", "Spread as an ingredient", "Drop
// schedule", "The six pairs") and orbit v2 (GW1: no forward bullet, two counter rotating rings of 4
// spikes at 80 u and 100 u, aim side spikes stretch to a 2.5x chainsaw over 0.25 s).
import { afterEach, describe, expect, it } from 'vitest';
import { bus, type WeaponKind } from '../../src/core/events';
import { type BulletPool, killBullet, stepBulletPool, STYLE_ORBIT, STYLE_PIERCE, STYLE_RAPID, STYLE_SPREAD } from '../../src/game/bullets';
import { orbitHits } from '../../src/game/combat';
import * as pinwheel from '../../src/game/enemies/pinwheel';
import { setInvulnerable, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import { stepShip } from '../../src/game/ship';
import {
  bulletRadiusOf,
  capsuleHits,
  COMBO_NAMES,
  COMBO_TABLE,
  comboOf,
  countKill,
  ECLIPSE_SHIELD,
  equipWeapon,
  fireWeapon,
  HAIL_LIFE,
  ORBIT_OUTER,
  ORBIT_RADIUS,
  placeBlades,
  ORBIT_SHIELD,
  ringDir,
  ringOf,
  SAW_CONE,
  SAW_FULL,
  sawWeight,
  shieldOf,
  spikeAngle,
  SPIKE_LEN,
  SPIKE_STRETCH,
  spikeStretch,
  stepSaw,
  STRETCH_SEC,
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

  it('Eclipse: 1 pierce bullet (3 hits) plus the two rings with piercing spikes', () => {
    const w = pair('pierce', 'orbit');
    expect(weaponRate(w)).toBe(8);
    const v = volley(w);
    expect(v.hits).toEqual([3]);
    expect(v.combo).toEqual([6]);
    expect(ECLIPSE_SHIELD).toMatchObject({ perRing: 4, inner: 80, outer: 100, rev: 2.0, cooldown: 0.15, piercing: true });
    expect(orbiters(w.bullets)).toBe(8);
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

/** Kill every orbit spike except hitter keep, so orbitHits sees one capsule only. */
function only(w: World, keep: number): void {
  const s = weaponState(w);
  for (let i = 0; i < s.hitters; i++) if (i !== keep) killBullet(w.bullets, s.blades[i] ?? -1);
}

/** Angle of a pool bullet round the ship. */
function angleOf(w: World, b: number): number {
  return Math.atan2((w.bullets.y[b] ?? 0) - (w.y[0] ?? 0), (w.bullets.x[b] ?? 0) - (w.x[0] ?? 0));
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

describe('orbit v2 (GW1): two counter rotating rings and the chainsaw', () => {
  it('pure rules: 2.5x over 0.25 s and back, 60 deg cone, rings half a gap apart turning opposite ways', () => {
    expect(SPIKE_STRETCH).toBe(2.5);
    expect(STRETCH_SEC).toBe(0.25);
    expect(SAW_CONE).toBeCloseTo(Math.PI / 3, 9);
    let level = 0;
    for (let i = 0; i < 30; i++) level = stepSaw(level, true, DT);
    expect(level).toBeCloseTo(1, 6); // 30 steps of 1/120 s = 0.25 s
    expect(spikeStretch(level, 1)).toBeCloseTo(2.5, 6);
    for (let i = 0; i < 15; i++) level = stepSaw(level, false, DT);
    expect(level).toBeCloseTo(0.5, 6);
    for (let i = 0; i < 15; i++) level = stepSaw(level, false, DT);
    expect(level).toBe(0);
    expect(sawWeight(0, 0)).toBe(1);
    expect(sawWeight((55 * Math.PI) / 180, 0)).toBeGreaterThan(0);
    expect(sawWeight((61 * Math.PI) / 180, 0)).toBe(0);
    expect(sawWeight(Math.PI, 0)).toBe(0);
    expect(sawWeight(2 * Math.PI - 0.1, 0)).toBe(1); // wraps
    expect(ringDir(0)).toBe(1);
    expect(ringDir(1)).toBe(-1);
    expect(ringOf(ORBIT_SHIELD, 3)).toBe(0);
    expect(ringOf(ORBIT_SHIELD, 4)).toBe(1);
    expect(spikeAngle(ORBIT_SHIELD, 0, 0.3)).toBeCloseTo(0.3, 9);
    expect(spikeAngle(ORBIT_SHIELD, 4, 0.3)).toBeCloseTo(-0.3 + Math.PI / 4, 9);
  });

  it('capsule hit test: along the length, its radius plus the target radius, clamped at the ends', () => {
    // Capsule centred at (0, 0) along +y, half length 30, radius 7; target radius 20.
    expect(capsuleHits(0, 50, 20, 0, 0, 0, 1, 30, 7)).toBe(true);
    expect(capsuleHits(0, 58, 20, 0, 0, 0, 1, 30, 7)).toBe(false);
    expect(capsuleHits(26, 0, 20, 0, 0, 0, 1, 30, 7)).toBe(true);
    expect(capsuleHits(28, 0, 20, 0, 0, 0, 1, 30, 7)).toBe(false);
    expect(capsuleHits(20, 45, 20, 0, 0, 0, 1, 30, 7)).toBe(true);
    expect(capsuleHits(20, 55, 20, 0, 0, 0, 1, 30, 7)).toBe(false);
  });

  it('two rings of 4: 80 u turning forward and 100 u turning back, no push', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    expect(orbiters(w.bullets)).toBe(8);
    const s = weaponState(w);
    const inner = s.blades[0] ?? -1;
    const outer = s.blades[ORBIT_SHIELD.perRing] ?? -1;
    let ai = angleOf(w, inner);
    let ao = angleOf(w, outer);
    for (let i = 0; i < 12; i++) {
      stepGame(w, DT, aimAt(1, 0)); // aim held: the saw stretches, the radii stay
      const ni = angleOf(w, inner);
      const no = angleOf(w, outer);
      expect(wrap(ni - ai)).toBeGreaterThan(0);
      expect(wrap(no - ao)).toBeLessThan(0);
      expect(wrap(ni - ai)).toBeCloseTo(-wrap(no - ao), 6);
      ai = ni;
      ao = no;
      for (let k = 0; k < s.hitters; k++) {
        const b = s.blades[k] ?? -1;
        const d = Math.hypot((w.bullets.x[b] ?? 0) - (w.x[0] ?? 0), (w.bullets.y[b] ?? 0) - (w.y[0] ?? 0));
        expect(d).toBeCloseTo(k < ORBIT_SHIELD.perRing ? ORBIT_RADIUS : ORBIT_OUTER, 3);
      }
    }
  });

  it('holding the aim stretches aim side spikes to 2.5x over 0.25 s along the tangent; the far side stays short', () => {
    const { w } = makeGame();
    setInvulnerable(w, true);
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const p = w.bullets;
    for (let i = 0; i < 30; i++) stepGame(w, DT, aimAt(1, 0));
    expect(s.saw).toBeCloseTo(1, 6);
    let sawn = 0;
    for (let k = 0; k < s.hitters; k++) {
      const b = s.blades[k] ?? -1;
      const rel = Math.abs(wrap(angleOf(w, b)));
      const len = p.spikeLen[b] ?? 0;
      if (rel <= SAW_FULL - 1e-3) {
        expect(len).toBeCloseTo(SPIKE_LEN * SPIKE_STRETCH, 3);
        sawn++;
      }
      if (rel >= SAW_CONE + 1e-3) expect(len).toBeCloseTo(SPIKE_LEN, 5);
      // The tangent: vx, vy are square to the radius.
      const rx = (p.x[b] ?? 0) - (w.x[0] ?? 0);
      const ry = (p.y[b] ?? 0) - (w.y[0] ?? 0);
      expect(Math.abs(rx * (p.vx[b] ?? 0) + ry * (p.vy[b] ?? 0))).toBeLessThan(1e-2 * Math.hypot(rx, ry) * Math.hypot(p.vx[b] ?? 0, p.vy[b] ?? 0) + 1e-6);
    }
    expect(sawn).toBeGreaterThan(0);
    // Release: back to rest within 0.25 s.
    for (let i = 0; i < 30; i++) stepGame(w, DT, idle());
    expect(s.saw).toBe(0);
    for (let k = 0; k < s.hitters; k++) expect(p.spikeLen[s.blades[k] ?? -1] ?? 0).toBeCloseTo(SPIKE_LEN, 5);
  });

  it('a stretched spike hits every enemy along its capsule; at rest it hits one, like a blade', () => {
    const run = (saw: number): number[] => {
      const { w } = makeGame();
      equipWeapon(w, 'orbit');
      const s = weaponState(w);
      s.orbitPhase = 0; // inner spike 0 at (80, 0), tangent +y
      s.saw = saw;
      w.ship.aimAngle = 0;
      placeBlades(w);
      only(w, 0);
      const ids = [put(w, pinwheel.def, ORBIT_RADIUS, 0), put(w, pinwheel.def, ORBIT_RADIUS, 4), put(w, pinwheel.def, ORBIT_RADIUS, 45), put(w, pinwheel.def, ORBIT_RADIUS + 40, 0)];
      for (const id of ids) w.hp[id] = 100;
      orbitHits(w, DT);
      const out = ids.map((id) => 100 - (w.hp[id] ?? 0));
      bus.clear();
      return out;
    };
    const rest = run(0);
    expect(rest[0]! + rest[1]!).toBe(1); // one of the two on the spike, once
    expect(rest[2]).toBe(0); // beyond the short spike
    expect(rest[3]).toBe(0);
    const sawn = run(1);
    // GW2: a powered saw (level above 0.5) alternates 1 and 2 damage per hit, 1.5x on average.
    for (const k of [0, 1, 2]) expect([1, 2]).toContain(sawn[k]); // [2]: 45 u along the tangent, inside the 60 u chainsaw
    expect(sawn[0]! + sawn[1]! + sawn[2]!).toBe(4); // 1 + 2 + 1
    expect(sawn[3]).toBe(0); // 40 u off the line: outside the capsule
  });

  it('a spike rests the shield cooldown after it strikes', () => {
    const { w } = makeGame();
    equipWeapon(w, 'orbit');
    const s = weaponState(w);
    const spike = s.blades[ORBIT_SHIELD.perRing] ?? -1; // first outer spike
    const id = put(w, pinwheel.def, w.bullets.x[spike] ?? 0, w.bullets.y[spike] ?? 0);
    w.hp[id] = 100;
    orbitHits(w, DT);
    expect(w.hp[id]).toBeLessThan(100);
    const after = w.hp[id] ?? 0;
    expect(s.bladeCool[ORBIT_SHIELD.perRing]).toBeCloseTo(ORBIT_SHIELD.cooldown, 5);
    orbitHits(w, DT);
    expect(w.hp[id]).toBe(after);
  });

  it('Eclipse resting spikes still pierce (up to 3)', () => {
    const w = pair('pierce', 'orbit');
    const s = weaponState(w);
    only(w, 0);
    const spike = s.blades[0] ?? -1;
    const x = w.bullets.x[spike] ?? 0;
    const y = w.bullets.y[spike] ?? 0;
    const ids = [put(w, pinwheel.def, x, y), put(w, pinwheel.def, x + 1, y), put(w, pinwheel.def, x, y + 1)];
    for (const id of ids) w.hp[id] = 100;
    orbitHits(w, DT);
    for (const id of ids) expect(w.hp[id]).toBeLessThan(100);
  });

  it('Halo, Whirl and Eclipse inherit the two rings and the chainsaw', () => {
    for (const k of ['orbit', 'spread+orbit', 'rapid+orbit', 'pierce+orbit'] as const) {
      const sh = shieldOf(k);
      expect(sh?.perRing).toBe(4);
      expect(sh?.inner).toBe(ORBIT_RADIUS);
      expect(sh?.outer).toBe(ORBIT_OUTER);
    }
    for (const [a, b] of [['spread', 'orbit'], ['rapid', 'orbit'], ['pierce', 'orbit']] as const) {
      const w = pair(a, b);
      setInvulnerable(w, true);
      const s = weaponState(w);
      const inner = s.blades[0] ?? -1;
      const outer = s.blades[4] ?? -1;
      const ai = angleOf(w, inner);
      const ao = angleOf(w, outer);
      for (let i = 0; i < 6; i++) stepGame(w, DT, aimAt(1, 0));
      // Opposite turns: after 0.05 s the rings moved by equal and opposite angles.
      expect(wrap(angleOf(w, inner) - ai)).toBeGreaterThan(0);
      expect(wrap(angleOf(w, inner) - ai)).toBeCloseTo(-wrap(angleOf(w, outer) - ao), 4);
      for (let i = 0; i < 24; i++) stepGame(w, DT, aimAt(1, 0));
      expect(orbiters(w.bullets)).toBe(8);
      expect(s.saw).toBeCloseTo(1, 6);
      let longest = 0;
      for (let k = 0; k < s.hitters; k++) longest = Math.max(longest, w.bullets.spikeLen[s.blades[k] ?? -1] ?? 0);
      expect(longest).toBeCloseTo(SPIKE_LEN * SPIKE_STRETCH, 3);
      bus.clear();
    }
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
      for (let b = 0; b < p.cap; b++) if (p.alive[b] === 1) h = (h * 31 + Math.round((p.x[b] ?? 0) * 10) + Math.round((p.spikeLen[b] ?? 0) * 10) + (p.combo[b] ?? 0) * 7 + (p.style[b] ?? 0)) | 0;
      const s = weaponState(w);
      const out = `${s.kind}|${s.timer}|${s.orbitPhase}|${s.saw}|${Array.from(s.stretch).join(',')}|${h}`;
      bus.clear();
      return out;
    };
    expect(once()).toBe(once());
  });
});
