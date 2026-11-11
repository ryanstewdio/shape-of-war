// Boss health bar (Ryan 2026-11-11). Every guardian shows a blue Shield bar that empties first (the
// stage 1 crack fires the moment it is gone) and then a red Health bar; Brood empties both, then its
// Broodlings carry their own Shield and Health bars under a "Broodlings" label, reaching 0 only with
// the last one. No bar ever jumps by more than one hit's worth (the fight bot lands at most a couple
// of tenths a step; Bastion's turret kill takes its turret cut, the one hit that breaks a turret).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bus } from '../../src/core/events';
import { BROODLINGS_LABEL, barFills, bossBar, SHIELD_SHARE, type BossBar } from '../../src/game/bosses/bar';
import { turretBarCut } from '../../src/game/bosses/bastion';
import { bossDamageForStyle, damageBoss, damageBossPart, livePart } from '../../src/game/bosses/core';
import { bossOf } from '../../src/game/bosses/state';
import { BOSS_DAMAGE, BROODLING, CRACK_AT, PIERCE_GUARDIAN_MULT } from '../../src/game/bosses/table';
import { createBossView, readBoss, type BossView } from '../../src/game/bosses/view';
import { armPierce, spawnBullet, STYLE_PIERCE } from '../../src/game/bullets';
import { bulletHits } from '../../src/game/combat';
import type { World } from '../../src/game/world';
import { BOSS_IDS, type BossId } from '../../src/levelgen/leveldef';
import { fightSeconds } from './bossFightBot';
import { bs, bossGame, enter, park } from './bossHelpers';

afterEach(() => {
  bus.clear();
  vi.restoreAllMocks();
});

const EPS = 1e-9;

/** The bar as one number: the share of the hit points left (shield on top of health). */
function level(b: BossBar): number {
  return b.shield * SHIELD_SHARE + b.health * (1 - SHIELD_SHARE);
}

describe('bar fills (pure)', () => {
  it('the shield is everything above the stage 1 crack line', () => {
    expect(SHIELD_SHARE).toBeCloseTo(1 - CRACK_AT[0], 12);
    expect(BROODLINGS_LABEL).toBe('Broodlings');
  });

  it('full, at the crack line, halfway down the health, at stage 2, empty', () => {
    const max = 1000;
    expect(barFills(max, max)).toEqual({ shield: 1, health: 1 });
    const line = max * CRACK_AT[0];
    const mid = barFills((max + line) / 2, max);
    expect(mid.shield).toBeCloseTo(0.5, 9);
    expect(mid.health).toBe(1);
    expect(barFills(line, max)).toEqual({ shield: 0, health: 1 });
    expect(barFills(line / 2, max).health).toBeCloseTo(0.5, 9);
    expect(barFills(max * CRACK_AT[1], max).health).toBeCloseTo(CRACK_AT[1] / CRACK_AT[0], 9); // stage 2 halfway down
    expect(barFills(0, max)).toEqual({ shield: 0, health: 0 });
  });

  it('clamps out of range hit points and an empty max', () => {
    expect(barFills(2000, 1000)).toEqual({ shield: 1, health: 1 });
    expect(barFills(-5, 1000)).toEqual({ shield: 0, health: 0 });
    expect(barFills(5, 0)).toEqual({ shield: 0, health: 0 });
  });

  it('bossBar is empty with nothing to show and reads a plain view without the bar fields', () => {
    const v = createBossView();
    expect(bossBar(v)).toEqual({ shield: 0, health: 0, label: '' });
    const plain: BossView = { active: true, id: 0, mode: 2, phase: 1, hp: 500, maxHp: 1000, modeT: 0, x: 0, y: 0, rot: 0, radius: 50 };
    const b = bossBar(plain);
    expect(b.shield).toBe(0);
    expect(b.health).toBeCloseTo(500 / 660, 9);
    expect(b.label).toBe('');
  });
});

interface Trace {
  /** Steps sampled. */
  n: number;
  /** Problems found, empty when every rule held. */
  bad: string[];
  /** Samples at key points. */
  sawFull: boolean;
  sawCrackedEmptyShield: boolean;
  sawHalfHealth: boolean;
  sawBroodlings: boolean;
  broodlingsFull: boolean;
  lastBroodlingsLevel: number;
  seconds: number;
}

