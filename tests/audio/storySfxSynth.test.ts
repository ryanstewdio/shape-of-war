import { describe, expect, it } from 'vitest';
import { createStoryBackend } from '../../src/audio/storySfxSynth';
import { cueFor, TICK_HZ, TICK_SEC, TICK_GAIN, REVEAL_F0, REVEAL_SEC, CHORD_HZ, CHORD_SEC } from '../../src/audio/storySfx';

class FakeParam {
  value = 1;
  sets: [value: number, time: number][] = [];
  ramps: [value: number, time: number][] = [];
  cancellations: number[] = [];

  setValueAtTime(value: number, time: number): void {
    this.sets.push([value, time]);
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.ramps.push([value, time]);
  }

  cancelScheduledValues(time: number): void {
    this.cancellations.push(time);
  }
}

class FakeGain {
  gain = new FakeParam();
  connections: FakeGain[] = [];
  disconnects = 0;

  connect(destination: FakeGain): void {
    this.connections.push(destination);
  }

  disconnect(): void {
    this.disconnects++;
  }
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  connections: FakeGain[] = [];
  starts: number[] = [];
  stops: number[] = [];
  onended: (() => void) | null = null;
  throwOnStop = false;

  connect(destination: FakeGain): void {
    this.connections.push(destination);
  }

  start(time: number): void {
    this.starts.push(time);
  }

  stop(time: number): void {
    this.stops.push(time);
    if (this.throwOnStop) throw new Error('Already stopped');
  }
}

class FakeContext {
  currentTime = 10;
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];

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

function setup(available = true) {
  const ctx = new FakeContext();
  // The master belongs to the graph, not to the backend's created gains.
  const master = new FakeGain();
  const backend = createStoryBackend({
    graph: () => available ? {
      ctx: ctx as unknown as AudioContext,
      master: master as unknown as GainNode,
    } : null,
  });
  return { ctx, master, backend };
}

