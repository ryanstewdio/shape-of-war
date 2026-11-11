// Swarm pierce-arms (Ryan 2026-11-11): the enraged Spindle keeps four live sweep arms through every
// sweep and reversal, and Pierce shots (and combos with Pierce) pass through a Bulwark's shield.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { damageBoss } from '../../src/game/bosses/core';
import { liveSweep } from '../../src/game/bosses/spindle';
import { FURY_BREAK_SEC, HAZARD, SPINDLE_FURY } from '../../src/game/bosses/table';
import { armPierce, spawnBullet } from '../../src/game/bullets';
import { bulletHits } from '../../src/game/combat';
import * as bulwark from '../../src/game/enemies/bulwark';
import { stepGame } from '../../src/game/game';
import { Kind } from '../../src/game/world';
import { bs, bossGame, enter, park, run, legacyBossHp } from './bossHelpers';
import { DT, idle, makeGame, put } from './helpers';

legacyBossHp();

afterEach(() => bus.clear());

describe('spindle fury arms', () => {
  it('the sim builds four live sweep arms through every enraged sweep and reversal', () => {
    expect(HAZARD.sweepArmsMax).toBeGreaterThanOrEqual(4);
    const w = bossGame('spindle');
    park(w, 600, 400);
    enter(w);
    bs(w).open = true;
    damageBoss(w, 2501, 0, 0);
    run(w, FURY_BREAK_SEC + 0.1);
    const s = bs(w);
    expect(s.fury).toBe(2);
    const built0 = s.abl[1] ?? 0; // sweeps built (spindle.ts SWEEPS slot)
    for (let i = 0; i < 120 * 20; i++) {
      stepGame(w, DT, idle());
      const h = liveSweep(w, s);
      if (h < 0) continue;
      expect(w.vy[h]).toBe(SPINDLE_FURY.arms);
      expect(w.vy[h]).toBe(4);
    }
    expect((s.abl[1] ?? 0) - built0).toBeGreaterThanOrEqual(5); // a reversal every 3 s over 20 s
  });
});

describe('bulwark vs pierce', () => {
  function shoot(pierce: boolean, x: number): { hp: number; alive: boolean } {
    const { w } = makeGame();
    const id = put(w, bulwark.def, 200, 0);
    w.rot[id] = 0; // facing +x, the shield side
    const b = spawnBullet(w.bullets, x, 0, 0, 0, 1);
    if (pierce) armPierce(w.bullets, b);
    bulletHits(w);
    return { hp: w.hp[id] ?? 0, alive: w.bullets.alive[b] === 1 };
  }

  it('a Pierce shot on the front arc takes PIERCE_BULWARK_DAMAGE and keeps flying', () => {
    expect(bulwark.PIERCE_BULWARK_DAMAGE).toBe(2);
    const r = shoot(true, 216);
    expect(r.hp).toBe(bulwark.def.hp - bulwark.PIERCE_BULWARK_DAMAGE);
    expect(r.alive).toBe(true);
  });

  it('a Pierce shot on the back also takes PIERCE_BULWARK_DAMAGE', () => {
    expect(shoot(true, 184).hp).toBe(bulwark.def.hp - bulwark.PIERCE_BULWARK_DAMAGE);
  });

  it('two Pierce hits kill a Bulwark', () => {
    const { w } = makeGame();
    const id = put(w, bulwark.def, 200, 0);
    w.rot[id] = 0;
    for (let i = 0; i < 2; i++) {
      const b = spawnBullet(w.bullets, 216, 0, 0, 0, 1);
      armPierce(w.bullets, b);
      bulletHits(w);
    }
    expect(w.alive[id] === 1 && w.kind[id] === Kind.Bulwark).toBe(false); // the slot may be reused by a drop
  });

  it('a spread shot on the front arc is still absorbed', () => {
    const r = shoot(false, 216);
    expect(r.hp).toBe(bulwark.def.hp);
    expect(r.alive).toBe(false);
  });

  it('a spread shot on the back still hurts', () => {
    expect(shoot(false, 184).hp).toBe(bulwark.def.hp - 1);
  });

  it('shieldBlocks itself is unchanged for the front arc (bombs and blades use it)', () => {
    const { w } = makeGame();
    const id = put(w, bulwark.def, 200, 0);
    w.rot[id] = 0;
    expect(w.kind[id]).toBe(Kind.Bulwark);
    expect(bulwark.shieldBlocks(w, id, 216, 0)).toBe(true);
  });
});
