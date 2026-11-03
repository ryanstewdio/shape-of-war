// R3 Turbo sound effects (src/audio/turboSfx.ts): the pure sweep and hum parameters, and the
// controller lifecycle on 'fx:turbo' (start, extend, end, no stacking, leaving play, volume 0).
import { describe, expect, it } from 'vitest';
import {
  HUM_GAIN,
  HUM_HZ,
  HUM_RELEASE,
  HUM_THROB_DEPTH,
  humPair,
  humThrobAt,
  IGNITION_SEC,
  installTurboSfx,
  POWER_DOWN_SEC,
  sweepGainAt,
  sweepHzAt,
  sweepNoise,
  sweepParams,
  SWEEP_CUT_SEC,
  type TurboBackend,
  type TurboHandle,
  type TurboSweep,
} from '../../src/audio/turboSfx';
import { NOISE_LP_HZ } from '../../src/audio/tone';
import { Bus } from '../../src/core/events';

class FakeHandle implements TurboHandle {
  stops: number[] = [];
  constructor(readonly what: string) {}
  stop(releaseSec: number): void {
    this.stops.push(releaseSec);
  }
  get live(): boolean {
    return this.stops.length === 0;
  }
}

class FakeBackend implements TurboBackend {
  available = true;
  hums: FakeHandle[] = [];
  sweeps: FakeHandle[] = [];
  startHum(): TurboHandle | null {
    if (!this.available) return null;
    const h = new FakeHandle('hum');
    this.hums.push(h);
    return h;
  }
  playSweep(kind: TurboSweep): TurboHandle | null {
    if (!this.available) return null;
    const h = new FakeHandle(kind);
    this.sweeps.push(h);
    return h;
  }
  liveHums(): number {
    return this.hums.filter((h) => h.live).length;
  }
}

function setup(): { bus: Bus; be: FakeBackend; turbo: (active: boolean) => void; ctl: ReturnType<typeof installTurboSfx> } {
  const bus = new Bus();
  const be = new FakeBackend();
  const ctl = installTurboSfx(bus, be);
  return { bus, be, ctl, turbo: (active) => bus.emit('fx:turbo', { active, x: 0, y: 0 }) };
}

describe('turbo sweeps and hum (pure)', () => {
  it('the ignition rises over 0.4 s and the power down falls', () => {
    expect(IGNITION_SEC).toBe(0.4);
    const ig = sweepParams('ignition');
    const pd = sweepParams('powerDown');
    expect(ig.dur).toBe(0.4);
    expect(ig.f1).toBeGreaterThan(ig.f0);
    expect(pd.dur).toBe(POWER_DOWN_SEC);
    expect(pd.f1).toBeLessThan(pd.f0);
    for (let k = 1; k <= 10; k++) {
      expect(sweepHzAt('ignition', (k * ig.dur) / 10)).toBeGreaterThan(sweepHzAt('ignition', ((k - 1) * ig.dur) / 10));
      expect(sweepHzAt('powerDown', (k * pd.dur) / 10)).toBeLessThan(sweepHzAt('powerDown', ((k - 1) * pd.dur) / 10));
    }
    expect(sweepHzAt('ignition', 0)).toBe(ig.f0);
    expect(sweepHzAt('ignition', 5)).toBeCloseTo(ig.f1, 6);
    expect(sweepNoise('ignition').f1).toBeGreaterThan(sweepNoise('ignition').f0);
    expect(sweepNoise('powerDown').f1).toBeLessThan(sweepNoise('powerDown').f0);
    // Soft highs: the noise stays under the band limit.
    for (const k of ['ignition', 'powerDown'] as const) expect(Math.max(sweepNoise(k).f0, sweepNoise(k).f1)).toBeLessThanOrEqual(NOISE_LP_HZ);
  });

  it('sweep levels stay inside their gain and are silent outside their span', () => {
    for (const k of ['ignition', 'powerDown'] as const) {
      const p = sweepParams(k);
      for (let i = 0; i <= 20; i++) {
        const g = sweepGainAt(k, (i * p.dur) / 20);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(p.gain + 1e-12);
      }
      expect(sweepGainAt(k, -0.1)).toBe(0);
      expect(sweepGainAt(k, p.dur + 0.1)).toBe(0);
    }
    // The ignition swells: louder near its top than at its start.
    expect(sweepGainAt('ignition', 0.3)).toBeGreaterThan(sweepGainAt('ignition', 0.02));
    expect(sweepGainAt('powerDown', 0.4)).toBeLessThan(sweepGainAt('powerDown', 0.02));
  });

  it('the hum is low, detuned and subtle, its throb within its depth', () => {
    const [a, b] = humPair();
    expect(a).toBeLessThan(HUM_HZ);
    expect(b).toBeGreaterThan(HUM_HZ);
    expect(HUM_GAIN).toBeLessThanOrEqual(0.04);
    for (let i = 0; i < 50; i++) {
      const v = humThrobAt(i * 0.013);
      expect(v).toBeGreaterThanOrEqual(1 - HUM_THROB_DEPTH - 1e-12);
      expect(v).toBeLessThanOrEqual(1 + 1e-12);
    }
  });
});

