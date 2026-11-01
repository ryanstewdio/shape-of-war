// GW3 Sower roam (Ryan): orbit the edge for a hashed 12 to 18 s, steer to within 150 u of the arena
// centre, return to the edge and orbit again; one loop takes at least 20 s; it keeps sowing.
import { afterEach, describe, expect, it } from 'vitest';
import { bus } from '../../src/core/events';
import * as mine from '../../src/game/enemies/mine';
import * as sower from '../../src/game/enemies/sower';
import { kill, Kind, type World } from '../../src/game/world';
import { DT, makeGame, put, quietLevel } from './helpers';

afterEach(() => bus.clear());

function countKind(w: World, k: Kind): number {
  let n = 0;
  for (let i = 1; i < w.cap; i++) if (w.alive[i] === 1 && w.kind[i] === k) n++;
  return n;
}

interface Trace {
  /** Time (s) of each phase change, with the phase entered. */
  changes: { t: number; phase: number }[];
  /** Closest approach to the centre on each inward leg. */
  minDist: number[];
  /** Largest per step turn (rad). */
  maxTurn: number;
}

function trace(w: World, id: number, seconds: number): Trace {
  const changes: { t: number; phase: number }[] = [];
  const minDist: number[] = [];
  let phase = sower.roamPhase(w, id);
  let rot = w.rot[id] ?? 0;
  let maxTurn = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    sower.step(w, id, DT);
    const ph = sower.roamPhase(w, id);
    const r = w.rot[id] ?? 0;
    if (ph !== sower.ROAM_EDGE && phase === ph) maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(r - rot), Math.cos(r - rot))));
    rot = r;
    if (ph !== phase) {
      changes.push({ t: (i + 1) * DT, phase: ph });
      if (ph === sower.ROAM_IN) minDist.push(Infinity);
      phase = ph;
    }
    if (ph === sower.ROAM_IN || ph === sower.ROAM_OUT) {
      const d = Math.hypot(w.x[id] ?? 0, w.y[id] ?? 0);
      const k = minDist.length - 1;
      if (k >= 0) minDist[k] = Math.min(minDist[k] ?? Infinity, d);
    }
  }
  return { changes, minDist, maxTurn };
}

