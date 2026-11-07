// Pond ripple sound (src/audio/rippleSfx.ts): no cue on the old warn event, thump plus whoosh on
// 'sim:ripple' with gain rising with strength, about 1.5 s long, and dispose removing the listener.
import { describe, expect, it } from 'vitest';
import {
  installRippleSfx,
  RIPPLE_GAIN_MAX,
  RIPPLE_GAIN_MIN,
  RIPPLE_SEC,
  rippleGain,
  THUMP_F_END,
  THUMP_F_START,
  WHOOSH_F0,
  WHOOSH_F1,
  type RippleBackend,
} from '../../src/audio/rippleSfx';
import { Bus } from '../../src/core/events';

class FakeBackend implements RippleBackend {
  plays: number[] = [];
  playRipple(gain: number): void {
    this.plays.push(gain);
  }
}

function setup(): { bus: Bus; be: FakeBackend; ctl: ReturnType<typeof installRippleSfx> } {
  const bus = new Bus();
  const be = new FakeBackend();
  return { bus, be, ctl: installRippleSfx(bus, be) };
}

describe('ripple sfx (pure)', () => {
  it('lasts about 1.5 s, thump is low and drops, whoosh sweeps down', () => {
    expect(RIPPLE_SEC).toBeGreaterThanOrEqual(1.4);
    expect(RIPPLE_SEC).toBeLessThanOrEqual(1.6);
    expect(THUMP_F_START).toBeLessThanOrEqual(70);
    expect(THUMP_F_END).toBeGreaterThanOrEqual(50);
    expect(THUMP_F_END).toBeLessThan(THUMP_F_START);
    expect(WHOOSH_F1).toBeLessThan(WHOOSH_F0);
  });

  it('gain rises with strength and is clamped', () => {
    expect(rippleGain(0)).toBe(RIPPLE_GAIN_MIN);
    expect(rippleGain(1)).toBe(RIPPLE_GAIN_MAX);
    expect(rippleGain(0.7)).toBeGreaterThan(rippleGain(0.3));
    expect(rippleGain(5)).toBe(RIPPLE_GAIN_MAX);
    expect(rippleGain(-2)).toBe(RIPPLE_GAIN_MIN);
    expect(rippleGain(Number.NaN)).toBe(RIPPLE_GAIN_MIN);
  });
});

describe('ripple sfx lifecycle', () => {
  it('plays the thump and whoosh on sim:ripple, louder with strength', () => {
    const { bus, be } = setup();
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 0.2 });
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 0.9 });
    expect(be.plays).toHaveLength(2);
    expect(be.plays[1]).toBeGreaterThan(be.plays[0] ?? 1);
  });

  it('dispose removes the listener', () => {
    const { bus, be, ctl } = setup();
    ctl.dispose();
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 1 });
    expect(be.plays).toHaveLength(0);
  });
});
