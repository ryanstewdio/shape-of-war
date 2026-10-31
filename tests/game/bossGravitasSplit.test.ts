// Boss abilities wave: Gravitas splits at its stage 2 crack into two half mass wells (Gravitants, 28 u,
// 160 hits each) that orbit each other round a centre seeking the ship, each pulling at half
// strength. Contact kills. The bar is the sum of the two; killing both ends the fight and awards the
// bonus once. 'sim:bossSplit' fires once.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossBonusAwarded, bossSlain, countHazards, countParts, damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { orbitToward } from '../../src/game/bosses/gravitas';
import { CRACK_AT, GRAVITANT, GRAVITAS, MAX_HAZARDS, MAX_PARTS } from '../../src/game/bosses/table';
import { BossMode, HazardType, PartType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function started(shield = true): { w: World; id: number } {
  const w = bossGame('gravitas', { par: 1000 }, {}, shield);
  park(w, -400, 0);
  return { w, id: enter(w) };
}

/** Push the body just under 33 percent with a Detonate style hit (ignores the anchors). */
function crack(w: World, id: number): void {
  w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
}

function wells(w: World): [number, number] {
  const s = bs(w);
  return [livePart(w, s, 0), livePart(w, s, 1)];
}

function pulls(w: World): number[] {
  const out: number[] = [];
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Pull) out.push(h);
  return out;
}

describe('gravitas split', () => {
  it('splits once, at the stage 2 crack, into two Gravitants (28 u, 160 hits)', () => {
    const { w, id } = started();
    const log: string[] = [];
    bus.on('sim:bossCrack', (e) => log.push(`crack${e.stage}`));
    bus.on('sim:bossSplit', (e) => log.push(`split:${e.id}:${e.parts}`));
    damageBoss(w, 10, 0, 0, true);
    expect(log).toEqual([]);
    crack(w, id);
    expect(log).toEqual(['crack1', 'crack2', 'split:gravitas:2']);
    expect(bs(w).split).toBe(true);
    expect(count(w, Kind.Boss)).toBe(0);
    expect(bs(w).id).toBe(-1);
    expect(readBoss(w, createBossView()).active).toBe(false);
    for (const p of wells(w)) {
      expect(p).toBeGreaterThan(0);
      expect(w.a[p]).toBe(PartType.Gravitant);
      expect(w.radius[p]).toBe(GRAVITANT.radius);
      expect(w.hp[p]).toBe(GRAVITANT.hp);
    }
    expect(GRAVITANT.hp).toBe(1600);
    run(w, 5);
    damageBoss(w, 10, 0, 0, true);
    expect(log.filter((e) => e.startsWith('split')).length).toBe(1);
  });

  it('the anchors go with the body; the pair orbits each other round a centre that seeks the ship', () => {
    const { w, id } = started();
    expect(countParts(w, bs(w))).toBe(GRAVITAS.anchors);
    crack(w, id);
    expect(countParts(w, bs(w))).toBe(2);
    run(w, 2); // the orbit opens at 60 u/s to 70 u
    const [a, b] = wells(w);
    const sep = (): number => Math.hypot((w.x[a] ?? 0) - (w.x[b] ?? 0), (w.y[a] ?? 0) - (w.y[b] ?? 0));
    expect(sep()).toBeCloseTo(GRAVITANT.orbit * 2, 0);
    const ang0 = Math.atan2((w.y[b] ?? 0) - (w.y[a] ?? 0), (w.x[b] ?? 0) - (w.x[a] ?? 0));
    const c0 = Math.hypot(bs(w).t1 - (w.x[0] ?? 0), bs(w).t2 - (w.y[0] ?? 0));
    run(w, 1);
    const ang1 = Math.atan2((w.y[b] ?? 0) - (w.y[a] ?? 0), (w.x[b] ?? 0) - (w.x[a] ?? 0));
    expect(Math.abs(ang1 - ang0)).toBeGreaterThan(0.5);
    expect(sep()).toBeCloseTo(GRAVITANT.orbit * 2, 0);
    const c1 = Math.hypot(bs(w).t1 - (w.x[0] ?? 0), bs(w).t2 - (w.y[0] ?? 0));
    expect(c0 - c1).toBeCloseTo(GRAVITANT.seekSpeed, 0);
  });

  it('each well carries its own pull at half strength; a dead well takes its pull with it', () => {
    const { w, id } = started();
    crack(w, id);
    run(w, 0.5);
    const [a, b] = wells(w);
    const ps = pulls(w);
    expect(ps.length).toBe(2);
    for (const p of ps) {
      expect(bs(w).hzRate[p]).toBe(GRAVITAS.pullMax / 2);
      expect(w.radius[p]).toBe(GRAVITANT.pullRadius);
      const onWell = [a, b].some((q) => Math.hypot((w.x[q] ?? 0) - (w.x[p] ?? 0), (w.y[q] ?? 0) - (w.y[p] ?? 0)) < 1e-6);
      expect(onWell).toBe(true);
    }
    damageBossPart(w, a, GRAVITANT.hp, 0, 0);
    run(w, 0.1);
    expect(pulls(w).length).toBe(1);
    // The survivor closes onto the pair centre.
    run(w, 2);
    expect(Math.hypot((w.x[b] ?? 0) - bs(w).t1, (w.y[b] ?? 0) - bs(w).t2)).toBeLessThan(1);
  });

  it('contact with a Gravitant kills; the pair survives the respawn', () => {
    const { w, id } = started(false);
    crack(w, id);
    run(w, 0.2);
    const lives = gs(w).lives;
    const [a] = wells(w);
    park(w, w.x[a] ?? 0, w.y[a] ?? 0);
    stepGame(w, DT, idle());
    expect(gs(w).lives).toBe(lives - 1);
    run(w, 3);
    expect(countParts(w, bs(w))).toBe(2);
    expect(bs(w).status).toBe('alive');
  });

  it('the orbit radius opens and closes at a bounded rate', () => {
    expect(orbitToward(0, 70, 0.5)).toBeCloseTo(30);
    expect(orbitToward(65, 70, 0.5)).toBe(70);
    expect(orbitToward(70, 0, 0.5)).toBeCloseTo(40);
    expect(orbitToward(10, 0, 0.5)).toBe(0);
  });
});