describe('sower roam (pure)', () => {
  it('edge time is 12 to 18 s, hashed from seed, spawn index and loop', () => {
    const seen = new Set<number>();
    for (let idx = 0; idx < 40; idx++) {
      for (let loop = 0; loop < 4; loop++) {
        const t = sower.edgeSeconds(7, idx, loop);
        expect(t).toBeGreaterThanOrEqual(sower.ROAM_MIN_SEC);
        expect(t).toBeLessThan(sower.ROAM_MIN_SEC + sower.ROAM_SPAN_SEC);
        expect(sower.edgeSeconds(7, idx, loop)).toBe(t);
        seen.add(Math.floor(t));
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5); // spread over the range
    expect(sower.edgeSeconds(7, 3, 0)).not.toBe(sower.edgeSeconds(8, 3, 0));
  });

  it('phase rules', () => {
    const { ROAM_EDGE: E, ROAM_IN: I, ROAM_OUT: O, nextRoamPhase: next } = sower;
    expect(next(E, 15, 25, 14, true, 400)).toBe(I);
    expect(next(E, 13, 25, 14, true, 400)).toBe(E); // edge time not up
    expect(next(E, 15, 19, 14, true, 400)).toBe(E); // loop shorter than 20 s
    expect(next(E, 15, 25, 14, false, 400)).toBe(E); // leaves only from the wall
    expect(next(I, 1, 1, 14, false, 151)).toBe(I);
    expect(next(I, 1, 1, 14, false, 150)).toBe(O);
    expect(next(I, sower.INWARD_MAX_SEC, 1, 14, false, 300)).toBe(O); // blocked: give up
    expect(next(O, 1, 1, 14, false, 300)).toBe(O);
    expect(next(O, 1, 1, 14, true, 300)).toBe(E);
    expect(sower.LOOP_MIN_SEC).toBe(20);
    expect(sower.CENTRE_REACH).toBe(150);
  });
});

describe('sower roam in play', () => {
  it('orbits for its hashed edge time, reaches the centre, returns to the edge and loops (rect)', () => {
    const { w } = makeGame();
    const id = put(w, sower.def, 0, -300);
    const tr = trace(w, id, 70);
    const idx = sower.spawnIndex(w, id);
    expect(idx).toBe(0);
    const ins = tr.changes.filter((c) => c.phase === sower.ROAM_IN);
    expect(ins.length).toBeGreaterThanOrEqual(2);
    // The first turn: no earlier than the edge time (and 20 s since spawn).
    const first = ins[0]?.t ?? 0;
    expect(first).toBeGreaterThanOrEqual(Math.max(sower.edgeSeconds(w.level.seed, idx, 0), sower.LOOP_MIN_SEC) - 1e-6);
    expect(first).toBeLessThan(sower.LOOP_MIN_SEC + 0.1); // 3 s to the wall plus 12 to 18 s, capped up to 20 s
    // Each inward leg gets within 150 u of the centre.
    for (const d of tr.minDist) if (Number.isFinite(d)) expect(d).toBeLessThanOrEqual(sower.CENTRE_REACH + 1e-3);
    // Out then back to the edge.
    const seq = tr.changes.map((c) => c.phase);
    expect(seq.slice(0, 3)).toEqual([sower.ROAM_IN, sower.ROAM_OUT, sower.ROAM_EDGE]);
    // On the edge again: hugging a wall.
    const back = tr.changes[2]?.t ?? 0;
    expect(back).toBeGreaterThan(first);
    // Loop length: inward turn to inward turn at least 20 s.
    for (let k = 1; k < ins.length; k++) expect((ins[k]?.t ?? 0) - (ins[k - 1]?.t ?? 0)).toBeGreaterThanOrEqual(sower.LOOP_MIN_SEC - 1e-6);
    // Smooth steering: never more than the turn rate per step.
    expect(tr.maxTurn).toBeLessThanOrEqual(sower.ROAM_TURN * DT + 1e-5);
  });

  it('returns to and hugs the wall after the centre visit', () => {
    const { w } = makeGame();
    const id = put(w, sower.def, 0, -300);
    let sawOut = false;
    for (let i = 0; i < 120 * 60; i++) {
      sower.step(w, id, DT);
      if (sower.roamPhase(w, id) === sower.ROAM_OUT) sawOut = true;
      if (sawOut && sower.roamPhase(w, id) === sower.ROAM_EDGE) break;
    }
    expect(sawOut).toBe(true);
    expect(sower.roamPhase(w, id)).toBe(sower.ROAM_EDGE);
    const x = Math.abs(w.x[id] ?? 0);
    const y = Math.abs(w.y[id] ?? 0);
    const gap = Math.min(700 - 16 - x, 450 - 16 - y);
    expect(gap).toBeLessThanOrEqual(sower.HUG_MARGIN + 1);
    // And orbits along it again for a while without leaving.
    for (let i = 0; i < 120 * 5; i++) {
      sower.step(w, id, DT);
      expect(sower.roamPhase(w, id)).toBe(sower.ROAM_EDGE);
    }
  });

  it('works in a circle arena', () => {
    const { w } = makeGame({ arena: { shape: 'circle', width: 1000, height: 1000, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } } });
    const id = put(w, sower.def, 0, -300);
    const tr = trace(w, id, 60);
    const seq = tr.changes.map((c) => c.phase);
    expect(seq.slice(0, 3)).toEqual([sower.ROAM_IN, sower.ROAM_OUT, sower.ROAM_EDGE]);
    expect(tr.minDist[0]).toBeLessThanOrEqual(sower.CENTRE_REACH + 1e-3);
  });

  it('keeps sowing on the way in and out', () => {
    const { w } = makeGame();
    const id = put(w, sower.def, 0, -300);
    let inside = 0;
    for (let i = 0; i < 120 * 40; i++) {
      // Clear the mines so the per Sower cap never blocks a drop.
      for (let m = 1; m < w.cap; m++) if (w.alive[m] === 1 && w.kind[m] === Kind.Mine) kill(w, m);
      sower.step(w, id, DT);
      if (countKind(w, Kind.Mine) > 0 && sower.roamPhase(w, id) !== sower.ROAM_EDGE) inside++;
    }
    expect(inside).toBeGreaterThanOrEqual(2); // at 70 u/s each leg lasts several seconds: drops every 3 s
    expect(mine.CAP_PER_SOWER).toBe(6);
  });

  it('spawn indices count Sowers per world and the roam is deterministic', () => {
    const run = (): string => {
      const w = makeGame(quietLevel()).w;
      const ids = [put(w, sower.def, -400, 0), put(w, sower.def, 400, 0), put(w, sower.def, 0, 300)];
      const out: number[] = [];
      for (let i = 0; i < 120 * 50; i++) {
        for (const id of ids) sower.step(w, id, DT);
        if (i % 240 === 0) for (const id of ids) out.push(w.x[id] ?? 0, w.y[id] ?? 0, sower.roamPhase(w, id));
      }
      expect(ids.map((id) => sower.spawnIndex(w, id))).toEqual([0, 1, 2]);
      bus.clear();
      return out.join(',');
    };
    expect(run()).toBe(run());
  });
});
