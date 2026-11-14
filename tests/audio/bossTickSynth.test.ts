import { describe, expect, it } from 'vitest';
import { createBossTickBackend } from '../../src/audio/bossTickSynth';
import { TICK_LANDED, TICK_BLOCKED, type BossTickParams } from '../../src/audio/bossTick';

type ParamCall = { value: number; time: number };

class FakeParam {
  readonly sets: ParamCall[] = [];
  readonly ramps: ParamCall[] = [];
  readonly valueWrites: number[] = [];

  set value(value: number) { this.valueWrites.push(value); }
  setValueAtTime(value: number, time: number): void { this.sets.push({ value, time }); }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.ramps.push({ value, time });
  }
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  disconnectCalls = 0;

  connect(target: FakeNode): void { this.connections.push(target); }
  disconnect(): void { this.disconnectCalls += 1; }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type: BiquadFilterType = 'highpass';
  readonly frequency = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'square';
  readonly frequency = new FakeParam();
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  onended: (() => void) | null = null;

  start(time: number): void { this.starts.push(time); }
  stop(time: number): void { this.stops.push(time); }
}

class FakeContext {
  currentTime = 0;
  readonly gains: FakeGain[] = [];
  readonly filters: FakeFilter[] = [];
  readonly oscillators: FakeOscillator[] = [];

  createGain(): FakeGain {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }

  createBiquadFilter(): FakeFilter {
    const node = new FakeFilter();
    this.filters.push(node);
    return node;
  }

  createOscillator(): FakeOscillator {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  }
}

function setup(time: number) {
  const ctx = new FakeContext();
  ctx.currentTime = time;
  const master = new FakeGain();
  const state = { available: true, graphCalls: 0 };
  const backend = createBossTickBackend({
    graph: () => {
      state.graphCalls += 1;
      return state.available ? {
        ctx: ctx as unknown as AudioContext,
        master: master as unknown as GainNode,
      } : null;
    },
  });
  return { ctx, master, state, backend };
}

