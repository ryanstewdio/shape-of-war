// Mix v3.5 space breakdown: the pure timeline, then the real scheduler for all six level tunes.
// M1 on device: the breakdown was not heard. It now starts 30 to 45 s into every level tune and
// returns every 90 to 120 s; drums and bass fully drop while the pad rises, the long echo swells
// and the lowpass opens.
import { afterEach, describe, expect, it } from 'vitest';
import {
  BREAK_BARS,
  BREAK_FIRST_MAX_SEC,
  BREAK_FIRST_MIN_SEC,
  BREAK_GAP_MAX_SEC,
  BREAK_GAP_MIN_SEC,
  breakdownSection,
  breakdownStarts,
  hasBreakdowns,
  isBreakdownBar,
  sectionSec,
} from '../../../src/audio/music/breakdown';
import { BREAK_LONG_WET } from '../../../src/audio/music/engine';
import { BREAK_CUTOFF_HZ, initMusic, startMusic, stopMusic, type MusicGraph, type NoteLog } from '../../../src/audio/music/index';
import { TICK_MS } from '../../../src/audio/music/scheduler';
import { buildBar, STEPS_PER_BAR } from '../../../src/audio/music/track';
import { BATTLE_TUNES, TUNES, type LevelTune } from '../../../src/audio/music/tunes';
import { Bus } from '../../../src/core/events';
import { FakeContextFx, FakeNode, FakeTimer } from './fakeAudio';

const SEEDS = [1, 7, 0x229578a8, 0xdeadbeef, 424242];

