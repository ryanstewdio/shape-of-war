// Pond ripple sounds (src/audio/rippleSfx.ts): warn alert on 'sim:rippleWarn', splash on
// 'sim:ripple' with gain rising with strength, and dispose removing the listeners.
import { describe, expect, it } from 'vitest';
import {
  installRippleSfx,
  SPLASH_GAIN_MAX,
  SPLASH_GAIN_MIN,
  splashGain,
  WARN_SEC,
  WARN_STEPS,
  warnHzAt,
  type RippleBackend,
} from '../../src/audio/rippleSfx';
import { Bus } from '../../src/core/events';

class FakeBackend implements RippleBackend {
  warns = 0;
  splashes: number[] = [];
  playWarn(): void {
    this.warns++;
  }
  playSplash(gain: number): void {
    this.splashes.push(gain);
  }
}

function setup(): { bus: Bus; be: FakeBackend; ctl: ReturnType<typeof installRippleSfx> } {
  const bus = new Bus();
  const be = new FakeBackend();
  return { bus, be, ctl: installRippleSfx(bus, be) };
}

describe('ripple sfx (pure)', () => {
  it('the alert lasts 0.6 to 0.9 s and climbs', () => {
    expect(WARN_SEC).toBeGreaterThanOrEqual(0.6);
    expect(WARN_SEC).toBeLessThanOrEqual(0.9);
    for (let i = 1; i < WARN_STEPS.length; i++) expect(WARN_STEPS[i]).toBeGreaterThan(WARN_STEPS[i - 1] ?? 0);
    expect(warnHzAt(0)).toBe(WARN_STEPS[0]);
    expect(warnHzAt(WARN_SEC + 5)).toBe(WARN_STEPS[WARN_STEPS.length - 1]);
    expect(warnHzAt(Number.NaN)).toBe(WARN_STEPS[0]);
  });

  it('splash gain rises with strength and is clamped', () => {
    expect(splashGain(0)).toBe(SPLASH_GAIN_MIN);
    expect(splashGain(1)).toBe(SPLASH_GAIN_MAX);
    expect(splashGain(0.7)).toBeGreaterThan(splashGain(0.3));
    expect(splashGain(5)).toBe(SPLASH_GAIN_MAX);
    expect(splashGain(-2)).toBe(SPLASH_GAIN_MIN);
    expect(splashGain(Number.NaN)).toBe(SPLASH_GAIN_MIN);
  });
});

describe('ripple sfx lifecycle', () => {
  it('plays the warn cue on sim:rippleWarn only', () => {
    const { bus, be } = setup();
    bus.emit('sim:rippleWarn', { x: 10, y: 20, inSec: 1, strength: 0.5 });
    expect(be.warns).toBe(1);
    expect(be.splashes).toHaveLength(0);
  });

  it('plays the splash on sim:ripple, louder with strength', () => {
    const { bus, be } = setup();
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 0.2 });
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 0.9 });
    expect(be.warns).toBe(0);
    expect(be.splashes).toHaveLength(2);
    expect(be.splashes[1]).toBeGreaterThan(be.splashes[0] ?? 1);
  });

  it('dispose removes the listeners', () => {
    const { bus, be, ctl } = setup();
    ctl.dispose();
    bus.emit('sim:rippleWarn', { x: 0, y: 0, inSec: 1, strength: 1 });
    bus.emit('sim:ripple', { x: 0, y: 0, strength: 1 });
    expect(be.warns).toBe(0);
    expect(be.splashes).toHaveLength(0);
  });
});
