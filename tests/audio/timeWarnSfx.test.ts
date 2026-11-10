// Soft time warning (src/audio/timeWarnSfx.ts): chimes at 60 and 30, quiet ticks from 5 to 1, dispose.
import { describe, expect, it } from 'vitest';
import {
  beepsFor,
  CHIME_GAIN,
  installTimeWarnSfx,
  TICK_GAIN,
  TICK_GAIN_LOUD,
  tickHzFor,
  type Beep,
  type TimeWarnBackend,
} from '../../src/audio/timeWarnSfx';
import { Bus } from '../../src/core/events';

class FakeBackend implements TimeWarnBackend {
  calls: (readonly Beep[])[] = [];
  play(beeps: readonly Beep[]): void {
    this.calls.push(beeps);
  }
}

function setup(): { bus: Bus; be: FakeBackend; dispose: () => void } {
  const bus = new Bus();
  const be = new FakeBackend();
  const c = installTimeWarnSfx(bus, be);
  return { bus, be, dispose: c.dispose };
}

describe('time warn sfx', () => {
  it('plays one gentle low chime each at 60 and 30', () => {
    const { bus, be } = setup();
    bus.emit('ui:timeWarn', { secondsLeft: 60 });
    bus.emit('ui:timeWarn', { secondsLeft: 30 });
    expect(be.calls.length).toBe(2);
    for (const c of be.calls) {
      expect(c.length).toBe(1);
      const n = c[0]!;
      expect(n.hz).toBeGreaterThanOrEqual(330);
      expect(n.hz).toBeLessThanOrEqual(440);
      expect(['sine', 'triangle']).toContain(n.wave);
      expect(n.gain).toBeLessThanOrEqual(0.04);
      expect(n.dur).toBeLessThan(0.6);
    }
  });

  it('is silent from 10 to 6', () => {
    const { bus, be } = setup();
    for (let s = 10; s >= 6; s--) bus.emit('ui:timeWarn', { secondsLeft: s });
    expect(be.calls.length).toBe(0);
  });

  it('ticks once per second from 5 to 1, low and soft', () => {
    const { bus, be } = setup();
    for (let s = 5; s >= 1; s--) bus.emit('ui:timeWarn', { secondsLeft: s });
    expect(be.calls.length).toBe(5);
    expect(be.calls.every((c) => c.length === 1)).toBe(true);
    const hz = be.calls.map((c) => c[0]!.hz);
    for (const h of hz) {
      expect(h).toBeGreaterThanOrEqual(220);
      expect(h).toBeLessThanOrEqual(330);
    }
    for (let i = 1; i < hz.length; i++) expect(hz[i]!).toBeGreaterThan(hz[i - 1]!);
    for (const c of be.calls) {
      expect(c[0]!.dur).toBeLessThanOrEqual(0.1);
      expect(c[0]!.attack).toBeGreaterThan(0);
      expect(c[0]!.wave).toBe('sine');
    }
    expect(tickHzFor(1)).toBeGreaterThan(tickHzFor(5));
  });

  it('makes 3, 2, 1 barely louder, all far below boss cue level', () => {
    expect(beepsFor(5)[0]!.gain).toBe(TICK_GAIN);
    expect(beepsFor(4)[0]!.gain).toBe(TICK_GAIN);
    for (const s of [3, 2, 1]) expect(beepsFor(s)[0]!.gain).toBe(TICK_GAIN_LOUD);
    expect(TICK_GAIN_LOUD).toBeGreaterThan(TICK_GAIN);
    expect(TICK_GAIN_LOUD / TICK_GAIN).toBeLessThan(1.5);
    expect(Math.max(CHIME_GAIN, TICK_GAIN_LOUD)).toBeLessThanOrEqual(0.04);
  });

  it('is silent at 0 and at non-threshold times', () => {
    const { bus, be } = setup();
    for (const s of [0, 11, 45, 59, 61, 120, -1, NaN]) bus.emit('ui:timeWarn', { secondsLeft: s });
    expect(be.calls.length).toBe(0);
  });

  it('stops after dispose', () => {
    const { bus, be, dispose } = setup();
    dispose();
    bus.emit('ui:timeWarn', { secondsLeft: 60 });
    expect(be.calls.length).toBe(0);
  });
});
