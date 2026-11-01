// Mix v3.5 tone (Ryan M1: "a reduction in highs"): the pure helpers, then the real synth and the
// real music session on a fake AudioContext, walking the graph: every sfx and music voice reaches
// the speaker only through the master tone stage, and every square, saw or pulse lead passes a
// low pass that tracks its note.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CUES, type CueName } from '../../src/audio/cues';
import { initMusic, startMusic, stopMusic } from '../../src/audio/music/index';
import { TICK_MS } from '../../src/audio/music/scheduler';
import { LAYERS_FULL } from '../../src/audio/music/layers';
import { TUNES } from '../../src/audio/music/tunes';
import { play, unlockAudio } from '../../src/audio/synth';
import {
  attackSec,
  dbToGain,
  leadCutoffHz,
  LEAD_LP_MAX_HZ,
  LEAD_LP_MIN_HZ,
  MIN_ATTACK_SEC,
  needsLeadFilter,
  noiseBandHz,
  NOISE_LP_HZ,
  shelfGainDbAt,
  TONE,
  toneMakeupGain,
} from '../../src/audio/tone';
import { Bus } from '../../src/core/events';
import type { EnemyKind } from '../../src/levelgen/leveldef';
import type { NodeLike, ParamLike } from '../../src/audio/music/engine';
import { FakeBufferSource, FakeContextFx, FakeFilter, FakeNode, FakeOsc, FakeParam, FakeTimer } from './music/fakeAudio';

describe('tone helpers', () => {
  it('the lead low pass tracks the note at 6x, capped at 5 kHz, floored at 700 Hz', () => {
    expect(leadCutoffHz(220)).toBeCloseTo(1320, 9);
    expect(leadCutoffHz(440)).toBeCloseTo(2640, 9);
    expect(leadCutoffHz(900)).toBe(LEAD_LP_MAX_HZ);
    expect(leadCutoffHz(2000)).toBe(5000);
    expect(leadCutoffHz(55)).toBe(LEAD_LP_MIN_HZ);
    expect(leadCutoffHz(0)).toBe(LEAD_LP_MIN_HZ);
    expect(leadCutoffHz(Number.NaN)).toBe(LEAD_LP_MIN_HZ);
    // Monotonic between the floor and the cap.
    for (let hz = 100; hz < 1000; hz += 37) expect(leadCutoffHz(hz + 1)).toBeGreaterThanOrEqual(leadCutoffHz(hz));
  });

  it('only square and saw waves need the tracking filter', () => {
    expect(needsLeadFilter('square')).toBe(true);
    expect(needsLeadFilter('sawtooth')).toBe(true);
    expect(needsLeadFilter('triangle')).toBe(false);
    expect(needsLeadFilter('sine')).toBe(false);
    expect(needsLeadFilter('noise')).toBe(false);
  });

  it('the master shelf cuts about 6 dB above 5 kHz, passes the mids, and the low pass sits at 9 kHz', () => {
    expect(TONE.shelfHz).toBe(5000);
    expect(TONE.shelfDb).toBe(-6);
    expect(TONE.lowpassHz).toBe(9000);
    expect(shelfGainDbAt(500)).toBeGreaterThan(-0.1);
    expect(shelfGainDbAt(1000)).toBeGreaterThan(-0.3);
    expect(shelfGainDbAt(5000)).toBeLessThan(-2);
    expect(shelfGainDbAt(5000)).toBeGreaterThan(-4);
    expect(shelfGainDbAt(20000)).toBeLessThan(-5);
    expect(shelfGainDbAt(20000)).toBeGreaterThanOrEqual(-6);
  });

  it('the makeup gain compensates at most 2 dB', () => {
    expect(TONE.makeupDb).toBeGreaterThan(0);
    expect(TONE.makeupDb).toBeLessThanOrEqual(2);
    expect(toneMakeupGain()).toBeCloseTo(dbToGain(TONE.makeupDb), 12);
    expect(toneMakeupGain()).toBeLessThanOrEqual(dbToGain(2));
  });

  it('attacks are at least 4 ms and noise filters stay under 7 kHz', () => {
    expect(attackSec(0.001)).toBe(MIN_ATTACK_SEC);
    expect(attackSec(0.002)).toBe(0.004);
    expect(attackSec(0.05)).toBe(0.05);
    expect(attackSec(Number.NaN)).toBe(MIN_ATTACK_SEC);
    expect(noiseBandHz(6000)).toBe(6000);
    expect(noiseBandHz(12000)).toBe(NOISE_LP_HZ);
    expect(NOISE_LP_HZ).toBe(7000);
  });
});