/** The fight bot on id at Normal, checking the bar on every step. */
function trace(id: BossId): Trace {
  const t: Trace = { n: 0, bad: [], sawFull: false, sawCrackedEmptyShield: false, sawHalfHealth: false, sawBroodlings: false, broodlingsFull: false, lastBroodlingsLevel: -1, seconds: 0 };
  let cracked = false;
  bus.on('sim:bossCrack', (e) => {
    if (e.stage === 1) cracked = true;
  });
  const v = createBossView();
  let prev: BossBar | null = null;
  let prevMax = 0;
  const check = (w: World): void => {
    const s = bossOf(w);
    if (s === null || s.status !== 'alive') return;
    readBoss(w, v);
    const b = bossBar(v);
    const max = v.barMax ?? 0;
    t.n++;
    if (b.shield > 1 + EPS || b.shield < -EPS || b.health > 1 + EPS || b.health < -EPS) t.bad.push(`fill out of range ${JSON.stringify(b)}`);
    if (b.shield > EPS && b.health < 1 - EPS) t.bad.push(`health below full while the shield is up ${JSON.stringify(b)}`);
    if (v.barOn !== true) t.bad.push('no bar while the guardian lives');
    const brood = b.label === BROODLINGS_LABEL;
    if (!brood) {
      if (b.shield >= 1 - EPS && b.health >= 1 - EPS) t.sawFull = true;
      // The guardian cracks exactly when the shield empties.
      if (cracked && b.shield > EPS) t.bad.push(`cracked with shield ${b.shield}`);
      if (!cracked && b.shield <= EPS && (v.barHp ?? 0) < max * CRACK_AT[0]) t.bad.push(`shield empty at ${v.barHp} of ${max} but no crack`);
      if (cracked && b.shield <= EPS) t.sawCrackedEmptyShield = true;
      if (Math.abs(b.health - 0.5) < 0.01) t.sawHalfHealth = true;
    } else {
      if (!t.sawBroodlings) t.broodlingsFull = b.shield >= 1 - EPS && b.health >= 1 - EPS;
      t.sawBroodlings = true;
      t.lastBroodlingsLevel = level(b);
    }
    if (prev !== null && prev.label === b.label && prevMax === max) {
      // One hit's worth: the bot lands at most 2 tenths a step; a Bastion turret kill takes its cut.
      const hit = (2 + (id === 'bastion' ? turretBarCut(s.maxHp) : 0)) / max;
      const jump = Math.abs(level(b) - level(prev));
      if (jump > hit + 1e-6) t.bad.push(`jump ${jump.toFixed(4)} > ${hit.toFixed(4)} from ${JSON.stringify(prev)} to ${JSON.stringify(b)}`);
    }
    if (prev !== null && prev.label !== b.label && !(prev.label === '' && brood)) t.bad.push(`label ${prev.label} to ${b.label}`);
    prev = b;
    prevMax = max;
  };
  t.seconds = fightSeconds(id, { levelIndex: id === 'brood' ? 5 : id === 'warden' ? 10 : undefined, onStep: check });
  return t;
}

describe('the bar through a whole fight on the bot, every guardian at Normal', () => {
  for (const id of BOSS_IDS) {
    it(`${id}: full, the crack as the shield empties, half health, no jumps, the kill`, () => {
      const t = trace(id);
      expect(Number.isFinite(t.seconds)).toBe(true);
      expect(t.bad.slice(0, 5)).toEqual([]);
      expect(t.n).toBeGreaterThan(100);
      expect(t.sawFull).toBe(true);
      expect(t.sawCrackedEmptyShield).toBe(true);
      expect(t.sawHalfHealth).toBe(true);
      if (id === 'brood') {
        expect(t.sawBroodlings).toBe(true);
        expect(t.broodlingsFull).toBe(true);
        expect(t.lastBroodlingsLevel).toBeGreaterThan(0); // 0 only once the last Broodling falls
      } else {
        expect(t.sawBroodlings).toBe(false);
      }
    }, 60_000);
  }
});

