// GW4 Sower roam in real play (Ryan: "Sowers still only move on the edge"). sowerRoam.test.ts passes
// on a hand placed Sower, but in GW3 the first dive came 20 s after spawn and most Sowers were shot
// long before that. These tests build real generated levels with Sowers (V2 generator config, band
// 4), run the real step loop with an idle ship that never fires (invulnerable so the run is not
// reset by a death, and a collect drone so nothing shoots) and check that every Sower reaches
// within CENTRE_REACH of the arena centre within 20 s of spawning, then returns to the edge.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import * as sower from '../../src/game/enemies/sower';
import { createGame, setInvulnerable, stepGame } from '../../src/game/game';
import { gs } from '../../src/game/state';
import { Kind } from '../../src/game/world';
import { generateLevel } from '../../src/levelgen/generator';
import { V2_GEN_CONFIG, type LevelDef } from '../../src/levelgen/leveldef';
import { DT, idle } from './helpers';

afterEach(() => bus.clear());

/** The first n generated levels (V2 config) whose roster has a Sower. */
function sowerLevels(n: number): LevelDef[] {
  const out: LevelDef[] = [];
  for (let seed = 11; out.length < n && seed < 2000; seed += 37) {
    for (let level = 31; level <= 60 && out.length < n; level++) {
      const def = generateLevel(seed, level, V2_GEN_CONFIG);
      if (def.roster.some((r) => r.kind === 'sower')) out.push(def);
    }
  }
  return out;
}

const RUN_SEC = 60;
const REACH_WITHIN = 20;
/** Centre to edge at the slowest Sower speed with margin (s). */
const RETURN_SEC = 15;

interface Track {
  born: number;
  reached: number;
  back: number;
  dead: number;
  wasOut: boolean;
}

function runLevel(def: LevelDef): Track[] {
  const w = createGame({ ...def, drone: 'collect' }, { vibrate: () => undefined });
  setInvulnerable(w, true);
  const input = idle();
  const live = new Map<number, Track>();
  const done: Track[] = [];
  for (let i = 0; i < Math.round(RUN_SEC / DT) && gs(w).outcome === 'running'; i++) {
    stepGame(w, DT, input);
    for (const [id, tr] of live) {
      if (w.alive[id] !== 1 || w.kind[id] !== Kind.Sower) {
        tr.dead = w.time;
        done.push(tr);
        live.delete(id);
      }
    }
    for (let id = 1; id < w.cap; id++) {
      if (w.alive[id] !== 1 || w.kind[id] !== Kind.Sower) continue;
      let tr = live.get(id);
      if (tr === undefined) {
        tr = { born: w.time, reached: -1, back: -1, dead: -1, wasOut: false };
        live.set(id, tr);
      }
      if (sower.spawnIndex(w, id) < 0) continue; // still telegraphing
      const ph = sower.roamPhase(w, id);
      if (tr.reached < 0 && Math.hypot(w.x[id] ?? 0, w.y[id] ?? 0) <= sower.CENTRE_REACH) tr.reached = w.time;
      if (tr.reached >= 0 && ph === sower.ROAM_OUT) tr.wasOut = true;
      if (tr.wasOut && tr.back < 0 && ph === sower.ROAM_EDGE) tr.back = w.time;
    }
  }
  return [...done, ...live.values()];
}

describe('sower roam in real generated levels (GW4)', () => {
  const levels = sowerLevels(12);

  it('finds real levels with Sowers in several arena shapes', () => {
    expect(levels.length).toBe(12);
    expect(new Set(levels.map((d) => d.arena.shape)).size).toBeGreaterThanOrEqual(3);
    expect(levels.some((d) => d.arena.shape === 'rectObstacles')).toBe(true);
  });

  it.each(levels.map((d, i) => [i, d.seed, d.arena.shape, d] as const))('level %i (seed %i, %s): every Sower dives to the centre within 20 s and returns', (_i, _seed, _shape, def) => {
    const tracks = runLevel(def);
    // Judge every Sower that lives long enough to be judged: in real play wells eat Sowers (and the
    // run ends at RUN_SEC), and a Sower that is gone cannot dive. A miss is a Sower alive 20 s after
    // spawning that never came within CENTRE_REACH, or one alive RETURN_SEC after its centre visit
    // that never got back to the edge.
    let judged = 0;
    for (const t of tracks) {
      const end = t.dead < 0 ? RUN_SEC : t.dead;
      const msg = JSON.stringify(t);
      if (t.reached < 0) {
        expect(end - t.born, msg).toBeLessThan(REACH_WITHIN);
        continue;
      }
      judged++;
      expect(t.reached - t.born, msg).toBeLessThanOrEqual(REACH_WITHIN);
      if (t.back < 0) expect(end - t.reached, msg).toBeLessThan(RETURN_SEC);
      else expect(t.back, msg).toBeGreaterThan(t.reached);
    }
    expect(judged).toBeGreaterThan(0);
  });
});