// ---------------------------------------------------------------------------------------
// The real graph.

class Panner extends FakeNode {
  readonly pan = new FakeParam();
}

class Ctx extends FakeContextFx {
  static last: Ctx | null = null;
  readonly destination = new FakeNode();
  state: 'running' | 'suspended' = 'running';
  constructor() {
    super();
    Ctx.last = this;
  }
  createStereoPanner(): Panner {
    return new Panner();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    return Promise.resolve();
  }
}

const isNode = (x: NodeLike | ParamLike): x is FakeNode => x instanceof FakeNode;

/** True when `to` is reachable from `from` along connections, never passing `skip`. */
function reaches(from: FakeNode, to: FakeNode, skip: FakeNode | null): boolean {
  const seen = new Set<FakeNode>();
  const stack: FakeNode[] = [from];
  while (stack.length > 0) {
    const n = stack.pop();
    if (n === undefined || seen.has(n) || n === skip) continue;
    if (n === to) return true;
    seen.add(n);
    for (const c of n.connected) if (isNode(c)) stack.push(c);
  }
  return false;
}

/** Every filter reachable from a node before the master tone stage. */
function filtersOnPath(from: FakeNode, stop: FakeNode): FakeFilter[] {
  const out: FakeFilter[] = [];
  const seen = new Set<FakeNode>();
  const stack: FakeNode[] = [from];
  while (stack.length > 0) {
    const n = stack.pop();
    if (n === undefined || seen.has(n) || n === stop) continue;
    seen.add(n);
    if (n instanceof FakeFilter) out.push(n);
    for (const c of n.connected) if (isNode(c)) stack.push(c);
  }
  return out;
}

/** A filter's first cutoff: its value, or the first scheduled set when it is automated. */
function cutoffOf(f: FakeFilter): number {
  const first = f.frequency.calls.find((c) => c.fn === 'set');
  return first ? first.v : f.frequency.value;
}

const listeners = { addEventListener: (): void => undefined, removeEventListener: (): void => undefined };
let ctx: Ctx;
let shelf: FakeFilter;

