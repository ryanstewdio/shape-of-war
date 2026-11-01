// GW2 effects through the real synth with a fake AudioContext: voices start, stop once, never
// stack, and the shared voice cap holds.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MAX_VOICES } from '../../src/audio/cues';
import { installAudio, sfxVoiceCount, unlockAudio } from '../../src/audio/synth';
import { Bus } from '../../src/core/events';
import { Kind } from '../../src/game/world';
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

describe('gw2 through the synth', () => {
  it('the saw buzz is one voice of two sawtooths, stopped once on off', () => {
    ctx.currentTime = 10;
    const from = ctx.oscs.length;
    bus.emit('sim:saw', { on: true });
    bus.emit('sim:saw', { on: true });
    const saws = ctx.oscs.slice(from).filter((o) => o.type === 'sawtooth');
    expect(saws).toHaveLength(2);
    expect(sfxVoiceCount()).toBe(1);
    bus.emit('sim:saw', { on: false });
    for (const o of saws) expect(o.stops).toHaveLength(1);
    expect(sfxVoiceCount()).toBe(0);
  });

  it('a storm of one shots and loops never exceeds the voice cap', () => {
    for (let i = 0; i < 80; i++) {
      ctx.currentTime = 20 + i * 0.01;
      bus.emit('sim:wellArrive', { id: i, x: 0, y: 0, inSec: 1.5 });
      bus.emit('sim:wellSpawn', { id: i, x: 0, y: 0, kind: Kind.SnakeHead });
      bus.emit('sim:wellNova', { id: i, x: 0, y: 0 });
      bus.emit('sim:bossShield', { id: 'warden', up: i % 2 === 0, x: 0, y: 0 });
      expect(sfxVoiceCount()).toBeLessThanOrEqual(MAX_VOICES);
    }
    bus.emit('game:quit');
    expect(sfxVoiceCount()).toBeLessThanOrEqual(MAX_VOICES);
  });
});
