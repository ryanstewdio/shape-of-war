// Sower roam (GW3, retimed GW4): the first dive a hashed 6 to 10 s after spawn, later dives a hashed
// 14 to 20 s apart; each steers to within 150 u of the arena centre, returns to the edge and orbits
// again; it keeps sowing. Real generated levels: sowerRoamReal.test.ts.
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
  it('dive gaps: 6 to 10 s for the first, 14 to 20 s after, hashed from seed, spawn index and loop', () => {
    const first = new Set<number>();
    const later = new Set<number>();
    for (let idx = 0; idx < 40; idx++) {
      const f = sower.diveGapSeconds(7, idx, 0);
      expect(f).toBeGreaterThanOrEqual(6);
      expect(f).toBeLessThan(10);
      first.add(Math.floor(f));
      for (let loop = 1; loop < 4; loop++) {
        const t = sower.diveGapSeconds(7, idx, loop);
        expect(t).toBeGreaterThanOrEqual(14);
        expect(t).toBeLessThan(20);
        expect(sower.diveGapSeconds(7, idx, loop)).toBe(t);
        later.add(Math.floor(t));
      }
    }
    expect(first.size).toBeGreaterThanOrEqual(4); // spread over the range
    expect(later.size).toBeGreaterThanOrEqual(5);
    expect(sower.diveGapSeconds(7, 3, 0)).not.toBe(sower.diveGapSeconds(8, 3, 0));
  });

  it('phase rules', () => {
    const { ROAM_EDGE: E, ROAM_IN: I, ROAM_OUT: O, nextRoamPhase: next } = sower;
    expect(next(E, 7, 7, 6.5, 0, false, 400)).toBe(I); // first dive: off the wall is fine
    expect(next(E, 6, 6, 6.5, 0, true, 400)).toBe(E); // gap not up
    expect(next(E, 3, 15, 14.5, 2, true, 400)).toBe(I);
    expect(next(E, 1, 15, 14.5, 2, true, 400)).toBe(E); // back on the edge under 2 s
    expect(next(I, 1, 1, 14, 2, false, 151)).toBe(I);
    expect(next(I, 1, 1, 14, 2, false, 150)).toBe(O);
    expect(next(I, sower.INWARD_MAX_SEC, 1, 14, 2, false, 300)).toBe(O); // blocked: give up
    expect(next(O, 1, 1, 14, 2, false, 300)).toBe(O);
    expect(next(O, 1, 1, 14, 2, true, 300)).toBe(E);
    expect(sower.CENTRE_REACH).toBe(150);
    expect(sower.EDGE_MIN_SEC).toBe(2);
  });

  it('slide side takes the shorter way round an obstacle', () => {
    // A 400 u wall at x = 0 from y = -300 to 100: from its left face at y = 50 the low end is nearer.
    const { w } = makeGame({ arena: { shape: 'rectObstacles', width: 1400, height: 900, cornerRadius: 0, obstacles: [{ cx: 0, cy: -100, w: 24, h: 400 }], spawnPoint: { x: 300, y: 0 } } });
    // Inward normal (-1, 0) on the left face; heading right. Clockwise (ny, -nx) = (0, 1) is down.
    expect(sower.slideSide(w, -30, 50, 16, -1, 0, 1, 0)).toBe(1);
    expect(sower.slideSide(w, -30, -250, 16, -1, 0, 1, 0)).toBe(-1);
    const out = { heading: 0, side: 0 };
    sower.inwardHeading(w, -30, 50, 16, 0, out);
    expect(out.side).toBe(1);
    expect(out.heading).toBeCloseTo(Math.PI / 2, 6); // slides down the face
    sower.inwardHeading(w, -30, -250, 16, 1, out);
    expect(out.side).toBe(1); // a kept side is never flipped mid contact
    sower.inwardHeading(w, -300, 0, 16, 1, out);
    expect(out.side).toBe(0); // clear way: straight at the centre
    expect(out.heading).toBeCloseTo(0, 6);
  });
});

describe('sower roam in play', () => {
  it('first dive 6 to 10 s after spawn, reaches the centre, returns to the edge and loops (rect)', () => {
    const { w } = makeGame();
    const id = put(w, sower.def, 0, -300);
    const tr = trace(w, id, 70);
    const idx = sower.spawnIndex(w, id);
    expect(idx).toBe(0);
    const ins = tr.changes.filter((c) => c.phase === sower.ROAM_IN);
    expect(ins.length).toBeGreaterThanOrEqual(3);
    // The first dive: exactly its hashed gap after the first step.
    const first = ins[0]?.t ?? 0;
    const gap0 = sower.diveGapSeconds(w.level.seed, idx, 0);
    expect(first).toBeGreaterThanOrEqual(gap0 - 1e-6);
    expect(first).toBeLessThan(gap0 + DT + 1e-6);
    // Each completed inward leg gets within 150 u of the centre (a leg cut off by the trace end is skipped).
    const outs = tr.changes.filter((c) => c.phase === sower.ROAM_OUT).length;
    expect(outs).toBeGreaterThanOrEqual(3);
    for (const d of tr.minDist.slice(0, outs)) expect(d).toBeLessThanOrEqual(sower.CENTRE_REACH + 1e-3);
    // Out then back to the edge.
    const seq = tr.changes.map((c) => c.phase);
    expect(seq.slice(0, 3)).toEqual([sower.ROAM_IN, sower.ROAM_OUT, sower.ROAM_EDGE]);
    expect(tr.changes[2]?.t ?? 0).toBeGreaterThan(first);
    // Later dives: 14 to 20 s apart (later when the return to the edge takes longer).
    for (let k = 1; k < ins.length; k++) {
      const gap = (ins[k]?.t ?? 0) - (ins[k - 1]?.t ?? 0);
      expect(gap).toBeGreaterThanOrEqual(sower.diveGapSeconds(w.level.seed, idx, k) - 1e-4);
      expect(gap).toBeLessThan(sower.DIVE_GAP_MIN + sower.DIVE_GAP_SPAN + 0.1);
    }
    // Smooth steering: never more than the turn rate per step.
    expect(tr.maxTurn).toBeLessThanOrEqual(sower.ROAM_TURN * DT + 1e-5);
  });

  it('is not pulled by a well while off the edge, and is pulled again on it', () => {
    const { w } = makeGame();
    const id = put(w, sower.def, 0, -300);
    expect(sower.isRoaming(w, id)).toBe(false);
    for (let i = 0; i < 120 * 12 && sower.roamPhase(w, id) !== sower.ROAM_IN; i++) sower.step(w, id, DT);
    expect(sower.isRoaming(w, id)).toBe(true);
    for (let i = 0; i < 120 * 30 && sower.roamPhase(w, id) !== sower.ROAM_EDGE; i++) sower.step(w, id, DT);
    expect(sower.isRoaming(w, id)).toBe(false);
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
