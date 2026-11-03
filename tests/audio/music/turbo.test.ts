// R3 Turbo music layer (src/audio/music/turbo.ts) and its engine voices (engine.ts playTurbo,
// turboGate): lifecycle, envelope, duck, budget, pattern, and the voice rules.
import { describe, expect, it } from 'vitest';
import { createMusicEngine, MUSIC_VOICE_CAP, turboHitEnvelope } from '../../../src/audio/music/engine';
import { HARMONIES, inChord } from '../../../src/audio/music/harmony';
import { TIMBRES } from '../../../src/audio/music/layers';
import {
  TURBO_ARP_PER_STEP,
  TURBO_CHUNK_STEPS,
  TURBO_DUCK,
  TURBO_FADE_SEC,
  TURBO_GAINS,
  TURBO_IGNITION_SEC,
  TURBO_TOTAL,
  turboBudget,
  turboChunk,
  turboChunkSteps,
  turboDuck,
  turboEnd,
  turboEnvAt,
  turboLayerAt,
  turboOn,
  turboPartLength,
  turboPrune,
  turboStart,
} from '../../../src/audio/music/turbo';
import { FakeContextFx, FakeNode } from './fakeAudio';

describe('turbo lifecycle', () => {
  it('starts, extends without restarting, ends once and is pruned after the fade', () => {
    const a = turboStart(null, 1);
    expect(a).toEqual({ startAt: 1, endAt: null });
    expect(turboOn(a)).toBe(true);
    // A second active while it runs (an extension): the same life, nothing restarts or stacks.
    expect(turboStart(a, 6)).toBe(a);
    const b = turboEnd(a, 16);
    expect(b).toEqual({ startAt: 1, endAt: 16 });
    expect(turboOn(b)).toBe(false);
    // A second inactive is a no op.
    expect(turboEnd(b, 17)).toBe(b);
    expect(turboEnd(null, 3)).toBeNull();
    expect(turboPrune(b, 16 + TURBO_FADE_SEC / 2)).toBe(b);
    expect(turboPrune(b, 16 + TURBO_FADE_SEC)).toBeNull();
    expect(turboPrune(a, 100)).toBe(a);
  });

  it('an active inside the fade restarts cleanly with a fresh life', () => {
    const ended = turboEnd(turboStart(null, 0), 10);
    const again = turboStart(ended, 10.1);
    expect(again).toEqual({ startAt: 10.1, endAt: null });
    expect(turboLayerAt(again, 10.2)).toBe(false);
    expect(turboLayerAt(again, 10.1 + TURBO_IGNITION_SEC)).toBe(true);
  });

  it('the level rises through the ignition, holds, and fades linearly over 0.3 s', () => {
    const life = turboEnd(turboStart(null, 2), 12);
    expect(turboEnvAt(life, 1.9)).toBe(0);
    expect(turboEnvAt(life, 2 + TURBO_IGNITION_SEC / 2)).toBeCloseTo(0.5, 9);
    expect(turboEnvAt(life, 5)).toBe(1);
    expect(turboEnvAt(life, 12 + TURBO_FADE_SEC / 2)).toBeCloseTo(0.5, 9);
    expect(turboEnvAt(life, 12 + TURBO_FADE_SEC)).toBe(0);
    expect(turboEnvAt(null, 5)).toBe(0);
  });

  it('layer notes start after the ignition and stop at the end of the fade', () => {
    const on = turboStart(null, 0);
    expect(turboLayerAt(on, TURBO_IGNITION_SEC - 0.01)).toBe(false);
    expect(turboLayerAt(on, TURBO_IGNITION_SEC)).toBe(true);
    expect(turboLayerAt(on, 15)).toBe(true);
    const off = turboEnd(on, 15);
    expect(turboLayerAt(off, 15 + TURBO_FADE_SEC - 0.01)).toBe(true);
    expect(turboLayerAt(off, 15 + TURBO_FADE_SEC)).toBe(false);
    // Ended inside the ignition: the layer never joins.
    expect(turboLayerAt(turboEnd(on, 0.1), 0.45)).toBe(false);
  });
});