describe('story Web Audio backend', () => {
  it('does nothing when the graph is unavailable', () => {
    const { ctx, backend } = setup(false);

    expect(() => backend.play(cueFor('opening', 'a'))).not.toThrow();
    expect(() => backend.tick(TICK_HZ)).not.toThrow();
    expect(() => backend.stop(0.25)).not.toThrow();

    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.gains).toHaveLength(0);
  });

  it('plays the reveal voices through separate envelopes and one master bus', () => {
    const { ctx, master, backend } = setup();
    backend.play(cueFor('opening', 'a'));

    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.gains).toHaveLength(3);
    const [bus, firstEnvelope, secondEnvelope] = ctx.gains;
    expect(bus!.gain.sets[0]).toEqual([1, 10]);
    expect(bus!.connections).toHaveLength(1);
    expect(bus!.connections[0]).toBe(master);
    expect(firstEnvelope).not.toBe(secondEnvelope);

    const types = ['sine', 'triangle'];
    const frequencies = [REVEAL_F0, REVEAL_F0 * 2];
    ctx.oscillators.forEach((oscillator, index) => {
      expect(oscillator.type).toBe(types[index]);
      expect(oscillator.frequency.sets[0]).toEqual([frequencies[index], 10]);
      expect(oscillator.starts).toEqual([10]);
      expect(oscillator.stops).toHaveLength(1);
      expect(oscillator.stops[0]).toBeCloseTo(10 + REVEAL_SEC + 0.05);
      const envelope = ctx.gains[index + 1]!;
      expect(oscillator.connections).toHaveLength(1);
      expect(oscillator.connections[0]).toBe(envelope);
      expect(envelope.connections).toHaveLength(1);
      expect(envelope.connections[0]).toBe(bus);
      expect(envelope.connections).not.toContain(master);
    });
  });

  it('plays one triangle voice per guardian frequency', () => {
    const { ctx, backend } = setup();
    const cue = cueFor('guardian', 'g1');
    if (cue.kind !== 'drone') throw new Error('Expected guardian drone fixture');
    backend.play(cue);

    expect(ctx.oscillators).toHaveLength(cue.freqs.length);
    ctx.oscillators.forEach((oscillator, index) => {
      expect(oscillator.type).toBe('triangle');
      expect(oscillator.frequency.sets[0]).toEqual([cue.freqs[index], ctx.currentTime]);
    });
  });

  it('plays and schedules one sine voice per freed chord frequency', () => {
    const { ctx, backend } = setup();
    backend.play(cueFor('freed', 'f1'));

    expect(ctx.oscillators).toHaveLength(CHORD_HZ.length);
    ctx.oscillators.forEach((oscillator, index) => {
      expect(oscillator.type).toBe('sine');
      expect(oscillator.frequency.sets[0]).toEqual([CHORD_HZ[index], ctx.currentTime]);
      expect(oscillator.starts).toEqual([ctx.currentTime]);
      expect(oscillator.stops).toHaveLength(1);
      expect(oscillator.stops[0]).toBeCloseTo(ctx.currentTime + CHORD_SEC + 0.05);
    });
  });

  it('routes a short sine tick directly to master', () => {
    const { ctx, master, backend } = setup();
    ctx.currentTime = 2;
    backend.tick(880);

    expect(ctx.oscillators).toHaveLength(1);
    expect(ctx.gains).toHaveLength(1);
    const oscillator = ctx.oscillators[0]!;
    const envelope = ctx.gains[0]!;
    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.sets[0]).toEqual([880, 2]);
    expect(oscillator.starts).toEqual([2]);
    expect(oscillator.stops).toHaveLength(1);
    expect(oscillator.stops[0]).toBeCloseTo(2 + TICK_SEC + 0.02);
    expect(oscillator.connections).toHaveLength(1);
    expect(oscillator.connections[0]).toBe(envelope);
    expect(envelope.connections).toHaveLength(1);
    expect(envelope.connections[0]).toBe(master);
    expect(envelope.gain.sets.map(([value]) => value)).toContain(TICK_GAIN);
  });

  it('releases every previous voice when a cue replaces it', () => {
    const { ctx, backend } = setup();
    backend.play(cueFor('opening', 'a'));
    const previous = [...ctx.oscillators];
    const bus = ctx.gains[0]!;

    backend.play(cueFor('freed', 'f1'));

    expect(bus.gain.cancellations).toEqual([ctx.currentTime]);
    previous.forEach((oscillator) => {
      expect(oscillator.stops).toHaveLength(2);
      expect(oscillator.stops[1]).toBeCloseTo(ctx.currentTime + 0.07);
    });
    expect(ctx.oscillators).toHaveLength(previous.length + CHORD_HZ.length);
    ctx.oscillators.slice(previous.length).forEach((oscillator) => {
      expect(oscillator.stops).toHaveLength(1);
    });
  });

  it('stops every live voice, disconnects its bus on end, and stops only once', () => {
    const { ctx, backend } = setup();
    backend.play(cueFor('opening', 'a'));
    const bus = ctx.gains[0]!;

    expect(() => backend.stop(0.25)).not.toThrow();

    expect(bus.gain.cancellations).toEqual([ctx.currentTime]);
    ctx.oscillators.forEach((oscillator) => {
      expect(oscillator.stops).toHaveLength(2);
      expect(oscillator.stops[1]).toBeCloseTo(ctx.currentTime + 0.27);
    });
    expect(bus.disconnects).toBe(0);
    const onended = ctx.oscillators[0]!.onended;
    expect(onended).toBeTypeOf('function');
    onended!();
    expect(bus.disconnects).toBe(1);

    const stops = ctx.oscillators.map((oscillator) => [...oscillator.stops]);
    expect(() => backend.stop(0.25)).not.toThrow();
    expect(ctx.oscillators.map((oscillator) => oscillator.stops)).toEqual(stops);
    expect(bus.gain.cancellations).toEqual([ctx.currentTime]);
    expect(bus.disconnects).toBe(1);
  });

  it('continues releasing all other voices when one stop throws', () => {
    const { ctx, backend } = setup();
    backend.play(cueFor('freed', 'f1'));
    ctx.oscillators[0]!.throwOnStop = true;

    expect(() => backend.stop(0.25)).not.toThrow();

    expect(ctx.oscillators).toHaveLength(CHORD_HZ.length);
    ctx.oscillators.forEach((oscillator) => {
      expect(oscillator.stops).toHaveLength(2);
      expect(oscillator.stops[1]).toBeCloseTo(ctx.currentTime + 0.27);
    });
  });
});
