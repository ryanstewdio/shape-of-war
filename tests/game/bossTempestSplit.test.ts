// Tempest split (GW2): at the stage 2 crack (33 percent) the body splits once into two smaller
// Tempests (60 percent size, the remaining hit points split evenly), following the Brood split
// pattern: 'sim:bossSplit' once, the bar is the sum of the parts, contact kills and the level is won
// when both die. Each keeps the storm attack (Slime trail, marked dash) at full rate since GW3
// (chase and flank rules in bossTempestGw3.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { bossBonusAwarded, bossOnBomb, bossSlain, countParts, damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { BOSS_TABLE, CRACK_AT, STAGGER_SEC, TEMPEST, TEMPESTLING } from '../../src/game/bosses/table';
import { dashEveryFor, splitHp, tempestlingAdt, tempestlingRadius } from '../../src/game/bosses/tempest';
import { BossMode, HazardType, PartType } from '../../src/game/bosses/types';
import { createBossView, readBoss } from '../../src/game/bosses/view';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { bs, bossGame, count, enter, park, run } from './bossHelpers';
import { stateHash } from './bossGw2Helpers';
import { DT, idle } from './helpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

function started(shield = true): { w: World; id: number } {
  const w = bossGame('tempest', { par: 1000 }, {}, shield);
  park(w, 0, 0);
  return { w, id: enter(w) };
}

/** Push the body just under 33 percent with a Detonate style hit (ignores the window). */
function crack(w: World, id: number): number {
  w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
  return Math.floor(bs(w).maxHp * CRACK_AT[1]) - 5;
}

function parts(w: World): [number, number] {
  const s = bs(w);
  return [livePart(w, s, 0), livePart(w, s, 1)];
}

function markers(w: World): number {
  let n = 0;
  for (let h = 1; h < w.cap; h++) if (w.alive[h] === 1 && w.kind[h] === Kind.BossHazard && w.a[h] === HazardType.Lane && bs(w).hzMarker[h] === 1) n++;
  return n;
}

describe('tempest split pure rules', () => {
  it('splitHp shares evenly and keeps the total; 60 percent size; full rate', () => {
    expect(splitHp(2965, 0, 2) + splitHp(2965, 1, 2)).toBe(2965);
    expect(splitHp(2965, 0, 2)).toBe(1483);
    expect(splitHp(2965, 1, 2)).toBe(1482);
    expect(splitHp(3000, 0, 2)).toBe(1500);
    expect(splitHp(3000, 1, 2)).toBe(1500);
    expect(splitHp(-4, 0, 2)).toBe(0);
    expect(tempestlingRadius(BOSS_TABLE.tempest.radius)).toBeCloseTo(BOSS_TABLE.tempest.radius * 0.6, 9);
    expect(TEMPESTLING.rate).toBe(1);
    expect(tempestlingAdt(1, false)).toBeCloseTo(1, 9);
    expect(tempestlingAdt(1, true)).toBeCloseTo(1.3, 9);
  });
});

