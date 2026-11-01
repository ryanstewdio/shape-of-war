// Engine voice colour (v3.4): pulse duty waves, slides, delayed vibrato, the FM bell, the chip pad
// arpeggio, noise wind and the two echo buses, on a fake context that has delay lines and
// periodic waves. Echo and colour add no voices.
import { describe, expect, it } from 'vitest';
import { fx } from '../../../src/audio/music/compose';
import {
  arpSchedule,
  BELL_RATIO,
  createMusicEngine,
  ECHO_MAX_SEC,
  longEchoSec,
  LONG_ECHO_STEPS,
  pulseCoefficients,
  SLAP_SEC,
} from '../../../src/audio/music/engine';
import { TIMBRES } from '../../../src/audio/music/layers';
import { midiToHz } from '../../../src/audio/music/scale';
import { FakeContext, FakeContextFx, FakeDelay, FakeGain, FakeNode, FakeOsc, FakeWave, FakeWaveOsc } from './fakeAudio';

function setup(): { ctx: FakeContextFx; engine: ReturnType<typeof createMusicEngine> } {
  const ctx = new FakeContextFx();
  const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
  return { ctx, engine };
}

/** True when a node connects to a gain that feeds the given delay line. */
function sendsTo(node: FakeGain, delay: FakeDelay): boolean {
  return node.connected.some((d) => d instanceof FakeGain && d.connected.includes(delay));
}

describe('pure helpers', () => {
  it('pulse coefficients: no DC, the 2 over n pi sine series, a square at duty one half', () => {
    const sq = pulseCoefficients(0.5, 8);
    expect(sq[0]).toBe(0);
    expect(sq[1]).toBeCloseTo(2 / Math.PI, 6);
    expect(sq[2]).toBeCloseTo(0, 6);
    const thin = pulseCoefficients(0.125, 8);
    expect(thin[2]).toBeGreaterThan(0.1);
    expect(thin).toHaveLength(9);
  });

  it('the long echo is a dotted eighth of the tempo, inside the delay line', () => {
    expect(longEchoSec(0.125)).toBeCloseTo(LONG_ECHO_STEPS * 0.125, 12);
    expect(longEchoSec(10)).toBe(ECHO_MAX_SEC);
  });

  it('an arpeggio schedule cycles for a held pad and runs once, last note held, for a kill', () => {
    expect(arpSchedule([60, 64, 67], 0.1, 0.45, true).map((e) => e.midi)).toEqual([60, 64, 67, 60, 64]);
    const once = arpSchedule([60, 64, 67, 72], 0.05, 1, false);
    expect(once.map((e) => e.midi)).toEqual([60, 64, 67, 72]);
    expect(once.map((e) => e.at)).toEqual([0, 0.05, 0.1, 0.15000000000000002]);
    expect(arpSchedule([], 0.1, 1, true)).toEqual([]);
  });
});

