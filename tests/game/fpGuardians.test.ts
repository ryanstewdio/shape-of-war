// Free Play guardians (Ryan, 2026-11-10): with the guardian option on, the first guardian enters at
// 2:00 of play, each next one 120 s after the previous one is freed, and never two alive. The
// single chosen boss option and plain Endless keep the segment cadence.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import { DEFAULT_FREE_PLAY, type FreePlayBosses, type FreePlayConfig } from '../../src/core/freeplayConfig';
import { bossAlive, bossHittable, damageBoss, damageBossPart } from '../../src/game/bosses/core';
import { bossOf } from '../../src/game/bosses/state';
import { FP_GUARDIAN_FIRST_SEC, FP_GUARDIAN_GAP_SEC, guardianNumber, guardianRunActive, guardianSpec, guardiansTimed } from '../../src/game/fpGuardians';
import { createEndlessGame, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind, type World } from '../../src/game/world';
import { generateEndless, generateEndlessSegment } from '../../src/levelgen/generator';
import { freePlayLevel, freePlaySegment } from '../../src/levelgen/freeplay';
import type { FreePlayArena } from '../../src/levelgen/leveldef';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

const SEED = 4242;

function fpGame(bosses: FreePlayBosses, arena: FreePlayArena = 'rect'): World {
  const config: FreePlayConfig = { ...DEFAULT_FREE_PLAY, bosses, density: 'low' };
  const def = freePlayLevel({ arena, barriers: false, seed: SEED, config });
  const w = createEndlessGame(def, (s) => freePlaySegment(def, s), { freePlay: config, vibrate: () => undefined });
  gs(w).invulnerable = true;
  return w;
}

/** Step until the wave clock reaches t (or maxSec of steps pass), checking at most one boss body each step. */
function runToClock(w: World, t: number, maxSec = 400): void {
  const input = idle();
  for (let i = 0; i < maxSec / DT && gs(w).waveClock < t; i++) {
    stepGame(w, DT, input);
    expect(bodies(w)).toBeLessThanOrEqual(1);
  }
}

function runSec(w: World, secs: number): void {
  const input = idle();
  for (let i = 0; i < Math.round(secs / DT); i++) {
    stepGame(w, DT, input);
    expect(bodies(w)).toBeLessThanOrEqual(1);
  }
}

function bodies(w: World): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === Kind.Boss) n++;
  return n;
}

/** Free the guardian through the boss rules: hit the body and every part until it is defeated. */
function free(w: World): void {
  const input = idle();
  for (let i = 0; i < 120 * 60; i++) {
    const bs = bossOf(w);
    if (bs === null) throw new Error('no boss');
    if (bs.status === 'defeated') return;
    const id = bossHittable(w);
    if (id > 0) damageBoss(w, 1e6, w.x[id] ?? 0, w.y[id] ?? 0, true);
    for (let k = 0; k < bs.parts.length; k++) {
      const p = bs.parts[k] ?? -1;
      if (p > 0 && w.alive[p] === 1 && w.kind[p] === Kind.BossPart) damageBossPart(w, p, 1e6, 0, 0);
    }
    if (bossOf(w)?.status === 'defeated') return;
    stepGame(w, DT, input);
  }
  throw new Error('guardian never freed');
}

describe('free play guardian schedule (pure)', () => {
  it('follows the Adventure order, Brood first', () => {
    expect(guardianSpec(1, false)?.id).toBe('brood');
    expect(guardianSpec(2, false)?.id).toBe('warden');
    expect(guardianSpec(0, false)).toBeNull();
    expect(FP_GUARDIAN_FIRST_SEC).toBe(120);
    expect(FP_GUARDIAN_GAP_SEC).toBe(120);
  });

  it('only the guardian option of a Free Play def is timed', () => {
    expect(guardiansTimed(generateEndless(SEED))).toBe(false);
    for (const bosses of ['off', 'warden', 'brood'] as const) {
      const def = freePlayLevel({ arena: 'rect', barriers: false, seed: SEED, config: { ...DEFAULT_FREE_PLAY, bosses } });
      expect(guardiansTimed(def)).toBe(false);
    }
    const def = freePlayLevel({ arena: 'rect', barriers: false, seed: SEED, config: { ...DEFAULT_FREE_PLAY, bosses: 'every3' } });
    expect(guardiansTimed(def)).toBe(true);
  });
});

