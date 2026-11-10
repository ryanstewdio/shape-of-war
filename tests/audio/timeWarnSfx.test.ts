// Time warning (src/audio/timeWarnSfx.ts): cue per threshold, rising pitch over the last 10, dispose.
import { describe, expect, it } from 'vitest';
import { beepsFor, installTimeWarnSfx, tickHzFor, WARN_GAIN, WARN_GAIN_LOUD, type Beep, type TimeWarnBackend } from '../../src/audio/timeWarnSfx';
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
  it('plays two beeps at 60 and three quicker, higher beeps at 30', () => {
    const { bus, be } = setup();
    bus.emit('ui:timeWarn', { secondsLeft: 60 });
    bus.emit('ui:timeWarn', { secondsLeft: 30 });
    const [a, b] = be.calls;
    expect(a?.length).toBe(2);
    expect(b?.length).toBe(3);
    expect(b![0]!.hz).toBeGreaterThan(a![0]!.hz);
    expect(b![1]!.at - b![0]!.at).toBeLessThan(a![1]!.at - a![0]!.at);
  });

  it('ticks once per second from 10 to 1 with rising pitch', () => {
    const { bus, be } = setup();
    for (let s = 10; s >= 1; s--) bus.emit('ui:timeWarn', { secondsLeft: s });
    expect(be.calls.length).toBe(10);
    expect(be.calls.every((c) => c.length === 1)).toBe(true);
    const hz = be.calls.map((c) => c[0]!.hz);
    for (let i = 1; i < hz.length; i++) expect(hz[i]!).toBeGreaterThan(hz[i - 1]!);
    expect(tickHzFor(1)).toBeGreaterThan(tickHzFor(10));
  });

  it('makes 3, 2, 1 louder, all below boss cue level', () => {
    expect(beepsFor(4)[0]!.gain).toBe(WARN_GAIN);
    for (const s of [3, 2, 1]) expect(beepsFor(s)[0]!.gain).toBe(WARN_GAIN_LOUD);
    expect(WARN_GAIN_LOUD).toBeLessThan(0.2);
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
