import { describe, expect, it } from 'vitest';
import { TICK_GAIN, TICK_SEC } from '../../src/audio/scrollTick';
import { createScrollTickBackend } from '../../src/audio/scrollTickSynth';
import type { Beep } from '../../src/audio/timeWarnSfx';
import { createTimeWarnBackend } from '../../src/audio/timeWarnSynth';

class FakeParam {
  readonly values: { value: number; time: number }[] = [];

  setValueAtTime(value: number, time: number): void {
    this.values.push({ value, time });
  }

  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  disconnects = 0;

  connect(target: FakeNode): void {
    this.connections.push(target);
  }

  disconnect(): void {
    this.disconnects++;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  onended: (() => void) | null = null;

  start(time: number): void {
    this.starts.push(time);
  }

  stop(time: number): void {
    this.stops.push(time);
  }
}

class FakeContext {
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];

  constructor(readonly currentTime: number) {}

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function fakeGraph(currentTime: number, active = true) {
  const ctx = new FakeContext(currentTime);
  const master = new FakeGain();
  const deps = {
    graph: () => active ? {
      ctx: ctx as unknown as AudioContext,
      master: master as unknown as GainNode,
    } : null,
  };
  return { ctx, master, deps };
}

const beeps: readonly Beep[] = [
  { at: 0.1, dur: 0.2, hz: 660, wave: 'triangle', gain: 0.04, attack: 0.02 },
  { at: 0.4, dur: 0.1, hz: 440, wave: 'sine', gain: 0.02, attack: 0.01 },
];

describe('createTimeWarnBackend', () => {
  it('creates no nodes when the graph is null', () => {
    const { ctx, deps } = fakeGraph(5, false);
    createTimeWarnBackend(deps).play(beeps);
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  it('connects and schedules one oscillator and gain per beep', () => {
    const { ctx, master, deps } = fakeGraph(5);
    createTimeWarnBackend(deps).play(beeps);

    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.gains).toHaveLength(2);
    beeps.forEach((beep, i) => {
      const oscillator = ctx.oscillators[i]!;
      const gain = ctx.gains[i]!;
      const time = 5 + beep.at;
      expect(gain.connections).toHaveLength(1);
      expect(gain.connections[0]).toBe(master);
      expect(oscillator.connections).toHaveLength(1);
      expect(oscillator.connections[0]).toBe(gain);
      expect(oscillator.type).toBe(beep.wave);
      expect(oscillator.frequency.values).toEqual([{ value: beep.hz, time }]);
      expect(oscillator.starts).toHaveLength(1);
      expect(oscillator.starts[0]).toBeCloseTo(time, 9);
      expect(oscillator.stops).toHaveLength(1);
      expect(oscillator.stops[0]).toBeCloseTo(time + beep.dur + 0.005, 9);
    });
    expect(ctx.oscillators[0]!.stops[0]).toBeCloseTo(5.305, 9);
  });

  it('disconnects only the ended oscillator\'s gain', () => {
    const { ctx, deps } = fakeGraph(5);
    createTimeWarnBackend(deps).play(beeps);
    expect(ctx.gains.map((gain) => gain.disconnects)).toEqual([0, 0]);
    expect(ctx.oscillators[0]!.onended).toBeTypeOf('function');
    ctx.oscillators[0]!.onended!();
    expect(ctx.gains.map((gain) => gain.disconnects)).toEqual([1, 0]);
    expect(ctx.oscillators[1]!.onended).toBeTypeOf('function');
    ctx.oscillators[1]!.onended!();
    expect(ctx.gains.map((gain) => gain.disconnects)).toEqual([1, 1]);
  });
});

describe('createScrollTickBackend', () => {
  it('creates no nodes when the graph is null', () => {
    const { ctx, deps } = fakeGraph(2, false);
    createScrollTickBackend(deps).tick(440);
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  it('connects and schedules a square tick at the configured gain and duration', () => {
    const { ctx, master, deps } = fakeGraph(2);
    createScrollTickBackend(deps).tick(880);

    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.gains).toHaveLength(1);
    const oscillator = ctx.oscillators[0]!;
    const gain = ctx.gains[0]!;
    expect(gain.connections).toHaveLength(1);
    expect(gain.connections[0]).toBe(master);
    expect(gain.gain.values[0]).toEqual({ value: TICK_GAIN, time: 2 });
    expect(oscillator.connections).toHaveLength(1);
    expect(oscillator.connections[0]).toBe(gain);
    expect(oscillator.type).toBe('square');
    expect(oscillator.frequency.values).toEqual([{ value: 880, time: 2 }]);
    expect(oscillator.starts).toEqual([2]);
    expect(oscillator.stops).toHaveLength(1);
    expect(oscillator.stops[0]).toBeCloseTo(2 + TICK_SEC + 0.005, 9);
  });

  it('disconnects the gain when the oscillator ends', () => {
    const { ctx, deps } = fakeGraph(2);
    createScrollTickBackend(deps).tick(880);
    expect(ctx.gains[0]!.disconnects).toBe(0);
    expect(ctx.oscillators[0]!.onended).toBeTypeOf('function');
    ctx.oscillators[0]!.onended!();
    expect(ctx.gains[0]!.disconnects).toBe(1);
  });
});
