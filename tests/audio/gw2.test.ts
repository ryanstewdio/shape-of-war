// GW2 sound effects: pure envelope and parameter helpers, and the event wiring (each event
// starts and stops the right voice, nothing stacks).
import { describe, expect, it } from 'vitest';
import {
  ARRIVE_SEC,
  NOVA_FILTER_HI,
  NOVA_FILTER_LO,
  NOVA_MAX,
  NOVA_PAN_DEPTH,
  NOVA_PAN_PERIOD,
  NOVA_GAIN,
  ARRIVE_GAIN,
  ARRIVE_HI_HZ,
  novaLevelFor,
  NOVA_RELEASE,
  RESET_FADE,
  SAW_BASE_HZ,
  SAW_GAIN,
  SAW_RAMP_IN,
  SAW_RAMP_OUT,
  SAW_WOBBLE_HZ,
  SHIELD_RELEASE,
  WELL_KIND,
  arriveGainAt,
  installGw2,
  novaFilterAt,
  novaPanAt,
  rampLevel,
  sawGainAt,
  sawPair,
  sawSweepHz,
  type Gw2Backend,
  type LoopKind,
  type OneShot,
} from '../../src/audio/gw2';
import { Bus } from '../../src/core/events';
import { Kind } from '../../src/game/world';

describe('gw2 pure helpers', () => {
  it('rampLevel clamps and tolerates a zero duration', () => {
    expect(rampLevel(-1, 1)).toBe(0);
    expect(rampLevel(0.5, 1)).toBe(0.5);
    expect(rampLevel(3, 1)).toBe(1);
    expect(rampLevel(0, 0)).toBe(1);
  });

  it('saw gain ramps in over 60 ms and out over 120 ms', () => {
    expect(SAW_RAMP_IN).toBe(0.06);
    expect(SAW_RAMP_OUT).toBe(0.12);
    expect(sawGainAt(true, 0)).toBe(0);
    expect(sawGainAt(true, 0.03)).toBeCloseTo(SAW_GAIN / 2, 6);
    expect(sawGainAt(true, 1)).toBe(SAW_GAIN);
    expect(sawGainAt(false, 0)).toBe(SAW_GAIN);
    expect(sawGainAt(false, 0.06)).toBeCloseTo(SAW_GAIN / 2, 6);
    expect(sawGainAt(false, 0.12)).toBeCloseTo(0, 9);
  });

  it('the saw pair is detuned around 110 Hz and the wobble is 28 Hz', () => {
    const [lo, hi] = sawPair();
    expect(lo).toBeLessThan(SAW_BASE_HZ);
    expect(hi).toBeGreaterThan(SAW_BASE_HZ);
    expect(Math.sqrt(lo * hi)).toBeCloseTo(SAW_BASE_HZ, 6);
    expect(SAW_WOBBLE_HZ).toBe(28);
  });

  it('the saw band pass sweep stays in range and repeats', () => {
    for (let t = -2; t < 4; t += 0.05) {
      const f = sawSweepHz(t);
      expect(f).toBeGreaterThanOrEqual(300 - 1e-9);
      expect(f).toBeLessThanOrEqual(900 + 1e-9);
    }
    expect(sawSweepHz(0.1)).toBeCloseTo(sawSweepHz(1.0), 6);
  });

  it('the nova pan sweeps a full cycle in one period and the filter rises then holds', () => {
    expect(novaPanAt(0)).toBeCloseTo(0, 9);
    expect(novaPanAt(NOVA_PAN_PERIOD / 4)).toBeCloseTo(NOVA_PAN_DEPTH, 9);
    expect(novaPanAt(NOVA_PAN_PERIOD)).toBeCloseTo(0, 6);
    expect(novaFilterAt(0)).toBeCloseTo(NOVA_FILTER_LO, 6);
    expect(novaFilterAt(2)).toBeGreaterThan(novaFilterAt(1));
    expect(novaFilterAt(100)).toBeCloseTo(NOVA_FILTER_HI, 6);
  });

  it('the arrival whoosh rises, ends in a soft thud tail and is silent outside 1.5 s', () => {
    expect(ARRIVE_SEC).toBe(1.5);
    expect(arriveGainAt(-0.1)).toBe(0);
    expect(arriveGainAt(ARRIVE_SEC + 0.1)).toBe(0);
    expect(arriveGainAt(0.9)).toBeGreaterThan(arriveGainAt(0.3));
    expect(arriveGainAt(ARRIVE_SEC)).toBeCloseTo(0, 9);
  });

  it('the roar and whoosh are quieter and darker than the retest build', () => {
    expect(NOVA_GAIN).toBeCloseTo(0.16 * 0.55, 9);
    expect(NOVA_FILTER_HI).toBe(1200);
    expect(NOVA_PAN_DEPTH).toBe(0.5);
    expect(novaFilterAt(100)).toBeLessThanOrEqual(1200);
    expect(novaLevelFor(0)).toBe(NOVA_GAIN);
    expect(20 * Math.log10(novaLevelFor(1) / novaLevelFor(0))).toBeCloseTo(-6, 6);
    expect(ARRIVE_GAIN).toBeCloseTo(0.14 * 0.7, 9);
    expect(ARRIVE_HI_HZ).toBe(2000);
    expect(arriveGainAt(ARRIVE_SEC * 0.85)).toBeCloseTo(ARRIVE_GAIN, 9);
  });

  it('WELL_KIND mirrors the sim enum', () => {
    expect(WELL_KIND).toBe(Kind.GravityWell);
  });
});

