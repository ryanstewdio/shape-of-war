// foundry-score-target: intro goal, HUD bar label and the sim agree on the scoreInTime target.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { targetsFor } from '../../src/core/stars';
import { createGame } from '../../src/game/game';
import { evaluateObjective } from '../../src/game/objective';
import { generateLevel } from '../../src/levelgen/generator';
import { V10_GEN_CONFIG } from '../../src/levelgen/leveldef';
import { formatCompact } from '../../src/ui/format';
import { introCard } from '../../src/ui/intro';
import { goalMet, objectiveProgress } from '../../src/ui/objective';

afterEach(() => bus.clear());

describe('one target on every screen', () => {
  it('Normal level 4 of the tester seed style reads near 240K (generator V10 par)', () => {
    const lv = generateLevel(2471588027, 4, V10_GEN_CONFIG);
    const card = introCard(4, lv, 'normal');
    expect(card.goal).toBe(`Score ${formatCompact(241_500)} in 3:35`);
  });

  for (const d of ['easy', 'insane'] as const) {
    it(`${d}: intro goal, HUD label and sim check share the target`, () => {
      const lv = generateLevel(2471588027, 4, V10_GEN_CONFIG);
      const w = createGame(lv, { difficulty: d });
      const o = w.level.objective;
      if (o.kind !== 'scoreInTime') throw new Error('not a score level');
      const shown = formatCompact(o.target);
      const card = introCard(4, lv, d);
      expect(card.goal).toBe(`Score ${shown} in 3:35`);
      expect(card.victory).toContain(`${shown} points`);
      const hud = objectiveProgress(o, { elapsedSec: 10, score: 0, kills: 0, lives: 3 }, false, targetsFor(lv, d).stars);
      expect(hud.label.startsWith(`Score 0 / ${shown}`)).toBe(true);
      const snap = { elapsedSec: 215, score: o.target, kills: 0, lives: 3 };
      expect(goalMet(o, snap)).toBe(true);
      expect(goalMet(o, { ...snap, score: o.target - 1 })).toBe(false);
      const sim = { objective: o, mode: 'adventure' as const, kills: 0, lives: 3, clock: 215 };
      expect(evaluateObjective({ ...sim, score: o.target })).toBe('won');
      expect(evaluateObjective({ ...sim, score: o.target - 1 })).toBe('lost');
      expect(o.target).toBeLessThanOrEqual(targetsFor(lv, d).stars[0]);
    });
  }
});