describe('turbo sfx lifecycle', () => {
  it('start: one ignition sweep and one hum', () => {
    const { be, ctl, turbo } = setup();
    turbo(true);
    expect(be.sweeps.map((s) => s.what)).toEqual(['ignition']);
    expect(be.liveHums()).toBe(1);
    expect(ctl.active()).toBe(true);
    expect(ctl.humCount()).toBe(1);
  });

  it('extend or retrigger: the ignition restarts cleanly, the hum never stacks', () => {
    const { be, ctl, turbo } = setup();
    turbo(true);
    turbo(true);
    turbo(true);
    expect(be.hums).toHaveLength(1);
    expect(be.liveHums()).toBe(1);
    expect(be.sweeps).toHaveLength(3);
    // Every earlier sweep was cut, so one sweep sounds at a time.
    expect(be.sweeps[0]?.stops).toEqual([SWEEP_CUT_SEC]);
    expect(be.sweeps[1]?.stops).toEqual([SWEEP_CUT_SEC]);
    expect(be.sweeps[2]?.live).toBe(true);
    expect(ctl.humCount()).toBe(1);
  });

  it('end: the hum fades over 0.3 s and the power down plays once', () => {
    const { be, ctl, turbo } = setup();
    turbo(true);
    turbo(false);
    turbo(false);
    expect(be.hums[0]?.stops).toEqual([HUM_RELEASE]);
    expect(HUM_RELEASE).toBe(0.3);
    expect(be.sweeps.map((s) => s.what)).toEqual(['ignition', 'powerDown']);
    expect(ctl.active()).toBe(false);
    expect(ctl.humCount()).toBe(0);
  });

  it('an end with no Turbo running is silent', () => {
    const { be, turbo } = setup();
    turbo(false);
    expect(be.sweeps).toHaveLength(0);
    expect(be.hums).toHaveLength(0);
  });

  it('a retrigger after the end starts one fresh hum', () => {
    const { be, turbo } = setup();
    turbo(true);
    turbo(false);
    turbo(true);
    expect(be.hums).toHaveLength(2);
    expect(be.liveHums()).toBe(1);
    // The power down is cut by the new ignition.
    expect(be.sweeps[1]?.what).toBe('powerDown');
    expect(be.sweeps[1]?.stops).toEqual([SWEEP_CUT_SEC]);
  });

  it('pause stops the hum and resume brings it back while Turbo runs', () => {
    const { bus, be, turbo } = setup();
    turbo(true);
    bus.emit('game:pause');
    expect(be.liveHums()).toBe(0);
    bus.emit('game:resume');
    expect(be.liveHums()).toBe(1);
    turbo(false);
    bus.emit('game:pause');
    bus.emit('game:resume');
    expect(be.liveHums()).toBe(0);
  });

  it('leaving play stops everything quietly, with no power down', () => {
    for (const leave of ['quit', 'over', 'start', 'menu'] as const) {
      const { bus, be, ctl, turbo } = setup();
      turbo(true);
      if (leave === 'quit') bus.emit('game:quit');
      else if (leave === 'over') bus.emit('game:over', { score: 0, stars: 0, levelIndex: 0, mode: 'adventure' });
      else if (leave === 'start') bus.emit('game:start', { mode: 'adventure', levelIndex: 0 });
      else bus.emit('ui:screen', { screen: 'menu' });
      expect(be.liveHums()).toBe(0);
      expect(ctl.active()).toBe(false);
      turbo(false);
      expect(be.sweeps.map((s) => s.what)).toEqual(['ignition']);
    }
  });

  it('silent when audio is unavailable or the sfx volume is 0 (the backend returns null)', () => {
    const { be, ctl, turbo } = setup();
    be.available = false;
    expect(() => {
      turbo(true);
      turbo(true);
      turbo(false);
    }).not.toThrow();
    expect(be.hums).toHaveLength(0);
    expect(be.sweeps).toHaveLength(0);
    expect(ctl.humCount()).toBe(0);
  });

  it('dispose stops the hum and unsubscribes', () => {
    const { be, ctl, turbo } = setup();
    turbo(true);
    ctl.dispose();
    expect(be.liveHums()).toBe(0);
    turbo(true);
    expect(be.hums).toHaveLength(1);
  });
});
