// Release fix (docs/14 item 6): Normal difficulty must leave the sim as it was before release polish,
// except where docs/14 changes it on purpose (item 7 level length, boss timing and fight length,
// item 8 open drum drift). Three proofs: the Normal table multiplies by exactly 1 and adds 0, the
// pure scaling helpers are the identity there, and real levels from V4_GEN_CONFIG (long levels off,
// the generator before release polish) play 30 s with kills to the hashes the pre release build
// (babadbf) gave for the same script. The one open drum row differs by drift alone.
import { afterEach, describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY } from '../../src/core/difficulty';
import { bus } from '../../src/core/events';
import { applyBossScaling } from '../../src/game/bosses/core';
import { bossOf } from '../../src/game/bosses/state';
import { maxHpFor } from '../../src/game/bosses/table';
import { difficultyOf, scaledCount, scaledHp, startingLives } from '../../src/game/difficulty';
import { isOpenDrum } from '../../src/game/drift';
import { createGame, stepGame } from '../../src/game/game';
import { enemySpeedScale, gs } from '../../src/game/state';
import type { World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { generateLevel, levelHash } from '../../src/levelgen/generator';
import { V4_GEN_CONFIG } from '../../src/levelgen/leveldef';
import { stateHash } from '../game/bossGw2Helpers';
import { DT } from '../game/helpers';

afterEach(() => bus.clear());

/** A ship that weaves and sweeps its aim, so the run has kills, deaths of enemies and pickups. */
function weave(i: number, o: InputState): InputState {
  const t = i * DT;
  o.move.active = true;
  o.move.x = Math.cos(t * 0.7);
  o.move.y = Math.sin(t * 0.9);
  o.aim.active = true;
  o.aim.x = Math.cos(t * 2.3);
  o.aim.y = Math.sin(t * 2.3);
  o.bomb = false;
  o.superPressed = false;
  o.pause = false;
  return o;
}

/** 30 s of weave on def (shielded), hashing the world, score, kills and lives every second. */
function play(w: World): { hash: number; kills: number } {
  gs(w).invulnerable = true;
  const o: InputState = { move: { active: false, x: 0, y: 0 }, aim: { active: false, x: 0, y: 0 }, bomb: false, superPressed: false, pause: false };
  let h = 0;
  for (let i = 0; i < 120 * 30; i++) {
    stepGame(w, DT, weave(i, o));
    if (i % 120 === 0) h = (h * 31 + stateHash(w) + gs(w).score + gs(w).kills * 7 + gs(w).lives) % 2147483647;
  }
  return { hash: h, kills: gs(w).kills };
}

/** [seed, level, levelHash, kills, hash] from the same script on babadbf (generateLevel default config). */
const PRE_RELEASE: readonly (readonly [number, number, string, number, number])[] = [
  [42, 1, 'CD2B515B', 21, 35398125],
  [42, 3, 'E811153A', 21, 494673584],
  [42, 9, '5BD14124', 36, 348137784],
  [42, 12, '8FCFD3FB', 25, 427133692], // a drum with obstacles: no drift
  [42, 13, '18B193B3', 31, 648999110],
  [42, 22, 'AED12E1E', 37, 374579583],
  [42, 33, '9D5E2F53', 61, 1981848924],
  [7, 1, 'E09A585A', 21, 1293153400],
  [7, 3, '6DB30B17', 21, 2117718283],
  [7, 9, 'E99ECD9F', 35, 1201523381],
  [7, 12, 'B619572B', 32, 761170020],
  [7, 13, 'C2A58F66', 34, 1830213246],
  [7, 22, '5BC66922', 35, 1647824986],
];

/** Seed 7 level 33 is an open drum: pre release hash, and the drift on hash (docs/14 item 8). */
const OPEN_DRUM = { seed: 7, level: 33, levelHash: '0BDFEF03', pre: 1506431169, drift: 1569863015 } /* R3: drift is a current (forge-r3-turbo): the ship takes the full drift, player bullets half, enemies a quarter, so the drift on hash moves; drift off still equals pre release */ as const;

describe('Normal difficulty is the pre release sim', () => {
  it('the Normal table multiplies by exactly 1 and adds exactly 0, on every field', () => {
    const n = DIFFICULTY.normal;
    expect(Object.keys(n).sort()).toEqual(['addScale', 'bossScale', 'driftScale', 'enemyHp', 'enemySpeed', 'extraLives', 'spawnRate']);
    expect(n.addScale).toBe(1);
    expect(n.driftScale).toBe(1);
    expect(n.enemySpeed).toBe(1);
    expect(n.enemyHp).toBe(1);
    expect(n.spawnRate).toBe(1);
    expect(n.bossScale).toBe(1);
    expect(n.extraLives).toBe(0);
    expect(DIFFICULTIES).toContain('normal');
  });

  it('every difficulty row carries the same fields as Normal, Insane included', () => {
    const fields = Object.keys(DIFFICULTY.normal).sort();
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard', 'insane']);
    for (const d of DIFFICULTIES) expect(Object.keys(DIFFICULTY[d]).sort(), d).toEqual(fields);
  });

  it('the scaling helpers are the identity at the Normal values', () => {
    const n = DIFFICULTY.normal;
    for (let k = 0; k < 200; k++) {
      expect(scaledCount(k, n.spawnRate)).toBe(k);
      expect(startingLives(k + 1, n.extraLives)).toBe(k + 1);
    }
    for (const hp of [1, 2, 3, 5, 7, 12, 40, 255, 1000]) expect(scaledHp(hp, n.enemyHp)).toBe(hp);
  });

  it('a world with no option is Normal, and its enemy speed and boss scaling are unscaled', () => {
    const def = generateLevel(42, 20, V4_GEN_CONFIG);
    const w = createGame(def, { vibrate: () => undefined });
    expect(w.difficulty).toBe('normal');
    expect(difficultyOf(w)).toBe(DIFFICULTY.normal);
    const g = gs(w);
    expect(enemySpeedScale(w)).toBe(g.speedScale * g.arenaFactor);
    expect(g.lives).toBe(def.lives);
    const bs = bossOf(w);
    if (bs === null) throw new Error('level 20 has a boss');
    const maxHp = applyBossScaling(w, bs, difficultyOf(w).bossScale);
    expect(bs.cadence).toBe(bs.levelScale); // docs/14 item 7 level scale only, times 1
    expect(maxHp).toBe(maxHpFor(bs.row, bs.spec.hpMul));
  });

  for (const [seed, level, lh, kills, hash] of PRE_RELEASE) {
    it(`seed ${seed} level ${level}: 30 s of play equals the pre release build (Normal, V4 config)`, () => {
      const def = generateLevel(seed, level, V4_GEN_CONFIG);
      expect(levelHash(def)).toBe(lh);
      expect(def.boss).toBeUndefined();
      expect(isOpenDrum(def)).toBe(false);
      const a = play(createGame(def, { vibrate: () => undefined }));
      expect(a.kills).toBe(kills);
      expect(a.hash).toBe(hash);
      // An explicit Normal is the same run as no option.
      expect(play(createGame(def, { vibrate: () => undefined, difficulty: 'normal' })).hash).toBe(hash);
    });
  }

  it('the open drum differs only by drift: with drift off it equals the pre release build', () => {
    const def = generateLevel(OPEN_DRUM.seed, OPEN_DRUM.level, V4_GEN_CONFIG);
    expect(levelHash(def)).toBe(OPEN_DRUM.levelHash);
    expect(isOpenDrum(def)).toBe(true);
    expect(play(createGame(def, { vibrate: () => undefined })).hash).toBe(OPEN_DRUM.drift);
    const w = createGame(def, { vibrate: () => undefined });
    w.drift.active = false;
    expect(play(w).hash).toBe(OPEN_DRUM.pre);
  });
});
