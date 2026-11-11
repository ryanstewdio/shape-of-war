// Boss shot tick (src/audio/bossTick.ts): cue parameters, strict rate caps, event wiring.
import { describe, expect, it } from 'vitest';
import {
  BLOCKED_PER_SEC,
  installBossTick,
  LANDED_PER_SEC,
  TICK_BLOCKED,
  TICK_LANDED,
  type BossTickBackend,
  type BossTickParams,
} from '../../src/audio/bossTick';
import { CUES } from '../../src/audio/cues';
import { RIPPLE_GAIN_MIN } from '../../src/audio/rippleSfx';
import { Bus } from '../../src/core/events';

class Fake implements BossTickBackend {
  plays: BossTickParams[] = [];
  play(p: BossTickParams): void {
    this.plays.push(p);
  }
}

function setup(): { bus: Bus; be: Fake; clock: { t: number }; ctl: ReturnType<typeof installBossTick> } {
  const bus = new Bus();
  const be = new Fake();
  const clock = { t: 0 };
  return { bus, be, clock, ctl: installBossTick(bus, be, () => clock.t) };
}

const hit = (landed: boolean): { id: 'warden'; x: number; y: number; landed: boolean } => ({ id: 'warden', x: 0, y: 0, landed });

describe('boss tick parameters', () => {
  it('landed tick is under 40 ms and soft', () => {
    expect(TICK_LANDED.dur).toBeLessThan(0.04);
    expect(TICK_LANDED.gain).toBeLessThan(RIPPLE_GAIN_MIN / 2);
    expect(TICK_LANDED.gain).toBeLessThanOrEqual(CUES.bossHit.voices[0]?.gain ?? 1);
  });
  it('blocked thunk is duller and quieter', () => {
    expect(TICK_BLOCKED.cutoff).toBeLessThan(TICK_LANDED.cutoff);
    expect(TICK_BLOCKED.f0).toBeLessThan(TICK_LANDED.f0);
    expect(TICK_BLOCKED.gain).toBeLessThan(TICK_LANDED.gain);
  });
  it('caps are 12 and 6 per second', () => {
    expect(LANDED_PER_SEC).toBe(12);
    expect(BLOCKED_PER_SEC).toBe(6);
  });
});

describe('boss tick controller', () => {
  it('plays the right cue per landed flag', () => {
    const { bus, be } = setup();
    bus.emit('sim:bossHit', hit(true));
    bus.emit('sim:bossHit', hit(false));
    expect(be.plays).toEqual([TICK_LANDED, TICK_BLOCKED]);
  });
  it('drops landed hits past 12 in one second, then recovers', () => {
    const { bus, be, clock } = setup();
    for (let i = 0; i < 40; i++) {
      clock.t = i * 0.02; // 50 Hz of hits over 0.78 s
      bus.emit('sim:bossHit', hit(true));
    }
    expect(be.plays.length).toBe(12);
    clock.t = 1.0;
    bus.emit('sim:bossHit', hit(true));
    expect(be.plays.length).toBe(13);
  });
  it('never exceeds 6 blocked in any second', () => {
    const { bus, be, clock } = setup();
    for (let i = 0; i < 100; i++) {
      clock.t = i * 0.03;
      bus.emit('sim:bossHit', hit(false));
    }
    expect(be.plays.length).toBeLessThanOrEqual(Math.ceil(3 * BLOCKED_PER_SEC));
    expect(be.plays.length).toBeGreaterThanOrEqual(3 * BLOCKED_PER_SEC - 1);
  });
  it('limits are independent', () => {
    const { bus, be } = setup();
    for (let i = 0; i < 20; i++) bus.emit('sim:bossHit', hit(false));
    bus.emit('sim:bossHit', hit(true));
    expect(be.plays.filter((p) => p === TICK_LANDED).length).toBe(1);
  });
  it('dispose removes the listener', () => {
    const { bus, be, ctl } = setup();
    ctl.dispose();
    bus.emit('sim:bossHit', hit(true));
    expect(be.plays.length).toBe(0);
  });
});