beforeAll(async () => {
  vi.stubGlobal('AudioContext', Ctx);
  vi.stubGlobal('window', listeners);
  vi.stubGlobal('document', { ...listeners, hidden: false });
  await unlockAudio();
  const c = Ctx.last;
  if (!c) throw new Error('no context');
  ctx = c;
  const s = ctx.filters.find((f) => f.type === 'highshelf');
  if (!s) throw new Error('no tone stage');
  shelf = s;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('the master tone stage in the real graph', () => {
  it('is built once: high shelf -6 dB at 5 kHz, then a 9 kHz low pass, then the makeup gain, into the speaker', () => {
    expect(shelf.frequency.value).toBe(TONE.shelfHz);
    expect(shelf.gain.value).toBe(TONE.shelfDb);
    const lp = shelf.connected[0];
    expect(lp).toBeInstanceOf(FakeFilter);
    if (!(lp instanceof FakeFilter)) return;
    expect(lp.type).toBe('lowpass');
    expect(lp.frequency.value).toBe(TONE.lowpassHz);
    expect(reaches(shelf, ctx.destination, null)).toBe(true);
    expect(ctx.filters.filter((f) => f.type === 'highshelf')).toHaveLength(1);
  });

  it('every sfx cue voice reaches the speaker only through it; noise is band limited and bright waves track', () => {
    const firstOsc = ctx.oscs.length;
    const firstNoise = ctx.bufferSources.length;
    for (const name of Object.keys(CUES) as CueName[]) {
      ctx.currentTime += 1;
      play(name);
    }
    const oscs = ctx.oscs.slice(firstOsc);
    const noises = ctx.bufferSources.slice(firstNoise);
    expect(oscs.length).toBeGreaterThan(10);
    expect(noises.length).toBeGreaterThan(3);
    for (const s of [...oscs, ...noises]) {
      expect(reaches(s, ctx.destination, null)).toBe(true);
      expect(reaches(s, ctx.destination, shelf)).toBe(false);
    }
    for (const n of noises) {
      const lows = filtersOnPath(n, shelf).filter((f) => f.type === 'lowpass');
      expect(lows.some((f) => cutoffOf(f) <= NOISE_LP_HZ)).toBe(true);
    }
    for (const o of oscs.filter((x) => needsLeadFilter(x.type))) {
      const f0 = o.frequency.calls.find((c) => c.fn === 'set')?.v ?? 0;
      const lows = filtersOnPath(o, shelf).filter((f) => f.type === 'lowpass' || f.type === 'bandpass');
      expect(lows.some((f) => cutoffOf(f) <= Math.max(leadCutoffHz(f0), 5000)), `${o.type} ${f0}`).toBe(true);
    }
  });

  it('every music voice of every level tune (bed, lead, motifs, stingers, kill accents) reaches the speaker only through it, and bright leads track', () => {
    const timer = new FakeTimer();
    const bus = new Bus();
    for (const t of TUNES) {
      const off = initMusic({ bus, timer, visibility: null, volume: 50, tune: t.id });
      const firstOsc = ctx.oscs.length;
      const firstNoise = ctx.bufferSources.length;
      startMusic(7);
      const kinds = Object.keys(LAYERS_FULL) as EnemyKind[];
      for (let i = 0; i < 30 / (TICK_MS / 1000); i++) {
        if (i % 4 === 0) bus.emit('sim:threat', { level: 0.8 });
        if (i === 40) for (const k of kinds.slice(0, 4)) bus.emit('sim:enemyEnter', { kind: k, live: 2 });
        if (i % 50 === 0) {
          bus.emit('fx:kill', { x: 0, y: 0, colour: 'blue', kind: 1, id: 9 });
          bus.emit('sfx', 'explode');
        }
        ctx.currentTime += TICK_MS / 1000;
        timer.fire();
      }
      const oscs = ctx.oscs.slice(firstOsc);
      const noises = ctx.bufferSources.slice(firstNoise);
      expect(oscs.length, t.id).toBeGreaterThan(100);
      // The pad LFO and vibrato LFOs drive params, not the speaker; every other source sounds.
      const sounding = [...oscs, ...noises].filter((s) => reaches(s, ctx.destination, null));
      expect(sounding.length).toBeGreaterThan(100);
      for (const s of sounding) expect(reaches(s, ctx.destination, shelf), t.id).toBe(false);
      // Shared buses (bass and pad lowpass, the threat lowpass) are reached by many sources; a
      // lead's tracking filter belongs to its own voice.
      const reach = new Map<FakeFilter, number>();
      for (const src of sounding) for (const f of filtersOnPath(src, shelf)) reach.set(f, (reach.get(f) ?? 0) + 1);
      const shared = (f: FakeFilter): boolean => (reach.get(f) ?? 0) > 3;
      const threat = (f: FakeFilter): boolean => f.frequency.calls.some((c) => c.fn === 'target');
      let leads = 0;
      for (const o of sounding.filter((x): x is FakeOsc => x instanceof FakeOsc && (needsLeadFilter(x.type) || x.type === 'custom'))) {
        const path = filtersOnPath(o, shelf).filter((f) => !threat(f));
        // A bass or pad bed voice sits behind its sub 1 kHz bus.
        if (path.some((f) => shared(f) && f.type === 'lowpass' && f.frequency.value <= 1000)) continue;
        leads++;
        const hz = Math.max(...o.frequency.calls.filter((c) => c.fn === 'set' || c.fn === 'exp').map((c) => c.v));
        const own = path.filter((f) => !shared(f) && (f.type === 'lowpass' || f.type === 'bandpass'));
        expect(own.some((f) => cutoffOf(f) <= leadCutoffHz(hz) + 1e-6), `${t.id} ${o.type} ${hz}`).toBe(true);
      }
      expect(leads, t.id).toBeGreaterThan(20);
      for (const n of noises.filter((s) => s instanceof FakeBufferSource && reaches(s, ctx.destination, null))) {
        const lows = filtersOnPath(n, shelf).filter((f) => f.type === 'lowpass' || f.type === 'bandpass');
        expect(lows.some((f) => cutoffOf(f) <= NOISE_LP_HZ)).toBe(true);
      }
      stopMusic();
      off();
    }
  });
});
