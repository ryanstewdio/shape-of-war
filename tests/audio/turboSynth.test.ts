// R3 Turbo effects through the real synth with a fake AudioContext: one hum that never stacks,
// stopped once on the end, sweeps counted in the shared 24 voice cap, and silence at sfx volume 0.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_VOICES } from '../../src/audio/cues';
import { installAudio, play, setVolume, sfxVoiceCount, unlockAudio } from '../../src/audio/synth';
import { HUM_HZ, HUM_RELEASE } from '../../src/audio/turboSfx';
import { Bus } from '../../src/core/events';
import { FakeContext, FakeNode, FakeParam } from './music/fakeAudio';

class Panner extends FakeNode {
  readonly pan = new FakeParam();
}

class Ctx extends FakeContext {
  static last: Ctx | null = null;
  readonly destination = new FakeNode();
  state: 'running' | 'suspended' = 'running';
  constructor() {
    super();
    Ctx.last = this;
  }
  createStereoPanner(): Panner {
    return new Panner();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    return Promise.resolve();
  }
}

const listeners = { addEventListener: (): void => undefined, removeEventListener: (): void => undefined };
let bus: Bus;
let uninstall: () => void;
let ctx: Ctx;

beforeAll(async () => {
  vi.stubGlobal('AudioContext', Ctx);
  vi.stubGlobal('window', listeners);
  vi.stubGlobal('document', { ...listeners, hidden: false });
  await unlockAudio();
  const c = Ctx.last;
  if (!c) throw new Error('no context');
  ctx = c;
  bus = new Bus();
  uninstall = installAudio({ volume: 70, bus });
});

afterAll(() => {
  uninstall();
  vi.unstubAllGlobals();
});

const turbo = (active: boolean): void => bus.emit('fx:turbo', { active, x: 0, y: 0 });
const isHum = (hz: number): boolean => Math.abs(hz - HUM_HZ) < 2;

describe('turbo through the synth', () => {
  it('start: an ignition sweep and one hum of two low saws; an extension adds no hum', () => {
    ctx.currentTime = 10;
    const from = ctx.oscs.length;
    turbo(true);
    ctx.currentTime = 10.1;
    turbo(true);
    const hums = ctx.oscs.slice(from).filter((o) => o.type === 'sawtooth' && isHum(o.frequency.value));
    expect(hums).toHaveLength(2);
    // The hum (one loop) and two ignition sweeps, the first cut by the second.
    expect(sfxVoiceCount()).toBe(3);
    ctx.currentTime = 11;
    expect(sfxVoiceCount()).toBe(1);
    turbo(false);
    for (const o of hums) {
      expect(o.stops).toHaveLength(1);
      expect(o.stops[0]).toBeCloseTo(11 + HUM_RELEASE + 0.02, 9);
    }
    // The power down sweep counts until it ends.
    expect(sfxVoiceCount()).toBe(1);
    ctx.currentTime = 12;
    expect(sfxVoiceCount()).toBe(0);
  });

  it('a cue storm during Turbo never passes the 24 voice cap', () => {
    ctx.currentTime = 20;
    turbo(true);
    for (let i = 0; i < 60; i++) {
      ctx.currentTime = 20 + i * 0.002;
      play('fire');
      play('enemyKill');
      if (i % 7 === 0) turbo(true);
      expect(sfxVoiceCount()).toBeLessThanOrEqual(MAX_VOICES);
    }
    bus.emit('game:quit');
    ctx.currentTime = 30;
    expect(sfxVoiceCount()).toBe(0);
  });

  it('is silent at sfx volume 0', () => {
    setVolume(0);
    ctx.currentTime = 40;
    const from = ctx.oscs.length;
    turbo(true);
    turbo(false);
    expect(ctx.oscs.length).toBe(from);
    expect(sfxVoiceCount()).toBe(0);
    setVolume(70);
  });
});