describe('Brood and the Broodlings bars', () => {
  function started(): World {
    const w = bossGame('brood', { par: 1000 });
    park(w, 0, 0);
    enter(w);
    return w;
  }

  it('the body empties both bars, then the Broodlings show their own full bars under the label', () => {
    const w = started();
    const s = bs(w);
    const v = createBossView();
    const id = s.id;
    expect(bossBar(readBoss(w, v))).toEqual({ shield: 1, health: 1, label: '' });
    w.hp[id] = Math.floor(s.maxHp * CRACK_AT[0]) - 1;
    damageBoss(w, 1, 0, 0, true);
    let b = bossBar(readBoss(w, v));
    expect(b.shield).toBe(0);
    expect(b.health).toBeGreaterThan(0.99);
    expect(b.label).toBe('');
    w.hp[id] = 5;
    damageBoss(w, 10, 0, 0, true);
    expect(s.split).toBe(true);
    b = bossBar(readBoss(w, v));
    expect(v.active).toBe(false); // no body to draw
    expect(b).toEqual({ shield: 1, health: 1, label: BROODLINGS_LABEL });
    expect(v.barMax).toBe(3 * BROODLING.hp);
  });

  it('the Broodlings bar reaches 0 only when the last Broodling falls', () => {
    const w = started();
    const s = bs(w);
    const v = createBossView();
    w.hp[s.id] = 5;
    damageBoss(w, 10, 0, 0, true);
    const parts = [0, 1, 2].map((k) => livePart(w, s, k));
    damageBossPart(w, parts[0] ?? -1, 9999, 0, 0);
    let b = bossBar(readBoss(w, v));
    expect(level(b)).toBeCloseTo(2 / 3, 6); // a third gone, on the Broodlings' own scale
    expect(b.health).toBe(1);
    damageBossPart(w, parts[1] ?? -1, 9999, 0, 0);
    b = bossBar(readBoss(w, v));
    expect(b.shield).toBe(0); // past the Broodlings' shield line
    expect(b.health).toBeCloseTo(1 / 3 / CRACK_AT[0], 6);
    expect(b.label).toBe(BROODLINGS_LABEL);
    damageBossPart(w, parts[2] ?? -1, BROODLING.hp - 1, 0, 0);
    b = bossBar(readBoss(w, v));
    expect(b.health).toBeGreaterThan(0);
    damageBossPart(w, parts[2] ?? -1, 1, 0, 0);
    expect(s.status).toBe('defeated');
    expect(bossBar(readBoss(w, v))).toEqual({ shield: 0, health: 0, label: '' });
  });

  it('the bar samples are deterministic: two fights read the same bars', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random in boss code');
    });
    const run = (): string => {
      const v = createBossView();
      let h = 7;
      fightSeconds('brood', {
        levelIndex: 5,
        onStep: (w) => {
          const b = bossBar(readBoss(w, v));
          h = (h * 31 + Math.round(b.shield * 1e6) * 3 + Math.round(b.health * 1e6) + b.label.length) % 2147483647;
        },
      });
      return String(h);
    };
    expect(run()).toBe(run());
  });
});

describe('pierce against guardians (1.5x, guardians only)', () => {
  it('one named constant: 40 tenths times 1.5 on bodies, cores and parts', () => {
    expect(PIERCE_GUARDIAN_MULT).toBe(1.5);
    expect(bossDamageForStyle(STYLE_PIERCE)).toBe(Math.round(BOSS_DAMAGE.pierce * PIERCE_GUARDIAN_MULT));
    expect(BOSS_DAMAGE.pierce).toBe(40);
  });

  it('a pierce bullet takes 60 tenths off a Broodling', () => {
    const w = bossGame('brood', { par: 1000 });
    park(w, 0, 0);
    enter(w);
    const s = bs(w);
    w.hp[s.id] = 5;
    damageBoss(w, 10, 0, 0, true);
    const p = livePart(w, s, 0);
    const hp0 = w.hp[p] ?? 0;
    const b = spawnBullet(w.bullets, w.x[p] ?? 0, w.y[p] ?? 0, 0, 0, 1);
    armPierce(w.bullets, b);
    bulletHits(w);
    expect(w.hp[p]).toBe(hp0 - 60);
  });
});
