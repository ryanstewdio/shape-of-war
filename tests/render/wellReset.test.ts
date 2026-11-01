// GW4: a level start, restart or retry leaves no well visuals.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arriveEvent, createArriveState, createEmergeState, emergeEvent } from '../../src/render/wellArrive';
import { createNovaSnakeState, novaSnakeMark } from '../../src/render/novaSnake';
import { createNovaState, novaEvent, novaSlotFor } from '../../src/render/wellNova';
import { resetWellVisuals, wellVisualsLive } from '../../src/render/wellReset';

describe('well reset', () => {
  it('a reset clears nova slots, arrivals, emergences and nova snakes', () => {
    const s = { nova: createNovaState(), arrive: createArriveState(), emerge: createEmergeState(), snakes: createNovaSnakeState() };
    expect(wellVisualsLive(s)).toBe(false);
    novaEvent(s.nova, 5, 100, 100);
    expect(novaSlotFor(s.nova, 5, 100, 100, 20)).toBeGreaterThanOrEqual(0);
    arriveEvent(s.arrive, 2, 0, 0, 1);
    emergeEvent(s.emerge, 10, 10);
    novaSnakeMark(s.snakes, 9, 1);
    expect(wellVisualsLive(s)).toBe(true);
    resetWellVisuals(s);
    expect(wellVisualsLive(s)).toBe(false);
  });

  it('after a reset a new well at the same entity index is not taken for the old nova', () => {
    const s = { nova: createNovaState(), arrive: createArriveState(), emerge: createEmergeState(), snakes: createNovaSnakeState() };
    novaEvent(s.nova, 5, 100, 100);
    novaSlotFor(s.nova, 5, 100, 100, 20);
    resetWellVisuals(s);
    // The retry world reuses index 5 for a calm well: no nova slot may match it.
    expect(novaSlotFor(s.nova, 5, 100, 100, 20)).toBe(-1);
  });

  it('the renderer resets every well visual and hides the shader quads on a new level', () => {
    const src = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const i = src.indexOf('function clearBossFx(');
    const body = src.slice(i, src.indexOf('\n  }\n', i));
    expect(body).toMatch(/resetWellVisuals\(wellVisuals\)/);
    expect(body).toMatch(/fluid\.hideAll\(\)/);
    const a = src.indexOf('function setArena(');
    expect(src.slice(a, src.indexOf('\n  }\n', a))).toMatch(/clearBossFx\(\)/);
    expect(src).toMatch(/const wellVisuals = \{ nova, arrive, emerge, snakes: novaSnakes \}/);
  });
});