describe('turbo duck and budget', () => {
  it('ducks the base tune 30 percent at full level', () => {
    expect(TURBO_DUCK).toBe(0.3);
    expect(turboDuck(1)).toBeCloseTo(0.7, 9);
    expect(turboDuck(0)).toBe(1);
    expect(turboDuck(Number.NaN)).toBe(1);
  });

  it('leaves the bed alone when the layer is silent', () => {
    expect(turboBudget(0.8, 0.6, 0.48, 0)).toEqual({ bedScale: 0.6, turboScale: 1 });
  });

  it('a quiet bed with room to spare ducks exactly 30 percent and the layer keeps full gain', () => {
    const r = turboBudget(0.2, 1, 0.69, 1);
    expect(r.bedScale).toBeCloseTo(0.7, 9);
    expect(r.turboScale).toBe(1);
  });

  it('bed plus layer stays inside the room at every level and threat', () => {
    for (const bedSum of [0.13, 0.4, 0.7, 0.88]) {
      for (const room of [0.05, 0.2, 0.33, 0.5, 0.69]) {
        for (const env of [0.25, 0.5, 1]) {
          const bedScale = Math.min(1, room / bedSum);
          const r = turboBudget(bedSum, bedScale, room, env);
          const total = bedSum * r.bedScale + TURBO_TOTAL * r.turboScale * env;
          expect(total).toBeLessThanOrEqual(room + 1e-9);
          expect(r.bedScale).toBeLessThanOrEqual(bedScale * turboDuck(env) + 1e-9);
        }
      }
    }
  });

  it('the layer total fits the summed gain ceiling with the reserves', () => {
    expect(TURBO_TOTAL).toBeCloseTo(TURBO_GAINS.arp + TURBO_GAINS.bass + TURBO_GAINS.hat, 9);
    expect(TURBO_TOTAL).toBeLessThan(0.3);
  });
});

describe('turbo pattern', () => {
  const sec = 0.11;
  it('plays every pitch as a chord tone, two arp notes per step, one bass and one hat', () => {
    for (const h of Object.values(HARMONIES)) {
      for (let inBar = 0; inBar < 16; inBar += 4) {
        const parts = turboChunk(42, 3, inBar, 4, sec, h, 69);
        const arp = parts.find((p) => p.part === 'arp');
        const bass = parts.find((p) => p.part === 'bass');
        const hat = parts.find((p) => p.part === 'hat');
        expect(arp?.hits).toHaveLength(4 * TURBO_ARP_PER_STEP);
        expect(bass?.hits).toHaveLength(4);
        expect(hat?.hits).toHaveLength(4);
        for (const x of [...(arp?.hits ?? []), ...(bass?.hits ?? [])]) expect(inChord(x.midi ?? -1, h)).toBe(true);
        for (const x of hat?.hits ?? []) expect(x.midi).toBeNull();
        // The arp is bright (from the tune root up), the bass two octaves under it.
        for (const x of arp?.hits ?? []) expect(x.midi ?? 0).toBeGreaterThanOrEqual(64);
        for (const x of bass?.hits ?? []) expect(x.midi ?? 99).toBeLessThan(60);
      }
    }
  });

  it('hits on one voice never overlap, and a chunk ends inside its beat', () => {
    const parts = turboChunk(7, 0, 1, turboChunkSteps(1), sec, HARMONIES.F, 67);
    for (const p of parts) {
      for (let i = 1; i < p.hits.length; i++) {
        const a = p.hits[i - 1];
        const b = p.hits[i];
        expect((a?.at ?? 0) + (a?.dur ?? 0)).toBeLessThanOrEqual((b?.at ?? 0) + 1e-9);
      }
      expect(turboPartLength(p)).toBeLessThanOrEqual(3 * sec + 1e-9);
    }
    expect(turboChunkSteps(0)).toBe(TURBO_CHUNK_STEPS);
    expect(turboChunkSteps(5)).toBe(3);
    expect(turboChunkSteps(15)).toBe(1);
  });

  it('is a pure function of (seed, bar): deterministic and JSON serialisable', () => {
    const a = turboChunk(1234, 9, 0, 4, sec, HARMONIES.Am, 69);
    const b = turboChunk(1234, 9, 0, 4, sec, HARMONIES.Am, 69);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    // Bars vary the figure.
    const contours = new Set<string>();
    for (let bar = 0; bar < 16; bar++) contours.add(JSON.stringify(turboChunk(1234, bar, 0, 4, sec, HARMONIES.Am, 69)[0]?.hits.map((x) => x.midi)));
    expect(contours.size).toBeGreaterThan(1);
  });

  it('a pumping bass hit dips by half its length and every hit retriggers from the floor', () => {
    const pts = turboHitEnvelope('bass', { at: 0.2, dur: 0.1, midi: 45, vel: 1 }, 0.1);
    expect(pts[0]).toEqual({ at: 0.2, v: 0.0001, ramp: 'set' });
    expect(pts[1]?.v).toBeCloseTo(0.1, 9);
    expect(pts).toHaveLength(4);
    expect(pts[2]?.v).toBeLessThan(0.1);
    expect(turboHitEnvelope('arp', { at: 0, dur: 0.05, midi: 69, vel: 0.8 }, 0.1)).toHaveLength(3);
  });
});

