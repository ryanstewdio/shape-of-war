// R3 Turbo layer in the music session (index.ts): 'fx:turbo' starts it after the ignition, a
// second active extends it without stacking, the end fades it out in 0.3 s, the bed ducks 30
// percent, and music volume 0 is silent.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initMusic, musicState, setMusicVolume, startMusic, type NoteLog } from '../../../src/audio/music/index';
import type { VoiceTrace } from '../../../src/audio/music/engine';
import { TICK_MS } from '../../../src/audio/music/scheduler';
import { TURBO_FADE_SEC, TURBO_IGNITION_SEC } from '../../../src/audio/music/turbo';
import { Bus } from '../../../src/core/events';
import { FakeContextFx, FakeNode, FakeTimer } from './fakeAudio';

let ctx: FakeContextFx;
let timer: FakeTimer;
let bus: Bus;
let notes: NoteLog[];
let uninstall: () => void;
/** Turbo voice spans from the engine trace, cut short when the gate closes. */
let spans: Map<number, { start: number; end: number }>;

function advance(sec: number): void {
  const n = Math.round(sec / (TICK_MS / 1000));
  for (let i = 0; i < n; i++) {
    ctx.currentTime += TICK_MS / 1000;
    timer.fire();
  }
}

const turbo = (active: boolean): void => bus.emit('fx:turbo', { active, x: 0, y: 0 });
const turboNotes = (): NoteLog[] => notes.filter((n) => n.role === 'turbo');

beforeEach(() => {
  ctx = new FakeContextFx();
  timer = new FakeTimer();
  bus = new Bus();
  notes = [];
  spans = new Map();
  const trace: VoiceTrace = {
    start: (id, cls, start, end) => {
      if (cls === 'turbo') spans.set(id, { start, end });
    },
    cut: (id, at) => {
      const s = spans.get(id);
      if (s) spans.set(id, { start: s.start, end: Math.min(s.end, at) });
    },
  };
  uninstall = initMusic({ tune: 'neon', bus, graph: () => ({ ctx, master: new FakeNode() }), timer, visibility: null, volume: 50, onNote: (n) => notes.push(n), trace });
  startMusic(42);
  advance(2);
});

afterEach(() => {
  uninstall();
});

describe('turbo layer in the session', () => {
  it('joins after the 0.4 s ignition with an arp, a bass and a hat, at most one voice each', () => {
    const t0 = ctx.currentTime;
    turbo(true);
    expect(musicState().turbo).toBe(true);
    advance(2);
    const tn = turboNotes();
    expect(tn.length).toBeGreaterThan(20);
    expect(Math.min(...tn.map((n) => n.time))).toBeGreaterThanOrEqual(t0 + TURBO_IGNITION_SEC - 1e-6);
    const parts = new Set(tn.map((n) => n.turboPart));
    expect(parts).toEqual(new Set(['arp', 'bass', 'hat']));
    // Double time: two arp notes per bass note.
    const arp = tn.filter((n) => n.turboPart === 'arp').length;
    const bass = tn.filter((n) => n.turboPart === 'bass').length;
    expect(arp).toBe(2 * bass);
    expect(musicState().turboVoices).toBeLessThanOrEqual(3);
    expect(musicState().voices).toBeLessThanOrEqual(16);
  });

  it('ducks the base tune 30 percent while the layer sounds, and restores it after', () => {
    const before = notes.filter((n) => n.role === 'bed' && n.layer === 'pad').map((n) => n.gain);
    const full = Math.max(...before);
    turbo(true);
    advance(1);
    notes = [];
    advance(4);
    const during = notes.filter((n) => n.role === 'bed' && n.layer === 'pad').map((n) => n.gain);
    expect(during.length).toBeGreaterThan(0);
    expect(Math.max(...during) / full).toBeCloseTo(0.7, 2);
    turbo(false);
    advance(2);
    notes = [];
    advance(4);
    const after = notes.filter((n) => n.role === 'bed' && n.layer === 'pad').map((n) => n.gain);
    expect(Math.max(...after)).toBeCloseTo(full, 6);
  });

  it('a second active extends it: no restart, no gap, no stacking', () => {
    turbo(true);
    advance(3);
    const t1 = ctx.currentTime;
    turbo(true);
    advance(3);
    const tn = turboNotes().filter((n) => n.turboPart === 'bass');
    const times = tn.map((n) => n.time).sort((a, b) => a - b);
    // Bass hits come every step, also across the second active.
    const gaps = times.slice(1).map((t, i) => t - (times[i] ?? 0));
    expect(Math.max(...gaps)).toBeLessThan(0.2);
    expect(times.some((t) => t > t1 && t < t1 + TURBO_IGNITION_SEC)).toBe(true);
    // One note per step: never two bass notes at one time.
    expect(new Set(times.map((t) => t.toFixed(6))).size).toBe(times.length);
    expect(musicState().turboVoices).toBeLessThanOrEqual(3);
  });

  it('the end fades the layer out in 0.3 s: no note after it, then the layer is gone', () => {
    turbo(true);
    advance(2);
    const tEnd = ctx.currentTime;
    const booked = turboNotes().length;
    turbo(false);
    turbo(false);
    expect(musicState().turbo).toBe(false);
    advance(2);
    // Notes booked after the end stop before the fade ends ...
    const late = turboNotes()
      .slice(booked)
      .filter((n) => n.time >= tEnd + TURBO_FADE_SEC - 1e-6);
    expect(late).toHaveLength(0);
    // ... and no Turbo voice, booked ahead before the end included, sounds past the fade.
    for (const s of spans.values()) expect(s.end).toBeLessThanOrEqual(tEnd + TURBO_FADE_SEC + 0.03);
    expect(musicState().turboVoices).toBe(0);
    const count = turboNotes().length;
    advance(2);
    expect(turboNotes().length).toBe(count);
  });

  it('restarts cleanly when Turbo retriggers inside the fade', () => {
    turbo(true);
    advance(2);
    turbo(false);
    advance(0.1);
    const t = ctx.currentTime;
    const booked = turboNotes().length;
    turbo(true);
    advance(2);
    expect(musicState().turbo).toBe(true);
    const fresh = turboNotes().slice(booked);
    expect(fresh.length).toBeGreaterThan(0);
    expect(Math.min(...fresh.map((n) => n.time))).toBeGreaterThanOrEqual(t + TURBO_IGNITION_SEC - 1e-6);
  });

  it('is silent at music volume 0', () => {
    setMusicVolume(0);
    turbo(true);
    advance(3);
    expect(turboNotes()).toHaveLength(0);
    expect(musicState().turboVoices).toBe(0);
  });

  it('a Turbo event with no music playing is ignored', () => {
    uninstall();
    uninstall = initMusic({ tune: 'neon', bus, graph: () => ({ ctx, master: new FakeNode() }), timer, visibility: null, volume: 50 });
    expect(() => turbo(true)).not.toThrow();
    expect(musicState().turbo).toBe(false);
  });
});
