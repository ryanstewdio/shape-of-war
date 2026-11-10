// Story scene sound (src/audio/storySfx.ts): cue per type, panel tick, fade on end and skip, dispose.
import { describe, expect, it } from 'vitest';
import { Bus } from '../../src/core/events';
import { cueFor, FADE_SEC, installStorySfx, TICK_HZ, type StoryBackend, type StoryCue, type StoryType } from '../../src/audio/storySfx';

class FakeBackend implements StoryBackend {
  cues: StoryCue[] = [];
  ticks: number[] = [];
  stops: number[] = [];
  play(c: StoryCue): void {
    this.cues.push(c);
  }
  tick(hz: number): void {
    this.ticks.push(hz);
  }
  stop(sec: number): void {
    this.stops.push(sec);
  }
}

function setup(): { bus: Bus; be: FakeBackend; dispose: () => void } {
  const bus = new Bus();
  const be = new FakeBackend();
  return { bus, be, dispose: installStorySfx(bus, be).dispose };
}

function ev(type: StoryType, phase: 'start' | 'panel' | 'end', id = 'g1', panel = 0): { id: string; type: StoryType; panel: number; phase: 'start' | 'panel' | 'end' } {
  return { id, type, panel, phase };
}

describe('story sfx', () => {
  it('plays a rising reveal for opening and briefing', () => {
    for (const t of ['opening', 'briefing'] as const) {
      const { bus, be } = setup();
      bus.emit('ui:story', ev(t, 'start'));
      const c = be.cues[0];
      expect(c?.kind).toBe('reveal');
      if (c?.kind === 'reveal') expect(c.f1).toBeGreaterThan(c.f0);
    }
  });

  it('plays a low minor drone for a guardian, stable per id', () => {
    const { bus, be } = setup();
    bus.emit('ui:story', ev('guardian', 'start', 'boss:a'));
    bus.emit('ui:story', ev('guardian', 'start', 'boss:a'));
    const [a, b] = be.cues;
    expect(a?.kind).toBe('drone');
    expect(a).toEqual(b);
    if (a?.kind === 'drone') {
      const root = a.freqs[0] ?? 0;
      expect(root).toBeLessThan(120);
      expect(a.freqs[1]! / root).toBeCloseTo(Math.pow(2, 3 / 12), 5);
    }
  });

  it('plays a blooming major chord for freed', () => {
    const { bus, be } = setup();
    bus.emit('ui:story', ev('freed', 'start', 'freed:a'));
    const c = be.cues[0];
    expect(c?.kind).toBe('chord');
    if (c?.kind === 'chord') {
      expect(c.bloomSec).toBeGreaterThan(0.5);
      expect(c.freqs[1]! / c.freqs[0]!).toBeCloseTo(Math.pow(2, 4 / 12), 2);
    }
  });

  it('ticks once per panel, nothing else', () => {
    const { bus, be } = setup();
    bus.emit('ui:story', ev('opening', 'panel', 'opening', 1));
    bus.emit('ui:story', ev('opening', 'panel', 'opening', 2));
    expect(be.ticks).toEqual([TICK_HZ, TICK_HZ]);
    expect(be.cues.length).toBe(0);
  });

  it('fades out within 0.3 s on end, which is also what a skip emits', () => {
    const { bus, be } = setup();
    bus.emit('ui:story', ev('guardian', 'start'));
    bus.emit('ui:story', ev('guardian', 'end'));
    expect(be.stops).toEqual([FADE_SEC]);
    expect(FADE_SEC).toBeLessThan(0.3);
  });

  it('keeps every cue gentle', () => {
    for (const t of ['opening', 'briefing', 'guardian', 'freed'] as const) {
      const c = cueFor(t, 'x');
      const voices = c.kind === 'reveal' ? 2 : c.freqs.length;
      expect(c.gain * voices).toBeLessThan(0.2);
    }
  });

  it('dispose removes the listener and silences', () => {
    const { bus, be, dispose } = setup();
    dispose();
    expect(be.stops).toEqual([FADE_SEC]);
    bus.emit('ui:story', ev('opening', 'start'));
    bus.emit('ui:story', ev('opening', 'panel'));
    bus.emit('ui:story', ev('opening', 'end'));
    expect(be.cues.length).toBe(0);
    expect(be.ticks.length).toBe(0);
    expect(be.stops.length).toBe(1);
  });
});