describe('the engine with echo and periodic waves', () => {
  it('builds a slap and a long echo once, and follows the tempo only when it changes', () => {
    const { ctx, engine } = setup();
    expect(ctx.delays).toHaveLength(2);
    const [slap, long] = ctx.delays;
    expect(slap?.delayTime.value).toBe(SLAP_SEC);
    const before = long?.delayTime.calls.length ?? 0;
    engine.setStepSec(0.1);
    engine.setStepSec(0.1);
    const calls = long?.delayTime.calls.slice(before) ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0]?.v).toBeCloseTo(longEchoSec(0.1), 12);
  });

  it('a pulse lead gets its duty wave (made once per duty), slides in and gets delayed vibrato on a held note', () => {
    const { ctx, engine } = setup();
    const start = ctx.oscs.length;
    const f = fx({ duty: 0.25, slideFrom: 64, vibrato: 20, echo: 1 });
    engine.play({ layer: 'arp', midi: 69, time: 0.1, dur: 0.8, gain: 0.1, fx: f });
    engine.play({ layer: 'arp', midi: 71, time: 1, dur: 0.8, gain: 0.1, fx: f });
    expect(ctx.waves).toHaveLength(1);
    expect(ctx.waves[0]).toBeInstanceOf(FakeWave);
    const made = ctx.oscs.slice(start);
    const lead = made[0] as FakeWaveOsc;
    expect(lead.wave).toBe(ctx.waves[0]);
    // The slide: from E4 to A4.
    expect(lead.frequency.calls[0]?.v).toBeCloseTo(midiToHz(64), 6);
    expect(lead.frequency.calls.some((c) => c.fn === 'exp' && Math.abs(c.v - midiToHz(69)) < 1e-6)).toBe(true);
    // The vibrato LFO drives the lead's detune through a depth gain that starts at 0.
    const lfo = made[1] as FakeOsc;
    expect(lfo.type).toBe('sine');
    const depth = lfo.connected[0] as FakeGain;
    expect(depth.connected).toContain(lead.detune);
    expect(depth.gain.calls[0]?.v).toBe(0);
    expect(Math.max(...depth.gain.calls.map((c) => c.v))).toBe(20);
    // One voice per note, echo included.
    expect(engine.voiceCount).toBe(1);
  });

  it('a bell is a sine carrier frequency modulated by a sine at the bell ratio', () => {
    const { ctx, engine } = setup();
    const start = ctx.oscs.length;
    engine.play({ layer: 'arp', midi: 74, time: 0.1, dur: 1, gain: 0.1, fx: fx({ bell: true, echo: 2 }) });
    const [car, mod] = ctx.oscs.slice(start);
    expect(car?.type).toBe('sine');
    expect(mod?.type).toBe('sine');
    expect(mod?.frequency.calls[0]?.v).toBeCloseTo(midiToHz(74) * BELL_RATIO, 6);
    const index = mod?.connected[0] as FakeGain;
    expect(index.connected).toContain(car?.frequency);
    expect(engine.voiceCount).toBe(1);
  });

  it('a chip pad is one oscillator stepping through the chord, cycling for the bar', () => {
    const { ctx, engine } = setup();
    const start = ctx.oscs.length;
    engine.play({ layer: 'pad', midi: 57, time: 0.1, dur: 2, gain: 0.18, fx: fx({ chord: [57, 60, 64, 69], chordSec: 0.0625 }) });
    const made = ctx.oscs.slice(start);
    expect(made).toHaveLength(1);
    const sets = made[0]?.frequency.calls.filter((c) => c.fn === 'set') ?? [];
    expect(sets.length).toBeGreaterThanOrEqual(32);
    expect(sets.slice(1, 5).map((c) => c.v)).toEqual([57, 60, 64, 69].map(midiToHz));
    expect(engine.voiceCount).toBe(1);
  });

  it('a space pad carries filtered noise wind and sends to the long echo', () => {
    const { ctx, engine } = setup();
    const long = ctx.delays[1];
    const g0 = ctx.gains.length;
    const b0 = ctx.bufferSources.length;
    const f0 = ctx.filters.length;
    engine.play({ layer: 'pad', midi: 57, time: 0.1, dur: 2, gain: 0.18, fx: fx({ wind: true, echo: 2 }) });
    expect(ctx.bufferSources.length - b0).toBe(1);
    const bp = ctx.filters.slice(f0).find((f) => f.type === 'bandpass');
    expect(bp).toBeDefined();
    expect(bp?.frequency.calls.some((c) => c.fn === 'lin')).toBe(true);
    const outs = ctx.gains.slice(g0);
    expect(long !== undefined && outs.some((g) => sendsTo(g, long))).toBe(true);
    expect(engine.voiceCount).toBe(1);
  });

  it('a kill accent arpeggio steps one voice through its notes once and sends to its echo', () => {
    const { ctx, engine } = setup();
    const slap = ctx.delays[0];
    const o0 = ctx.oscs.length;
    const g0 = ctx.gains.length;
    engine.playVoice({ time: 0.1, dur: 0.25, midi: 69, fromMidi: null, gain: 0.1, timbre: TIMBRES.chime, echo: 1, arp: [69, 72, 76], arpSec: 0.05 }, 'accent');
    const made = ctx.oscs.slice(o0);
    for (const o of made) {
      const sets = o.frequency.calls.filter((c) => c.fn === 'set').map((c) => c.v);
      expect(sets.slice(-3)).toEqual([69, 72, 76].map((m) => midiToHz(m)));
    }
    expect(slap !== undefined && ctx.gains.slice(g0).some((g) => sendsTo(g, slap))).toBe(true);
    expect(engine.voiceCount).toBe(1);
  });

  it('a context without delay lines or periodic waves still plays every colour, dry and square', () => {
    const ctx = new FakeContext();
    const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
    engine.setStepSec(0.1);
    engine.play({ layer: 'arp', midi: 69, time: 0.1, dur: 0.5, gain: 0.1, fx: fx({ duty: 0.125, echo: 2 }) });
    engine.playVoice({ time: 0.2, dur: 0.2, midi: 69, fromMidi: null, gain: 0.1, timbre: TIMBRES.chime, echo: 2 }, 'accent');
    expect(ctx.oscs.some((o) => o.type === 'square')).toBe(true);
    expect(engine.voiceCount).toBe(2);
  });
});