describe('tempest split', () => {
  it('splits once, at the stage 2 crack, into two Tempestlings sharing the remaining hit points', () => {
    const { w, id } = started();
    const log: string[] = [];
    bus.on('sim:bossCrack', (e) => log.push(`crack${e.stage}`));
    bus.on('sim:bossSplit', (e) => log.push(`split:${e.id}:${e.parts}`));
    damageBoss(w, 10, 0, 0, true);
    expect(log).toEqual([]);
    const left = crack(w, id);
    expect(log).toEqual(['crack1', 'crack2', 'split:tempest:2']);
    expect(bs(w).split).toBe(true);
    expect(count(w, Kind.Boss)).toBe(0);
    expect(bs(w).id).toBe(-1);
    expect(readBoss(w, createBossView()).active).toBe(false);
    const [a, b] = parts(w);
    for (const p of [a, b]) {
      expect(p).toBeGreaterThan(0);
      expect(w.a[p]).toBe(PartType.Tempestling);
      expect(w.radius[p]).toBeCloseTo(BOSS_TABLE.tempest.radius * TEMPESTLING.sizeShare, 4);
    }
    expect((w.hp[a] ?? 0) + (w.hp[b] ?? 0)).toBe(left);
    expect(Math.abs((w.hp[a] ?? 0) - (w.hp[b] ?? 0))).toBeLessThanOrEqual(1);
    run(w, 5);
    expect(log.filter((e) => e.startsWith('split')).length).toBe(1);
  });

  it('the boss bar is the sum of the parts', () => {
    const { w, id } = started();
    let last = -1;
    bus.on('hud:boss', (e) => {
      last = e.hp;
    });
    crack(w, id);
    const [a, b] = parts(w);
    damageBossPart(w, a, 100, 0, 0);
    run(w, 0.3);
    expect(last).toBe((w.hp[a] ?? 0) + (w.hp[b] ?? 0));
  });

  it('each part chases, lays Slime and dashes behind a marker, at full rate', () => {
    const { w, id } = started();
    crack(w, id);
    const [a, b] = parts(w);
    const dashes = [0, 0];
    const wasMarked = [false, false];
    let peakMarkers = 0;
    const secs = 30;
    for (let i = 0; i < 120 * secs; i++) {
      stepGame(w, DT, idle());
      peakMarkers = Math.max(peakMarkers, markers(w));
      [a, b].forEach((p, k) => {
        const st = bs(w).abl[k * 8] ?? 0;
        const marked = st === 1;
        if (marked && !wasMarked[k]) dashes[k] = (dashes[k] ?? 0) + 1;
        wasMarked[k] = marked;
        expect(w.alive[p]).toBe(1);
      });
    }
    // Phase 3 chase between dashes is 4 s at full rate, plus the wind up, dash and rest.
    const every = dashEveryFor(3) / TEMPESTLING.rate;
    for (const d of dashes) {
      expect(d).toBeGreaterThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(Math.ceil(secs / every) + 1);
    }
    expect(peakMarkers).toBeGreaterThanOrEqual(1);
    expect(count(w, Kind.Slime)).toBeGreaterThan(0);
    expect(TEMPEST.slimeEvery).toBe(1.0);
  });

  it('contact with a Tempestling kills', () => {
    const { w, id } = started(false);
    gs(w).lives = 5;
    crack(w, id);
    run(w, 0.5);
    w.ship.invuln = 0;
    const [a] = parts(w);
    park(w, w.x[a] ?? 0, w.y[a] ?? 0);
    stepGame(w, DT, idle());
    expect(gs(w).lives).toBe(4);
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
    const [a, b] = parts(w);
    damageBossPart(w, a, w.hp[a] ?? 0, 0, 0);
    run(w, 0.3);
    expect(bs(w).status).toBe('alive');
    expect(bossSlain(w)).toBe(false);
    expect(countParts(w, bs(w))).toBe(1);
    damageBossPart(w, b, w.hp[b] ?? 0, 0, 0);
    expect(bs(w).status).toBe('defeated');
    expect(bossSlain(w)).toBe(true);
    expect(last).toEqual({ hp: 0, mode: BossMode.Dying });
    const bonus = bossBonusAwarded(w);
    expect(bonus).toBeGreaterThan(0);
    expect(gs(w).score - score0).toBe(bonus);
    run(w, 3);
    expect(downs.length).toBe(1);
    expect(count(w, Kind.BossPart)).toBe(0);
  });

  it('a bomb mid wind up sends the part back to its chase: no unmarked dash', () => {
    const { w, id } = started();
    crack(w, id);
    for (let i = 0; i < 120 * 20 && markers(w) === 0; i++) stepGame(w, DT, idle());
    expect(markers(w)).toBeGreaterThan(0);
    const winding = [0, 1].filter((k) => (bs(w).abl[k * 8] ?? 0) === 1);
    expect(winding.length).toBeGreaterThan(0);
    bossOnBomb(w); // clears every hazard (the markers too) and staggers the boss
    expect(markers(w)).toBe(0);
    run(w, STAGGER_SEC + DT * 2);
    for (const k of winding) expect(bs(w).abl[k * 8]).toBe(0); // TempestMove.Lap (the chase for a part)
    expect(bs(w).status).toBe('alive');
  });

  it('determinism: two 40 s runs after the split hash equal, with no Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): number => {
      const { w, id } = started();
      const log: number[] = [];
      bus.on('sim:bossSplit', (e) => log.push(e.parts));
      crack(w, id);
      let h = log.length;
      for (let i = 0; i < 120 * 40; i++) {
        stepGame(w, DT, idle());
        if (i % 30 === 0) h = (h * 31 + stateHash(w)) % 2147483647;
      }
      bus.clear();
      expect(log).toEqual([2]);
      return h;
    };
    expect(once()).toBe(once());
  });
});
