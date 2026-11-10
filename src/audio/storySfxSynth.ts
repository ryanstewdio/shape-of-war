// Web Audio backend for the story scene sound (storySfx.ts): oscillators only, every voice feeds
// one story bus into the sfx master, so the effects volume and mute apply. Silent while the
// context is not running. stop() fades the story bus and releases every source.
import { TICK_GAIN, TICK_SEC, type StoryBackend, type StoryCue } from './storySfx';

const FLOOR = 0.0001;

export interface StoryDeps {
  graph(): { ctx: AudioContext; master: GainNode } | null;
}

interface Live {
  readonly bus: GainNode;
  readonly sources: OscillatorNode[];
}

export function createStoryBackend(deps: StoryDeps): StoryBackend {
  let live: Live | null = null;

  function release(sec: number): void {
    const l = live;
    live = null;
    const g = deps.graph();
    if (!l || !g) return;
    const t = g.ctx.currentTime;
    l.bus.gain.cancelScheduledValues(t);
    l.bus.gain.setValueAtTime(Math.max(l.bus.gain.value, FLOOR), t);
    l.bus.gain.exponentialRampToValueAtTime(FLOOR, t + sec);
    for (const s of l.sources) {
      try {
        s.stop(t + sec + 0.02);
      } catch {
        // Already stopped.
      }
    }
    const done = l.sources[0];
    if (done) done.onended = (): void => l.bus.disconnect();
  }

  function osc(c: AudioContext, type: OscillatorType, hz: number, t: number, dest: AudioNode, level: number, attack: number, sec: number): OscillatorNode {
    const env = c.createGain();
    env.gain.setValueAtTime(FLOOR, t);
    env.gain.exponentialRampToValueAtTime(level, t + attack);
    env.gain.setValueAtTime(level, t + Math.max(attack, sec - 0.5));
    env.gain.exponentialRampToValueAtTime(FLOOR, t + sec);
    env.connect(dest);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    o.connect(env);
    return o;
  }

  return {
    play(cue: StoryCue): void {
      release(0.05);
      const g = deps.graph();
      if (!g) return;
      const c = g.ctx;
      const t = c.currentTime;
      const bus = c.createGain();
      bus.gain.setValueAtTime(1, t);
      bus.connect(g.master);
      const sources: OscillatorNode[] = [];
      if (cue.kind === 'reveal') {
        const o = osc(c, 'sine', cue.f0, t, bus, cue.gain, 0.25, cue.sec);
        o.frequency.exponentialRampToValueAtTime(cue.f1, t + cue.sec * 0.6);
        sources.push(o);
        const o2 = osc(c, 'triangle', cue.f0 * 2, t, bus, cue.gain * 0.3, 0.3, cue.sec);
        o2.frequency.exponentialRampToValueAtTime(cue.f1 * 2, t + cue.sec * 0.6);
        sources.push(o2);
      } else {
        const bloom = cue.kind === 'chord' ? cue.bloomSec : 0.8;
        const wave: OscillatorType = cue.kind === 'chord' ? 'sine' : 'triangle';
        for (const hz of cue.freqs) sources.push(osc(c, wave, hz, t, bus, cue.gain, bloom, cue.sec));
      }
      for (const s of sources) {
        s.start(t);
        s.stop(t + cue.sec + 0.05);
      }
      live = { bus, sources };
    },
    tick(hz: number): void {
      const g = deps.graph();
      if (!g) return;
      const c = g.ctx;
      const t = c.currentTime;
      const o = osc(c, 'sine', hz, t, g.master, TICK_GAIN, 0.01, TICK_SEC);
      o.start(t);
      o.stop(t + TICK_SEC + 0.02);
    },
    stop(sec: number): void {
      release(sec);
    },
  };
}
