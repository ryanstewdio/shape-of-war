// Scroll tick (src/audio/scrollTick.ts): tick count per distance, rate cap, pitch by progress, dispose.
import { describe, expect, it } from 'vitest';
import { installScrollTick, MAX_TICKS_PER_SEC, TICK_GAIN, TICK_PX, tickHz, type ScrollTickBackend } from '../../src/audio/scrollTick';
import { Bus } from '../../src/core/events';

class FakeBackend implements ScrollTickBackend {
  hz: number[] = [];
  tick(hz: number): void {
    this.hz.push(hz);
  }
}

function setup(): { bus: Bus; be: FakeBackend; clock: { t: number }; dispose: () => void } {
  const bus = new Bus();
  const be = new FakeBackend();
  const clock = { t: 0 };
  const c = installScrollTick(bus, be, () => clock.t);
  return { bus, be, clock, dispose: c.dispose };
}

describe('scroll tick', () => {
  it('ticks once per TICK_PX of distance, either direction', () => {
    const { bus, be, clock } = setup();
    for (let i = 0; i < 10; i++) {
      clock.t += 1;
      bus.emit('ui:scroll', { delta: i % 2 === 0 ? 24 : -24, progress: 0.5 });
    }
    expect(be.hz.length).toBe(5);
    expect(TICK_PX).toBe(48);
  });

  it('does not tick below the distance', () => {
    const { bus, be } = setup();
    bus.emit('ui:scroll', { delta: 47, progress: 0 });
    expect(be.hz.length).toBe(0);
  });

  it('caps the rate and drops the extra distance', () => {
    const { bus, be, clock } = setup();
    // 100 big scrolls inside one second: at most 8 ticks.
    for (let i = 0; i < 100; i++) {
      clock.t = i * 0.01;
      bus.emit('ui:scroll', { delta: 96, progress: 0.5 });
    }
    expect(be.hz.length).toBeLessThanOrEqual(MAX_TICKS_PER_SEC);
    expect(be.hz.length).toBeGreaterThan(0);
    // Dropped, not queued: a quiet frame later makes no catch-up tick.
    const n = be.hz.length;
    clock.t = 5;
    bus.emit('ui:scroll', { delta: 1, progress: 0.5 });
    expect(be.hz.length).toBe(n);
  });

  it('pitch rises with progress, about one octave, on the pentatonic scale', () => {
    expect(tickHz(1) / tickHz(0)).toBeCloseTo(2, 5);
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const hz = tickHz(p);
      expect(hz).toBeGreaterThanOrEqual(prev);
      prev = hz;
    }
    const steps = new Set<number>();
    for (let p = 0; p <= 1; p += 0.01) steps.add(Math.round(tickHz(p)));
    expect(steps.size).toBe(6);
    expect(tickHz(Number.NaN)).toBe(tickHz(0));
  });

  it('plays higher at the bottom than the top', () => {
    const { bus, be, clock } = setup();
    clock.t = 1;
    bus.emit('ui:scroll', { delta: 48, progress: 0 });
    clock.t = 2;
    bus.emit('ui:scroll', { delta: 48, progress: 1 });
    expect(be.hz[1]).toBeGreaterThan(be.hz[0] ?? Infinity);
  });

  it('is quiet', () => {
    expect(TICK_GAIN).toBeLessThan(0.05);
  });

  it('dispose removes the listener', () => {
    const { bus, be, dispose } = setup();
    dispose();
    bus.emit('ui:scroll', { delta: 480, progress: 0.5 });
    expect(be.hz.length).toBe(0);
  });
});
