// R3: Free Play on the real flow. The same build, snapshot and end check main.ts runs: the run
// starts, keeps running past 60 s with the ship alive, and ends only when the lives run out.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { gameState, setInvulnerable, stepGame } from '../../src/game/game';
import { killShip } from '../../src/game/player';
import { initialFlow, reduceFlow } from '../../src/ui/flow';
import { DEFAULT_FREE_PLAY, FREE_PLAY_ARENAS } from '../../src/ui/freePlay';
import { buildFreePlayRun, freePlayResult, snapshotOf } from '../../src/ui/freePlayRun';
import { armIntro, introActive, tickIntro } from '../../src/ui/intro';
import { fallbackStatus } from '../../src/ui/objective';
import { resultLines } from '../../src/ui/results';
import type { InputState } from '../../src/input/types';

afterEach(() => bus.clear());

const DT = 1 / 120;
const idle: InputState = {
  move: { active: false, x: 0, y: 0 },
  aim: { active: false, x: 0, y: 0 },
  bomb: false,
  superPressed: false,
  pause: false,
};

describe('Free Play run on the real flow', () => {
  for (const arena of FREE_PLAY_ARENAS) {
    it(`${arena}: runs past 60 s with the ship alive, then ends only when the lives run out`, () => {
      let flow = reduceFlow(reduceFlow(initialFlow(), { type: 'openFreePlay' }), { type: 'start', mode: 'freeplay', levelIndex: 1 });
      expect(flow.screen).toBe('playing');
      expect(flow.mode).toBe('freeplay');
      const run = buildFreePlayRun({ ...DEFAULT_FREE_PLAY, arena, barriers: true }, 4242, { difficulty: 'normal', vibrate: () => undefined });
      const overs: number[] = [];
      bus.on('game:over', (p) => overs.push(p.score));
      // The Ready text holds the sim for 1.5 s, then the sim steps.
      let intro = armIntro('freeplay');
      while (introActive(intro)) intro = tickIntro(intro, DT);
      setInvulnerable(run.world, true); // a stand in for a player who stays alive
      const startLives = gameState(run.world).lives;
      expect(startLives).toBeGreaterThan(0);
      for (let i = 0; i < 70 * 120; i++) {
        stepGame(run.world, DT, idle);
        expect(fallbackStatus(run.level.objective, snapshotOf(run.world), run.level.boss !== undefined)).toBe('running');
      }
      expect(run.world.time).toBeGreaterThan(60);
      expect(run.world.ship.active).toBe(true);
      expect(gameState(run.world).outcome).toBe('running');
      expect(overs).toEqual([]);
      // Now lose every life: the sim ends the run and the end check agrees.
      setInvulnerable(run.world, false);
      for (let n = 0; n < 50 && gameState(run.world).outcome === 'running'; n++) {
        for (let i = 0; i < 600 && !run.world.ship.active; i++) stepGame(run.world, DT, idle);
        killShip(run.world);
        stepGame(run.world, DT, idle);
      }
      expect(gameState(run.world).lives).toBe(0);
      expect(gameState(run.world).outcome).toBe('lost');
      expect(fallbackStatus(run.level.objective, snapshotOf(run.world), false)).toBe('failure');
      expect(overs.length).toBe(1);
      const result = freePlayResult({ score: overs[0] ?? 0, difficulty: 'normal', hash: run.hash, space: 'off', timeSec: run.world.time, arena: 'Rectangle' });
      flow = reduceFlow(flow, { type: 'over', result });
      expect(flow.screen).toBe('results');
      const t = resultLines(result);
      expect(t.stars).toBe('');
      expect(t.showPar).toBe(false);
      expect(t.best).toBe('');
      expect(t.score).toMatch(/\d/);
      expect(t.detail).toMatch(/^Time: \d+:\d\d$/);
    });
  }
});