function entry<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing recorded item at index ${index}`);
  return item;
}

function expectCounts(ctx: FakeContext, count: number): void {
  expect(ctx.gains).toHaveLength(count);
  expect(ctx.filters).toHaveLength(count);
  expect(ctx.oscillators).toHaveLength(count);
}

function expectMasterUntouched(master: FakeGain): void {
  expect(master.connections).toEqual([]);
  expect(master.disconnectCalls).toBe(0);
  expect(master.gain.sets).toEqual([]);
  expect(master.gain.ramps).toEqual([]);
  expect(master.gain.valueWrites).toEqual([]);
}

function expectChain(ctx: FakeContext, master: FakeGain, index: number, p: BossTickParams, time: number) {
  const env = entry(ctx.gains, index);
  const filter = entry(ctx.filters, index);
  const oscillator = entry(ctx.oscillators, index);
  const end = time + p.dur;

  expect(env.gain.sets).toEqual([{ value: p.gain, time }]);
  expect(env.gain.ramps).toHaveLength(1);
  const fade = entry(env.gain.ramps, 0);
  expect(fade.time).toBeCloseTo(end);
  expect(fade.value).toBeGreaterThan(0);
  expect(fade.value).toBeLessThan(p.gain);

  expect(filter.type).toBe('lowpass');
  expect(filter.frequency.sets).toEqual([{ value: p.cutoff, time }]);
  expect(filter.frequency.ramps).toEqual([]);

  expect(oscillator.type).toBe('sine');
  expect(oscillator.frequency.sets).toEqual([{ value: p.f0, time }]);
  expect(oscillator.frequency.ramps).toHaveLength(1);
  const sweep = entry(oscillator.frequency.ramps, 0);
  expect(sweep.value).toBe(p.f1);
  expect(sweep.time).toBeCloseTo(end);
  expect(oscillator.starts).toEqual([time]);
  expect(oscillator.stops).toHaveLength(1);
  const stop = entry(oscillator.stops, 0);
  expect(stop).toBeCloseTo(end + 0.005);
  expect(stop).toBeGreaterThan(sweep.time);

  expect(oscillator.connections).toHaveLength(1);
  expect(entry(oscillator.connections, 0)).toBe(filter);
  expect(filter.connections).toHaveLength(1);
  expect(entry(filter.connections, 0)).toBe(env);
  expect(env.connections).toHaveLength(1);
  expect(entry(env.connections, 0)).toBe(master);
  expectMasterUntouched(master);
  expect(env.disconnectCalls).toBe(0);
  expect(filter.disconnectCalls).toBe(0);
  expect(oscillator.disconnectCalls).toBe(0);
  expect(oscillator.onended).toBeTypeOf('function');

  return { env, filter, oscillator };
}

function end(oscillator: FakeOscillator): void {
  const handler = oscillator.onended;
  if (handler === null) throw new Error('Missing oscillator end handler');
  handler();
}

describe('createBossTickBackend', () => {
  it('does nothing while the graph is unavailable for either tick', () => {
    const { ctx, master, state, backend } = setup(10);
    state.available = false;

    expect(() => backend.play(TICK_LANDED)).not.toThrow();
    expect(state.graphCalls).toBe(1);
    expectCounts(ctx, 0);
    expect(() => backend.play(TICK_BLOCKED)).not.toThrow();
    expect(state.graphCalls).toBe(2);
    expectCounts(ctx, 0);
    expectMasterUntouched(master);
  });

  const cases: { label: string; params: BossTickParams; time: number }[] = [
    { label: 'landed', params: TICK_LANDED, time: 10 },
    { label: 'blocked', params: TICK_BLOCKED, time: 2 },
    { label: 'custom', params: { f0: 440, f1: 220, dur: 0.1, gain: 0.5, cutoff: 1000 }, time: 0 },
  ];

  it.each(cases)('schedules and cleans up the $label tick', ({ params, time }) => {
    const { ctx, master, state, backend } = setup(time);
    backend.play(params);

    expect(state.graphCalls).toBe(1);
    expectCounts(ctx, 1);
    const { env, filter, oscillator } = expectChain(ctx, master, 0, params, time);
    end(oscillator);
    expect(env.disconnectCalls).toBe(1);
    expect(filter.disconnectCalls).toBe(0);
    expect(oscillator.disconnectCalls).toBe(0);
    expectMasterUntouched(master);
  });

  it('keeps successive chains and their cleanup independent', () => {
    const { ctx, master, state, backend } = setup(10);
    backend.play(TICK_LANDED);
    expect(state.graphCalls).toBe(1);
    expectCounts(ctx, 1);
    const first = expectChain(ctx, master, 0, TICK_LANDED, 10);

    ctx.currentTime = 11;
    backend.play(TICK_BLOCKED);
    expect(state.graphCalls).toBe(2);
    expectCounts(ctx, 2);
    expectChain(ctx, master, 0, TICK_LANDED, 10);
    const second = expectChain(ctx, master, 1, TICK_BLOCKED, 11);
    expect(second.env).not.toBe(first.env);
    expect(second.filter).not.toBe(first.filter);
    expect(second.oscillator).not.toBe(first.oscillator);

    end(second.oscillator);
    expect(second.env.disconnectCalls).toBe(1);
    expect(first.env.disconnectCalls).toBe(0);
    expect(first.filter.disconnectCalls).toBe(0);
    expect(second.filter.disconnectCalls).toBe(0);
    expect(first.oscillator.disconnectCalls).toBe(0);
    expect(second.oscillator.disconnectCalls).toBe(0);
    expectMasterUntouched(master);
  });

  it('reads the graph on every play as availability changes', () => {
    const { ctx, master, state, backend } = setup(10);
    state.available = false;
    backend.play(TICK_LANDED);
    expect(state.graphCalls).toBe(1);
    expectCounts(ctx, 0);

    state.available = true;
    backend.play(TICK_LANDED);
    expect(state.graphCalls).toBe(2);
    expectCounts(ctx, 1);
    expectChain(ctx, master, 0, TICK_LANDED, 10);

    state.available = false;
    backend.play(TICK_BLOCKED);
    expect(state.graphCalls).toBe(3);
    expectCounts(ctx, 1);
    expectChain(ctx, master, 0, TICK_LANDED, 10);
  });
});