describe('breakdown timeline (pure)', () => {
  it('every level tune: the first breakdown starts 30 to 45 s in, then every 90 to 120 s, on a 4 bar line', () => {
    for (const t of TUNES) {
      expect(hasBreakdowns(t)).toBe(true);
      for (const seed of SEEDS) {
        const starts = breakdownStarts(seed, t, 6);
        expect(starts).toHaveLength(6);
        const first = starts[0] ?? -1;
        expect(first, `${t.id} ${seed}`).toBeGreaterThanOrEqual(BREAK_FIRST_MIN_SEC);
        expect(first, `${t.id} ${seed}`).toBeLessThanOrEqual(BREAK_FIRST_MAX_SEC);
        for (let i = 1; i < starts.length; i++) {
          const gap = (starts[i] ?? 0) - (starts[i - 1] ?? 0);
          expect(gap, `${t.id} ${seed} gap ${i}`).toBeGreaterThanOrEqual(BREAK_GAP_MIN_SEC);
          expect(gap, `${t.id} ${seed} gap ${i}`).toBeLessThanOrEqual(BREAK_GAP_MAX_SEC);
        }
        for (const s of starts) expect(s / sectionSec(t)).toBeCloseTo(Math.round(s / sectionSec(t)), 9);
      }
    }
  });

  it('isBreakdownBar marks exactly the 4 bars of each breakdown section', () => {
    for (const t of TUNES) {
      const seed = 99;
      const bars = Array.from({ length: 200 }, (_, b) => isBreakdownBar(seed, t, b));
      for (let k = 0; k < 3; k++) {
        const s = breakdownSection(seed, t, k) * BREAK_BARS;
        for (let b = s; b < s + BREAK_BARS; b++) expect(bars[b], `${t.id} bar ${b}`).toBe(true);
        expect(bars[s - 1]).toBe(false);
        expect(bars[s + BREAK_BARS]).toBe(false);
      }
      expect(isBreakdownBar(seed, t, -1)).toBe(false);
    }
  });

  it('battle tracks never break down', () => {
    for (const t of BATTLE_TUNES) {
      expect(hasBreakdowns(t)).toBe(false);
      for (let b = 0; b < 200; b++) expect(isBreakdownBar(3, t, b)).toBe(false);
    }
  });

  it('a breakdown bar has no drums and no bass, a risen windy pad on the long echo and the S phrase on the long echo, even when a fill was asked for', () => {
    for (const t of TUNES) {
      const s = breakdownSection(5, t, 0) * BREAK_BARS;
      for (let b = s; b < s + BREAK_BARS; b++) {
        for (const fill of [null, 0, 1] as const) {
          const p = buildBar(5, b, t, fill);
          expect(p.fill).toBeNull();
          expect(p.notes.filter((n) => n.layer === 'kick' || n.layer === 'perc' || n.layer === 'hat' || n.layer === 'bass')).toEqual([]);
          const pads = p.notes.filter((n) => n.layer === 'pad');
          expect(pads.length).toBeGreaterThanOrEqual(3);
          for (const n of pads) {
            expect(n.fx?.echo).toBe(2);
            expect(n.vel).toBeGreaterThan(1);
          }
          expect(pads.some((n) => n.fx?.wind === true)).toBe(true);
          for (const n of p.notes.filter((n) => n.layer === 'arp')) expect(n.fx?.echo).toBe(2);
        }
      }
      // The bar before plays drums.
      expect(buildBar(5, s - 1, t).notes.some((n) => n.layer === 'kick')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------
// The real scheduler.

let uninstall: (() => void) | null = null;
afterEach(() => {
  stopMusic();
  uninstall?.();
  uninstall = null;
});

interface Run {
  log: (NoteLog & { now: number })[];
  ctx: FakeContextFx;
  t0: number;
}

/** Play a level tune for `sec` seconds on the fake clock, threat swinging through the lift. */
function run(t: LevelTune, seed: number, sec: number, threat: (s: number) => number): Run {
  const ctx = new FakeContextFx();
  const timer = new FakeTimer();
  const bus = new Bus();
  const log: (NoteLog & { now: number })[] = [];
  const graph: MusicGraph = { ctx, master: new FakeNode() };
  uninstall = initMusic({ bus, graph: () => graph, timer, visibility: null, volume: 50, tune: t.id, onNote: (n) => log.push({ ...n, now: ctx.currentTime }) });
  startMusic(seed);
  const n = Math.round(sec / (TICK_MS / 1000));
  for (let i = 0; i < n; i++) {
    if (i % 4 === 0) bus.emit('sim:threat', { level: threat(ctx.currentTime) });
    ctx.currentTime += TICK_MS / 1000;
    timer.fire();
  }
  const t0 = log.find((e) => e.role === 'bed')?.time ?? 0;
  return { log, ctx, t0 };
}

/** Bar start times (from the first note) of every bar with pads but no drums and no bass. */
function quietBars(r: Run, t: LevelTune): number[] {
  const barSec = t.stepSec * STEPS_PER_BAR;
  const bars = new Map<number, { pad: number; beat: number }>();
  for (const e of r.log) {
    if (e.role !== 'bed') continue;
    const b = Math.round((e.time - r.t0) / barSec - 0.49);
    const m = bars.get(b) ?? { pad: 0, beat: 0 };
    if (e.layer === 'pad') m.pad++;
    if (e.layer === 'kick' || e.layer === 'perc' || e.layer === 'hat' || e.layer === 'bass') m.beat++;
    bars.set(b, m);
  }
  return [...bars.entries()]
    .filter(([, m]) => m.pad > 0 && m.beat === 0)
    .map(([b]) => b)
    .sort((a, b) => a - b);
}

/** Runs of consecutive bars as [first bar, length]. */
function runsOf(bars: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const b of bars) {
    const last = out[out.length - 1];
    if (last && last[0] + last[1] === b) last[1]++;
    else out.push([b, 1]);
  }
  return out;
}

describe('breakdown on the real scheduler timeline', () => {
  it.each(TUNES.map((t) => [t.id, t] as const))('%s: in at 30 to 45 s, again every 90 to 120 s, 4 bars each, drums and bass fully out, pad up', (_id, t) => {
    // Threat swings from an empty arena to the lift and back (lift changes book runtime fills).
    const r = run(t, 0x229578a8, 290, (s) => (Math.floor(s / 13) % 3 === 0 ? 0.15 : Math.floor(s / 13) % 3 === 1 ? 0.75 : 0.45));
    const barSec = t.stepSec * STEPS_PER_BAR;
    const runs = runsOf(quietBars(r, t));
    // Every quiet run is a full breakdown (the arena starts at threat 0.15, so no early bar lacks drums
    // only because the kick has not come in: bass plays from 0.06).
    expect(runs.length, t.id).toBeGreaterThanOrEqual(3);
    for (const [, len] of runs) expect(len, t.id).toBe(BREAK_BARS);
    const starts = runs.map(([b]) => b * barSec);
    expect(starts[0] ?? 0).toBeGreaterThanOrEqual(BREAK_FIRST_MIN_SEC - 1e-6);
    expect(starts[0] ?? 0).toBeLessThanOrEqual(BREAK_FIRST_MAX_SEC + 1e-6);
    for (let i = 1; i < starts.length; i++) {
      const gap = (starts[i] ?? 0) - (starts[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(BREAK_GAP_MIN_SEC - 1e-6);
      expect(gap).toBeLessThanOrEqual(BREAK_GAP_MAX_SEC + 1e-6);
    }
    // The pad rises: its loudest breakdown note beats its loudest note elsewhere.
    const inBreak = (time: number): boolean => runs.some(([b, len]) => time - r.t0 >= b * barSec - 1e-6 && time - r.t0 < (b + len) * barSec - 1e-6);
    const pads = r.log.filter((e) => e.role === 'bed' && e.layer === 'pad');
    const padIn = Math.max(...pads.filter((e) => inBreak(e.time)).map((e) => e.gain));
    const padOut = Math.max(...pads.filter((e) => !inBreak(e.time)).map((e) => e.gain));
    expect(padIn).toBeGreaterThan(padOut * 1.4);
    // The long echo swells: some gain is driven to the breakdown return level.
    expect(r.ctx.gains.some((g) => g.gain.calls.some((c) => c.fn === 'target' && c.v === BREAK_LONG_WET))).toBe(true);
  });

  it('at low threat the breakdown opens the lowpass so the pad and echo are heard', () => {
    const t = TUNES[0];
    if (!t) return;
    const r = run(t, 11, 50, () => 0.1);
    const master = r.ctx.filters.find((f) => f.frequency.calls.some((c) => c.fn === 'target'));
    expect(master).toBeDefined();
    const targets = master?.frequency.calls.filter((c) => c.fn === 'target').map((c) => c.v) ?? [];
    expect(Math.max(...targets)).toBeGreaterThanOrEqual(BREAK_CUTOFF_HZ);
    expect(Math.min(...targets)).toBeLessThan(1000);
  });
});
