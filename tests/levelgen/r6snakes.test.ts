// R6 Free Play snakes (brief foundry-r6-par). Gate R5 (Ryan): with wells off, still no snakes on
// device although the R5 test passed. The real path did spawn them: one snake per 30 s segment from
// 0:30, in a corner, which the attack drone killed within about 5 s, so none was seen. R6 raises the
// floor to 3 per segment from the first. These tests use the exact choice the setup screen builds
// (DEFAULT_FREE_PLAY in src/ui/freePlay.ts, as saved by saveFreePlaySetup) through buildFreePlayRun,
// with the default wells and with wells off, and step the real sim.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY_SETUP, parseFreePlayConfig } from '../../src/core/settings';
import { stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { freePlaySegment } from '../../src/levelgen/freeplay';
import { levelHash } from '../../src/levelgen/generator';
import type { EndlessDef, EndlessSegmentDef } from '../../src/levelgen/leveldef';
import { FREE_PLAY_SNAKES_PER_SEGMENT, FREE_PLAY_SNAKE_FROM_SEGMENT, validateFreePlay, validateFreePlaySegment } from '../../src/levelgen/validate';
import { DEFAULT_FREE_PLAY, type FreePlayChoice } from '../../src/ui/freePlay';
import { buildFreePlayRun } from '../../src/ui/freePlayRun';
import { idle } from '../game/helpers';

afterEach(() => bus.clear());

const SEEDS = [1, 12345, 0xdeadbeef] as const;
const wellsOff: FreePlayChoice = { ...DEFAULT_FREE_PLAY, config: { ...DEFAULT_FREE_PLAY.config, wells: 'off' } };
/** The setup screen's default, and the same after a save and load round trip (main.ts reads it back). */
const CHOICES: readonly [string, FreePlayChoice][] = [
  ['default', DEFAULT_FREE_PLAY],
  ['wells off', wellsOff],
  ['wells off, loaded', { ...wellsOff, config: parseFreePlayConfig(JSON.parse(JSON.stringify(wellsOff.config))) }],
];
const snakes = (seg: EndlessSegmentDef): number => seg.waves.waves.reduce((n, w) => n + w.entries.filter((e) => e.kind === 'snake').length, 0);

/** Live snake heads. */
function heads(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.SnakeHead) n++;
  return n;
}

describe('R6 snakes on the setup screen path', () => {
  it('the setup default is the core default with every enemy allowed (empty list)', () => {
    expect(DEFAULT_FREE_PLAY.config).toEqual(DEFAULT_FREE_PLAY_SETUP.config);
    expect(DEFAULT_FREE_PLAY.config.enemies).toEqual([]);
    expect(FREE_PLAY_SNAKES_PER_SEGMENT).toBe(3);
    expect(FREE_PLAY_SNAKE_FROM_SEGMENT).toBe(0);
  });

  it('every segment from the first holds at least 3 snakes and validates, wells on or off', () => {
    for (const [name, choice] of CHOICES) {
      for (const seed of SEEDS) {
        const run = buildFreePlayRun(choice, seed);
        expect(validateFreePlay(run.def).errors).toEqual([]);
        if (choice.config.wells === 'off') expect(run.def.hazards.wells).toEqual([]);
        for (let s = 0; s < 22; s++) {
          const seg = freePlaySegment(run.def, s);
          expect(validateFreePlaySegment(seg, run.def, { enableBosses: true }).errors).toEqual([]);
          expect(snakes(seg), `${name} seed ${seed} segment ${s}`).toBeGreaterThanOrEqual(FREE_PLAY_SNAKES_PER_SEGMENT);
        }
        bus.clear();
      }
    }
  });

  it('the real sim shows a snake in the first 15 s and on screen most of the first 2 minutes, wells off', () => {
    for (const seed of SEEDS) {
      const run = buildFreePlayRun(wellsOff, seed);
      const w = run.world;
      gs(w).invulnerable = true;
      const input = idle();
      let first = -1;
      let withSnake = 0;
      const steps = 120 * 60;
      for (let i = 0; i < steps; i++) {
        stepGame(w, 1 / 60, input);
        const n = heads(w);
        if (n > 0 && first < 0) first = w.time;
        if (n > 0) withSnake++;
      }
      expect(first, `seed ${seed}`).toBeGreaterThan(0);
      expect(first, `seed ${seed}`).toBeLessThan(15);
      expect(withSnake / steps, `seed ${seed}`).toBeGreaterThan(0.4);
      bus.clear();
    }
  });

  it('is deterministic', () => {
    const a = buildFreePlayRun(wellsOff, 77);
    bus.clear();
    const b = buildFreePlayRun(wellsOff, 77);
    expect(a.hash).toBe(b.hash);
    for (const s of [0, 3, 9]) expect(levelHash(freePlaySegment(a.def, s) as unknown as EndlessDef)).toBe(levelHash(freePlaySegment(b.def, s) as unknown as EndlessDef));
  });
});
