// R6 par calibration (brief foundry-r6-par). A scripted strong player plays the real sim
// (createGame with GameOptions.difficulty) through the real input: it aims at the nearest target
// (the boss first when it can be hit) and steers to the nearest geom, else away from the nearest
// enemy. The ship is shielded, so the run measures how much score each difficulty's waves offer,
// not luck with deaths. Scoring is main.ts's port (Ledger's scoring.ts), as on the device.
//
// The full sweep (levels 1 to 40, two seeds, four difficulties) takes minutes, so it runs only with
// PAR_CALIBRATE=1 and prints the ratios parScale was set from. The default run keeps a cheap check.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DIFFICULTY } from '../../src/core/difficulty';
import type { Difficulty } from '../../src/core/difficulty';
import { isBossTarget } from '../../src/game/bosses/core';
import { isTargetable } from '../../src/game/combat';
import { createGame, stepGame } from '../../src/game/game';
import { awardKill, collectGeom, scoreOf, shipDied } from '../../src/game/scoring';
import { gs, type ScoringPort } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import type { InputState } from '../../src/input/types';
import { generateLevel } from '../../src/levelgen/generator';
import type { LevelDef } from '../../src/levelgen/leveldef';
import { idle } from './helpers';

afterEach(() => bus.clear());

/** The port main.ts passes to createGame. */
const PORT: ScoringPort = {
  awardKill,
  collectGeom: (w: World): void => {
    collectGeom(w);
  },
  resetMultiplier: shipDied,
  multiplier: (w: World): number => scoreOf(w).multiplier,
};

/** Bot step: 1/60 s, the device frame. */
const BOT_DT = 1 / 60;
/** Hard stop for a level that never ends (seconds of sim time). */
const MAX_SEC = 600;
/** How the bot plays: geoms nearer than geomReach pull the ship, else it keeps keepAway from the nearest enemy. */
interface BotStyle {
  geomReach: number;
  keepAway: number;
  shielded: boolean;
}

const STRONG: BotStyle = { geomReach: 600, keepAway: 220, shielded: true };

function steer(w: World, input: InputState, st: BotStyle): void {
  const sx = w.x[0] ?? 0;
  const sy = w.y[0] ?? 0;
  let target = -1;
  let targetD = Infinity;
  let enemy = -1;
  let enemyD = Infinity;
  let geom = -1;
  let geomD = Infinity;
  for (let i = 1; i < w.cap; i++) {
    if (w.alive[i] !== 1) continue;
    const k = w.kind[i] ?? 0;
    const d = Math.hypot((w.x[i] ?? 0) - sx, (w.y[i] ?? 0) - sy);
    if (k === Kind.Geom) {
      if (d < geomD) {
        geomD = d;
        geom = i;
      }
      continue;
    }
    const boss = k === Kind.Boss || k === Kind.BossPart;
    const hittable = boss ? isBossTarget(w, i) : isTargetable(w, i);
    if (!hittable) continue;
    if (d < enemyD) {
      enemyD = d;
      enemy = i;
    }
    const score = d - (boss ? 1e5 : 0);
    if (score < targetD) {
      targetD = score;
      target = i;
    }
  }
  input.aim.active = target > 0;
  input.aim.x = target > 0 ? (w.x[target] ?? 0) - sx : 0;
  input.aim.y = target > 0 ? (w.y[target] ?? 0) - sy : 0;
  const unit = (dx: number, dy: number): void => {
    const m = Math.hypot(dx, dy);
    input.move.active = m > 1e-6;
    input.move.x = m > 1e-6 ? dx / m : 0;
    input.move.y = m > 1e-6 ? dy / m : 0;
  };
  if (geom > 0 && geomD < st.geomReach) unit((w.x[geom] ?? 0) - sx, (w.y[geom] ?? 0) - sy);
  else if (enemy > 0 && enemyD < st.keepAway) unit(sx - (w.x[enemy] ?? 0), sy - (w.y[enemy] ?? 0));
  else unit(-sx, -sy);
}

interface BotRun {
  score: number;
  sec: number;
  outcome: string;
  deaths: number;
}

/** The scripted strong run of def at a difficulty: the Ledger score when the level ends. */
function playLevel(def: LevelDef, difficulty: Difficulty, st: BotStyle = STRONG): BotRun {
  const w = createGame(def, { scoring: PORT, difficulty, vibrate: () => undefined });
  const g = gs(w);
  g.invulnerable = st.shielded;
  const input = idle();
  const steps = Math.round(MAX_SEC / BOT_DT);
  for (let i = 0; i < steps && g.outcome === 'running'; i++) {
    steer(w, input, st);
    stepGame(w, BOT_DT, input);
  }
  const r = { score: scoreOf(w).score, sec: Math.round(w.time), outcome: g.outcome, deaths: g.deaths };
  bus.clear();
  return r;
}

const CALIBRATE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PAR_CALIBRATE === '1';
const OTHERS = ['easy', 'hard', 'insane'] as const;
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('R6 par per difficulty', () => {
  it('Normal stays exactly 1; the others are on the 0.05 grid and ordered', () => {
    expect(DIFFICULTY.normal.parScale).toBe(1);
    for (const d of OTHERS) expect(Math.round(DIFFICULTY[d].parScale * 20) / 20).toBe(DIFFICULTY[d].parScale);
    expect(DIFFICULTY.easy.parScale).toBeLessThan(1);
    expect(DIFFICULTY.hard.parScale).toBeGreaterThan(1);
    expect(DIFFICULTY.insane.parScale).toBeGreaterThan(DIFFICULTY.hard.parScale);
  });

  it('the scripted run is deterministic and Easy level 1 sits near the Easy par scale', () => {
    const def = generateLevel(1, 1);
    const n = playLevel(def, 'normal');
    expect(playLevel(def, 'normal')).toEqual(n);
    const e = playLevel(def, 'easy');
    expect(n.outcome).toBe('won');
    expect(Math.abs(e.score / n.score - DIFFICULTY.easy.parScale)).toBeLessThan(0.1);
  });

  // PAR_CALIBRATE=1 npx vitest run tests/game/parCalibration.test.ts --silent=false
  it.runIf(CALIBRATE)('full sweep: levels 1 to 40 of seeds 1 and 1000, mean ratio to Normal rounds to parScale', () => {
    const ratios: Record<string, number[]> = { easy: [], hard: [], insane: [] };
    const band1: number[] = [];
    for (const seed of [1, 1000]) {
      for (let lv = 1; lv <= 40; lv++) {
        const def = generateLevel(seed, lv);
        const normal = playLevel(def, 'normal').score;
        if (lv <= 4) band1.push(normal / def.par);
        for (const d of OTHERS) ratios[d]?.push(playLevel(def, d).score / normal);
      }
    }
    for (const d of OTHERS) {
      const m = mean(ratios[d] ?? []);
      console.log(`${d}: mean ratio to Normal ${m.toFixed(3)}, parScale ${DIFFICULTY[d].parScale}`);
      expect(Math.round(m * 20) / 20).toBe(DIFFICULTY[d].parScale);
    }
    console.log(`levels 1 to 4 Normal score / par: ${band1.map((r) => r.toFixed(2)).join(' ')}`);
  }, 3_600_000);
});