describe('turbo engine voices', () => {
  const arp = { part: 'arp' as const, time: 0.1, hits: turboChunk(1, 0, 0, 4, 0.11, HARMONIES.Am, 69)[0]?.hits ?? [], gain: 0.08 };

  it('a part is one voice on the closed Turbo bus, in a pulse lead with a tracking low pass', () => {
    const ctx = new FakeContextFx();
    const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
    expect(engine.playTurbo(arp)).toBe(true);
    expect(engine.turboVoiceCount).toBe(1);
    expect(ctx.waves.length).toBeGreaterThan(0);
    const lp = ctx.filters.filter((f) => f.type === 'lowpass');
    expect(lp.some((f) => f.frequency.value <= 5000 && f.frequency.value > 0)).toBe(true);
  });

  it('never steals: a full pool drops the part, and a bed note steals a Turbo voice first', () => {
    const ctx = new FakeContextFx();
    const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
    for (let i = 0; i < MUSIC_VOICE_CAP - 1; i++) engine.play({ layer: 'pad', midi: 60, time: 0.05, dur: 2, gain: 0.1 });
    expect(engine.playTurbo(arp)).toBe(true);
    expect(engine.playTurbo({ ...arp, part: 'bass' })).toBe(false);
    engine.play({ layer: 'pad', midi: 64, time: 0.06, dur: 2, gain: 0.1 });
    expect(engine.steals.turbo).toBe(1);
    expect(engine.steals.bed).toBe(0);
    expect(engine.voiceCount).toBe(MUSIC_VOICE_CAP);
  });

  it('accent room ignores Turbo voices (an accent may take them)', () => {
    const ctx = new FakeContextFx();
    const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
    const before = engine.accentRoom(0.1, 0.3, []);
    engine.playTurbo(arp);
    expect(engine.accentRoom(0.1, 0.3, [])).toBe(before);
    engine.playVoice({ time: 0.1, dur: 0.2, midi: 69, fromMidi: null, gain: 0.1, timbre: TIMBRES.pulse }, 'accent');
    expect(engine.accentRoom(0.1, 0.3, [])).toBe(before - 1);
  });

  it('the gate opens over the ignition and closes with a 0.3 s linear fade that stops every Turbo voice', () => {
    const ctx = new FakeContextFx();
    const engine = createMusicEngine(ctx, new FakeNode(), 0.2);
    const bus = ctx.gains.find((g) => g.gain.value === 0 && g.connected.length === 1);
    engine.turboGate(true, TURBO_IGNITION_SEC);
    engine.playTurbo(arp);
    ctx.currentTime = 0.2;
    engine.turboGate(false, TURBO_FADE_SEC);
    expect(engine.turboVoiceCount).toBe(0);
    const ramps = bus?.gain.calls.filter((c) => c.fn === 'lin') ?? [];
    expect(ramps[0]).toEqual({ fn: 'lin', v: 1, t: TURBO_IGNITION_SEC });
    expect(ramps[1]?.v).toBe(0);
    expect(ramps[1]?.t).toBeCloseTo(0.2 + TURBO_FADE_SEC, 9);
    const o = ctx.oscs[ctx.oscs.length - 1];
    expect(o?.stops.some((t) => Math.abs(t - (0.2 + TURBO_FADE_SEC + 0.02)) < 1e-9)).toBe(true);
  });
});