describe('gravitas split fight', () => {
  it('the bar is the sum of both wells', () => {
    const { w, id } = started();
    let hp = -1;
    bus.on('hud:boss', (e) => {
      hp = e.hp;
    });
    crack(w, id);
    run(w, 0.3);
    expect(hp).toBe(2 * GRAVITANT.hp);
    const [a] = wells(w);
    damageBossPart(w, a, 10, 0, 0);
    run(w, 0.3);
    expect(hp).toBe(2 * GRAVITANT.hp - 10);
  });

  it('killing both ends the fight and awards the bonus once', () => {
    const { w, id } = started();
    crack(w, id);
    const downs: number[] = [];
    let last = { hp: -1, mode: -1 };
    bus.on('sim:bossDown', () => downs.push(1));
    bus.on('hud:boss', (e) => {
      last = { hp: e.hp, mode: e.mode };
    });
    const score0 = gs(w).score;
    const kills0 = gs(w).kills;
    const [a, b] = wells(w);
    damageBossPart(w, a, GRAVITANT.hp, 0, 0);
    run(w, 0.3);
    expect(bs(w).status).toBe('alive');
    expect(bossSlain(w)).toBe(false);
    damageBossPart(w, b, GRAVITANT.hp, 0, 0);
    expect(bs(w).status).toBe('defeated');
    expect(bossSlain(w)).toBe(true);
    expect(last).toEqual({ hp: 0, mode: BossMode.Dying });
    const bonus = bossBonusAwarded(w);
    expect(bonus).toBeGreaterThan(0);
    expect(gs(w).score - score0).toBe(bonus);
    expect(gs(w).kills - kills0).toBe(1);
    run(w, 3);
    expect(gs(w).score - score0).toBe(bonus);
    expect(downs.length).toBe(1);
    expect(count(w, Kind.BossPart)).toBe(0);
    expect(pulls(w).length).toBe(0);
  });
});

describe('gravitas split caps and determinism', () => {
  it('60 s after the split: at most 8 hazards and 4 parts, rings keep collapsing onto the pair', () => {
    const { w, id } = started();
    crack(w, id);
    let rings = 0;
    for (let i = 0; i < 120 * 60; i++) {
      stepGame(w, DT, idle());
      expect(countHazards(w)).toBeLessThanOrEqual(MAX_HAZARDS);
      expect(countParts(w, bs(w))).toBeLessThanOrEqual(MAX_PARTS);
      for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Ring && (w.t[h] ?? 0) <= DT * 1.5) rings++;
    }
    expect(rings).toBeGreaterThanOrEqual(10);
  });

  it('two identical 60 s runs end in identical state and events', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): string => {
      const { w, id } = started();
      const log: string[] = [];
      bus.on('sim:bossSplit', (e) => log.push(`split${e.parts}`));
      crack(w, id);
      run(w, 60);
      const s = bs(w);
      const ps = wells(w).map((p) => `${w.x[p]},${w.y[p]},${w.hp[p]},${w.rot[p]}`);
      bus.clear();
      return `${log.join(',')}|${ps.join(';')}|${pulls(w).length}|${s.t0},${s.t1},${s.t2},${s.t3},${s.angle}`;
    };
    const a = once();
    expect(a).toBe(once());
    expect(a.startsWith('split2|')).toBe(true);
  });
});