describe('free play guardians in play', () => {
  it('first guardian enters at 120 s, none before (a run under 2:00 meets none)', () => {
    const w = fpGame('every3');
    expect(guardianRunActive(w)).toBe(true);
    runToClock(w, 119.9);
    expect(bossAlive(w)).toBe(false); // the old segment 3 boss (100 s) is skipped
    expect(bossOf(w)?.status).toBe('waiting');
    runSec(w, 0.2);
    expect(bossAlive(w)).toBe(true);
    expect(bossOf(w)?.spec.id).toBe('brood');
    expect(gs(w).waveClock).toBeGreaterThanOrEqual(120);
    expect(gs(w).waveClock).toBeLessThan(120.1);
  }, 60_000);

  it('the next guardian enters 120 s after a kill, one at a time, a long fight not counting', () => {
    const w = fpGame('every3');
    runToClock(w, 120);
    runSec(w, 0.1);
    expect(bossAlive(w)).toBe(true);
    runSec(w, 40); // a long fight: the wave clock holds, so it does not count toward the gap
    free(w);
    const freedAt = gs(w).waveClock;
    expect(freedAt).toBeLessThan(120.2);
    runToClock(w, freedAt + FP_GUARDIAN_GAP_SEC - 0.1);
    expect(bossAlive(w)).toBe(false);
    expect(guardianNumber(w)).toBe(2);
    runSec(w, 0.2);
    expect(bossAlive(w)).toBe(true);
    expect(bossOf(w)?.spec.id).toBe('warden');
    const at2 = gs(w).waveClock;
    expect(at2 - freedAt).toBeGreaterThanOrEqual(FP_GUARDIAN_GAP_SEC);
    expect(at2 - freedAt).toBeLessThan(FP_GUARDIAN_GAP_SEC + 0.1);
    // While it lives no other guardian arrives, however long it takes.
    runSec(w, 60);
    expect(bodies(w)).toBe(1);
    expect(guardianNumber(w)).toBe(2);
    free(w);
    const freed2 = gs(w).waveClock;
    runToClock(w, freed2 + FP_GUARDIAN_GAP_SEC + 0.1);
    runSec(w, 0.1);
    expect(guardianNumber(w)).toBe(3);
    expect(bossAlive(w)).toBe(true);
    expect(bossOf(w)?.spec.id).toBe(guardianSpec(3, false)?.id);
  }, 120_000);

  it('is deterministic', () => {
    const trace = (): string => {
      const w = fpGame('every3', 'drum');
      runToClock(w, 121);
      free(w);
      runToClock(w, gs(w).waveClock + 121);
      return `${gs(w).score}|${gs(w).waveClock}|${bossOf(w)?.spec.id}|${w.x[0]}|${w.y[0]}`;
    };
    expect(trace()).toBe(trace());
  }, 120_000);

  it('the single chosen boss keeps the segment cadence (first at 100 s)', () => {
    const w = fpGame('warden');
    expect(guardianRunActive(w)).toBe(false);
    runToClock(w, 99.9);
    expect(bossAlive(w)).toBe(false);
    runSec(w, 0.2);
    expect(bossAlive(w)).toBe(true);
    expect(bossOf(w)?.spec.id).toBe('warden');
  }, 60_000);

  it('plain Endless does not use the timed schedule', () => {
    const w = createEndlessGame(generateEndless(SEED), (s) => generateEndlessSegment(SEED, s), { vibrate: () => undefined });
    expect(guardianRunActive(w)).toBe(false);
    expect(bossOf(w)).toBeNull();
  });
});
