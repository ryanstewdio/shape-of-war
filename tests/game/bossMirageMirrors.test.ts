// Boss abilities wave: at its stage 2 crack Mirage leaves two mirror images (Mirror parts, 1 HP, no
// contact kill) that copy its last two positions 0.6 s after each warp while the real body keeps
// warping. A shot pops a mirror for no score; missing mirrors return every 6 s while Mirage lives.
// 'sim:bossSplit' fires once; the body stays.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { countHazards, countParts, damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { CRACK_AT, MAX_HAZARDS, MAX_PARTS, MIRROR } from '../../src/game/bosses/table';
import { PartType } from '../../src/game/bosses/types';
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
  const w = bossGame('mirage', { par: 1000 }, {}, shield);
  park(w, 0, 0);
  return { w, id: enter(w) };
}

function crack(w: World, id: number): void {
  bs(w).fury = 2; // fury three: Mirage is on the shared fury; skip the break to isolate the mirrors
  w.hp[id] = Math.floor(bs(w).maxHp * CRACK_AT[1]) + 5;
  damageBoss(w, 10, w.x[id] ?? 0, w.y[id] ?? 0, true);
}

function mirrors(w: World): [number, number] {
  const s = bs(w);
  return [livePart(w, s, 0), livePart(w, s, 1)];
}

/** Step until the body warps (its position jumps). Returns the position it left. */
function untilWarp(w: World, id: number, secs = 6): { x: number; y: number } {
  for (let i = 0; i < secs * 120; i++) {
    const x = w.x[id] ?? 0;
    const y = w.y[id] ?? 0;
    stepGame(w, DT, idle());
    if (Math.hypot((w.x[id] ?? 0) - x, (w.y[id] ?? 0) - y) > 50) return { x, y };
  }
  throw new Error('no warp');
}

