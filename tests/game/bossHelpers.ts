// Shared helpers for the boss tests (docs/12 wave V3-A).
import { TURRET_SHIELD } from '../../src/game/bosses/bastion';
import { bossHittable, damageBossPart } from '../../src/game/bosses/core';
import { bossOf, type BossState } from '../../src/game/bosses/state';
import { afterAll, beforeAll, expect } from 'vitest';
import { BOSS_TABLE } from '../../src/game/bosses/table';
import { stepGame, type GameOptions } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { BOSS_LEVEL_AT_SEC } from '../../src/levelgen/boss';
import { BOSS_SHORT_LEVEL_AT_SEC } from '../../src/levelgen/short';
import type { BossId, LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle, makeGame, quietLevel } from './helpers';

/**
 * Destroy Bastion turret p at once, as if the 1.5 s turret shield after the last turret death had
 * already run out (GW3), so a test can take turrets down back to back.
 */
export function breakTurret(w: World, p: number, amount: number): void {
  bs(w).abl[TURRET_SHIELD] = 0;
  damageBossPart(w, p, amount, w.x[p] ?? 0, w.y[p] ?? 0);
}

/** Hit points of every row before release polish item 7 (the GW6 table the mechanics tests were tuned on). */
export const LEGACY_BOSS_HP: Readonly<Record<BossId, number>> = {
  warden: 520,
  brood: 400,
  spindle: 500,
  ember: 600,
  mirage: 640,
  gravitas: 700,
  bastion: 1242,
  tempest: 1138.5,
  twins: 1000,
  prism: 1000,
};

/**
 * Pin LEGACY_BOSS_HP in BOSS_TABLE for the enclosing describe (or file), restored after it. For
 * mechanics tests that count exact tenths, thresholds and split shares on the old rows; vitest gives
 * every test file its own module copy, so the pin never leaks into another file.
 */
export function legacyBossHp(): void {
  const saved: Partial<Record<BossId, number>> = {};
  beforeAll(() => {
    for (const id of Object.keys(LEGACY_BOSS_HP) as BossId[]) {
      saved[id] = BOSS_TABLE[id].hp;
      BOSS_TABLE[id].hp = LEGACY_BOSS_HP[id];
    }
  });
  afterAll(() => {
    for (const id of Object.keys(saved) as BossId[]) BOSS_TABLE[id].hp = saved[id] ?? BOSS_TABLE[id].hp;
  });
}

/**
 * Level index the boss tests play at unless a patch says otherwise: level 20 is the 100 percent
 * point of the release polish level scale, so mechanics tests measure the table values as they are.
 */
export const BOSS_TEST_LEVEL = 20;

/** A quiet rect level (1400 x 900, no waves) carrying boss id with its entrance at atSec. */
export function bossLevel(id: BossId, patch: Partial<LevelDef> = {}, atSec = 0.25): LevelDef {
  return quietLevel({
    levelIndex: BOSS_TEST_LEVEL,
    boss: { id, tier: BOSS_TABLE[id].tier, atSec, hpMul: 1 },
    objective: { kind: 'survive', durationSec: 900 },
    ...patch,
  });
}

/**
 * Game on bossLevel. The ship is vulnerable unless shield is true (the stress scene flag). The drone
 * defaults to Collect so no drone shot changes the boss's hit points behind a test's back. The
 * attack rotation is off unless rotation is true, so a test of one attack counts that attack only.
 */
export function bossGame(
  id: BossId,
  patch: Partial<LevelDef> = {},
  opts: GameOptions = {},
  shield = true,
  atSec = 0.25,
  rotation = false,
): World {
  const lvl = bossLevel(id, patch, atSec);
  const w = makeGame({ drone: 'collect', levelIndex: lvl.levelIndex, ...patch, boss: lvl.boss, objective: lvl.objective }, opts).w;
  gs(w).invulnerable = shield;
  const st = bossOf(w);
  if (st !== null) st.rotOn = rotation;
  return w;
}

/** The boss state, failing loudly when absent. */
export function bs(w: World): BossState {
  const s = bossOf(w);
  if (s === null) throw new Error('no boss state');
  return s;
}

/** Step until the boss is past its entrance (hittable). Returns its id. */
export function enter(w: World, input: InputState = idle()): number {
  for (let i = 0; i < 120 * 10; i++) {
    const id = bossHittable(w);
    if (id > 0) return id;
    stepGame(w, DT, input);
  }
  throw new Error('boss never entered');
}

/** Step n seconds with an input. */
export function run(w: World, secs: number, input: InputState = idle()): void {
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) stepGame(w, DT, input);
}

/** Live entities of a kind. */
export function count(w: World, k: Kind): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === k) n++;
  return n;
}

/** First live entity of a kind, or -1. */
export function first(w: World, k: Kind): number {
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === k) return i;
  return -1;
}

/** Park the ship at (x, y), at rest. */
export function park(w: World, x: number, y: number): void {
  w.x[0] = x;
  w.y[0] = y;
  w.prevX[0] = x;
  w.prevY[0] = y;
  w.vx[0] = 0;
  w.vy[0] = 0;
}

/**
 * A real generated level with its boss brought in at BOSS_LEVEL_AT_SEC (20 s, the entrance before
 * release polish), the way the dev ?boss path brings a boss in early (main.ts arms it at 10 s,
 * armBossFromSpec). Release polish (docs/14 item 7) moved the generated entrance to 240 s, R2 to
 * 200 s and R3 to BOSS_R3_LEVEL_AT_SEC (120 s); tests of a boss mechanic on the real floor and
 * waves use this so they do not play minutes of waves first. The boss row, tier and hpMul are kept.
 */
export function earlyBoss(def: LevelDef): LevelDef {
  if (def.boss === undefined) throw new Error('not a boss level');
  expect(def.boss.atSec).toBe(BOSS_SHORT_LEVEL_AT_SEC); // generator V11 (short levels)
  return { ...def, boss: { ...def.boss, atSec: BOSS_LEVEL_AT_SEC } };
}