interface Rec {
  kind: LoopKind;
  stops: number[];
}

function rig(): { bus: Bus; loops: Rec[]; once: OneShot[]; live: () => Rec[]; ctl: ReturnType<typeof installGw2> } {
  const b = new Bus();
  const loops: Rec[] = [];
  const once: OneShot[] = [];
  const backend: Gw2Backend = {
    startLoop(kind) {
      const r: Rec = { kind, stops: [] };
      loops.push(r);
      return { stop: (s): void => void r.stops.push(s) };
    },
    playOnce(k) {
      once.push(k);
    },
  };
  const ctl = installGw2(b, backend);
  return { bus: b, loops, once, live: () => loops.filter((l) => l.stops.length === 0), ctl };
}

describe('gw2 wiring', () => {
  it('sim:saw on starts one buzz, repeated on never stacks, off ramps out in 120 ms', () => {
    const r = rig();
    r.bus.emit('sim:saw', { on: true });
    r.bus.emit('sim:saw', { on: true });
    expect(r.loops.filter((l) => l.kind === 'saw')).toHaveLength(1);
    expect(r.ctl.loopCount()).toBe(1);
    r.bus.emit('sim:saw', { on: false });
    expect(r.loops[0]?.stops).toEqual([SAW_RAMP_OUT]);
    expect(r.ctl.loopCount()).toBe(0);
    r.bus.emit('sim:saw', { on: false });
    expect(r.loops[0]?.stops).toHaveLength(1);
    r.bus.emit('sim:saw', { on: true });
    expect(r.loops).toHaveLength(2);
  });

  it('sim:wellNova starts a whirlpool per well, at most two, none twice for one well', () => {
    const r = rig();
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('sim:wellNova', { id: 6, x: 0, y: 0 });
    r.bus.emit('sim:wellNova', { id: 7, x: 0, y: 0 });
    expect(NOVA_MAX).toBe(2);
    expect(r.loops.filter((l) => l.kind === 'nova')).toHaveLength(2);
  });

  it('a well death stops only that well whirlpool; other kills with the same id do nothing', () => {
    const r = rig();
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('sim:wellNova', { id: 6, x: 0, y: 0 });
    r.bus.emit('fx:kill', { x: 0, y: 0, colour: 'cyan', kind: Kind.Grunt, id: 5 });
    expect(r.live()).toHaveLength(2);
    r.bus.emit('fx:kill', { x: 0, y: 0, colour: 'cyan', kind: Kind.GravityWell, id: 5 });
    expect(r.loops[0]?.stops).toEqual([NOVA_RELEASE]);
    expect(r.live()).toHaveLength(1);
    // A freed slot lets a new nova start.
    r.bus.emit('sim:wellNova', { id: 9, x: 0, y: 0 });
    expect(r.live()).toHaveLength(2);
  });

  it('sim:wellArrive and sim:wellSpawn fire their one shots', () => {
    const r = rig();
    r.bus.emit('sim:wellArrive', { id: 1, x: 0, y: 0, inSec: 1.5 });
    r.bus.emit('sim:wellSpawn', { id: 1, x: 0, y: 0, kind: Kind.SnakeHead });
    expect(r.once).toEqual(['arrive', 'slither']);
    expect(r.loops).toHaveLength(0);
  });

  it('boss shield up chimes and hums once, down stops the hum and shatters', () => {
    const r = rig();
    r.bus.emit('sim:bossShield', { id: 'warden', up: true, x: 0, y: 0 });
    r.bus.emit('sim:bossShield', { id: 'warden', up: true, x: 0, y: 0 });
    expect(r.once).toEqual(['shieldUp']);
    expect(r.loops.filter((l) => l.kind === 'shieldHum')).toHaveLength(1);
    r.bus.emit('sim:bossShield', { id: 'warden', up: false, x: 0, y: 0 });
    expect(r.loops[0]?.stops).toEqual([SHIELD_RELEASE]);
    expect(r.once).toEqual(['shieldUp', 'shatter']);
    // A stray down with no shield up makes no sound.
    r.bus.emit('sim:bossShield', { id: 'warden', up: false, x: 0, y: 0 });
    expect(r.once).toHaveLength(2);
  });

  it('game start and quit stop every sustained voice', () => {
    const r = rig();
    r.bus.emit('sim:saw', { on: true });
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('sim:bossShield', { id: 'warden', up: true, x: 0, y: 0 });
    expect(r.ctl.loopCount()).toBe(3);
    r.bus.emit('game:quit');
    expect(r.live()).toHaveLength(0);
    expect(r.ctl.loopCount()).toBe(0);
  });

  const startAll = (r: ReturnType<typeof rig>): void => {
    r.bus.emit('sim:saw', { on: true });
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('sim:wellNova', { id: 6, x: 0, y: 0 });
    r.bus.emit('sim:bossShield', { id: 'warden', up: true, x: 0, y: 0 });
    expect(r.ctl.loopCount()).toBe(4);
  };
  const expectSilent = (r: ReturnType<typeof rig>): void => {
    expect(r.live()).toHaveLength(0);
    expect(r.ctl.loopCount()).toBe(0);
    for (const l of r.loops) expect(l.stops).toEqual([RESET_FADE]);
    // Bookkeeping is empty: the same ids can start again.
    r.bus.emit('sim:saw', { on: true });
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    expect(r.live()).toHaveLength(2);
  };

  it('game:start stops every loop with a 100 ms fade and clears bookkeeping', () => {
    const r = rig();
    startAll(r);
    r.bus.emit('game:start', { mode: 'adventure', levelIndex: 0 });
    expectSilent(r);
  });

  it('game:quit stops every loop with a 100 ms fade and clears bookkeeping', () => {
    const r = rig();
    startAll(r);
    r.bus.emit('game:quit');
    expectSilent(r);
  });

  it('ui:screen to menu stops every loop; ui:screen play does not', () => {
    const r = rig();
    startAll(r);
    r.bus.emit('ui:screen', { screen: 'play' });
    expect(r.ctl.loopCount()).toBe(4);
    r.bus.emit('ui:screen', { screen: 'menu' });
    expectSilent(r);
  });

  it('pause and resume keep a live roar', () => {
    const r = rig();
    r.bus.emit('sim:wellNova', { id: 5, x: 0, y: 0 });
    r.bus.emit('game:pause');
    expect(r.live()).toHaveLength(1);
    r.bus.emit('game:resume');
    expect(r.live()).toHaveLength(1);
    expect(r.ctl.loopCount()).toBe(1);
    r.bus.emit('fx:kill', { x: 0, y: 0, colour: 'cyan', kind: Kind.GravityWell, id: 5 });
    expect(r.ctl.loopCount()).toBe(0);
  });

  it('dispose stops voices and unsubscribes', () => {
    const r = rig();
    r.bus.emit('sim:saw', { on: true });
    r.ctl.dispose();
    expect(r.live()).toHaveLength(0);
    r.bus.emit('sim:saw', { on: true });
    expect(r.loops).toHaveLength(1);
  });
});