describe('mirage mirrors', () => {
  it('appear once, at the stage 2 crack, while the body stays', () => {
    const { w, id } = started();
    const log: string[] = [];
    bus.on('sim:bossCrack', (e) => log.push(`crack${e.stage}`));
    bus.on('sim:bossSplit', (e) => log.push(`split:${e.id}:${e.parts}`));
    damageBoss(w, 10, 0, 0, true);
    expect(countParts(w, bs(w))).toBe(0);
    crack(w, id);
    expect(log).toEqual(['crack1', 'crack2', 'split:mirage:2']);
    expect(bs(w).split).toBe(false);
    expect(count(w, Kind.Boss)).toBe(1);
    expect(readBoss(w, createBossView()).active).toBe(true);
    for (const p of mirrors(w)) {
      expect(p).toBeGreaterThan(0);
      expect(w.a[p]).toBe(PartType.Mirror);
      expect(w.hp[p]).toBe(MIRROR.hp);
      expect(w.radius[p]).toBe(w.radius[id]);
    }
    run(w, 14); // respawns never emit the split again
    expect(log.filter((e) => e.startsWith('split')).length).toBe(1);
  });

  it('copy the last two positions 0.6 s after each warp, while the body keeps warping', () => {
    const { w, id } = started();
    crack(w, id);
    const left1 = untilWarp(w, id);
    const left2 = untilWarp(w, id);
    const [m0, m1] = mirrors(w);
    // Inside the delay the mirrors still stand where the previous copy put them.
    expect(Math.hypot((w.x[m0] ?? 0) - left2.x, (w.y[m0] ?? 0) - left2.y)).toBeGreaterThan(1);
    run(w, MIRROR.delaySec - 0.1);
    expect(Math.hypot((w.x[m0] ?? 0) - left2.x, (w.y[m0] ?? 0) - left2.y)).toBeGreaterThan(1);
    run(w, 0.15);
    expect(Math.hypot((w.x[m0] ?? 0) - left2.x, (w.y[m0] ?? 0) - left2.y)).toBeLessThan(1);
    expect(Math.hypot((w.x[m1] ?? 0) - left1.x, (w.y[m1] ?? 0) - left1.y)).toBeLessThan(1);
    // The mirrors face as the body does.
    expect(w.rot[m0]).toBe(w.rot[id]);
    expect(w.rot[m1]).toBe(w.rot[id]);
  });

  it('a shot pops a mirror for no score; contact with one never kills', () => {
    const { w, id } = started(false);
    crack(w, id);
    const [m0, m1] = mirrors(w);
    const score = gs(w).score;
    const kills = gs(w).kills;
    expect(damageBossPart(w, m0, 10, w.x[m0] ?? 0, w.y[m0] ?? 0)).toBe(true);
    expect(w.alive[m0] === 1 && w.a[m0] === PartType.Mirror).toBe(false);
    expect(gs(w).score).toBe(score);
    expect(gs(w).kills).toBe(kills);
    const lives = gs(w).lives;
    park(w, w.x[m1] ?? 0, w.y[m1] ?? 0);
    stepGame(w, DT, idle());
    expect(gs(w).lives).toBe(lives);
    expect(bs(w).status).toBe('alive');
  });

  it('missing mirrors come back every 6 s while Mirage lives', () => {
    const { w, id } = started();
    crack(w, id);
    const [m0, m1] = mirrors(w);
    damageBossPart(w, m0, 10, 0, 0);
    damageBossPart(w, m1, 10, 0, 0);
    expect(countParts(w, bs(w))).toBe(0);
    let back = -1;
    // The crack also drops Mirage into phase 3: its 1 s phase change pause holds every clock.
    for (let i = 0; i < 120 * 8; i++) {
      stepGame(w, DT, idle());
      if (countParts(w, bs(w)) === 2) {
        back = i * DT;
        break;
      }
    }
    expect(back).toBeGreaterThan(0);
    expect(back).toBeGreaterThan(MIRROR.respawnSec - 0.05);
    expect(back).toBeLessThanOrEqual(MIRROR.respawnSec + 1.05);
    // And again after the next pair is popped.
    for (const p of mirrors(w)) damageBossPart(w, p, 10, 0, 0);
    run(w, MIRROR.respawnSec + 0.05);
    expect(countParts(w, bs(w))).toBe(2);
  });

  it('the mirrors go with the body when Mirage dies, the bonus once', () => {
    const { w, id } = started();
    crack(w, id);
    const downs: number[] = [];
    bus.on('sim:bossDown', () => downs.push(1));
    const score0 = gs(w).score;
    damageBoss(w, w.hp[id] ?? 0, w.x[id] ?? 0, w.y[id] ?? 0, true);
    expect(bs(w).status).toBe('defeated');
    expect(count(w, Kind.BossPart)).toBe(0);
    run(w, MIRROR.respawnSec + 1);
    expect(count(w, Kind.BossPart)).toBe(0);
    expect(downs.length).toBe(1);
    expect(gs(w).score - score0).toBe(bs(w).bonus);
  });
});

describe('mirage mirrors caps and determinism', () => {
  it('60 s after the split: at most 4 parts and 8 hazards', () => {
    const { w, id } = started();
    crack(w, id);
    for (let i = 0; i < 120 * 60; i++) {
      stepGame(w, DT, idle());
      expect(countParts(w, bs(w))).toBeLessThanOrEqual(MAX_PARTS);
      expect(countHazards(w)).toBeLessThanOrEqual(MAX_HAZARDS);
    }
    expect(count(w, Kind.Boss)).toBe(1);
  });

  it('two identical 60 s runs end in identical state', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const once = (): string => {
      const { w, id } = started();
      crack(w, id);
      const [m0] = mirrors(w);
      damageBossPart(w, m0, 10, 0, 0);
      run(w, 60);
      const ps = mirrors(w).map((p) => `${w.x[p]},${w.y[p]},${w.rot[p]}`);
      const out = `${w.x[id]},${w.y[id]}|${ps.join(';')}|${Array.from(bs(w).abl).join(',')}`;
      bus.clear();
      return out;
    };
    expect(once()).toBe(once());
  });
});
