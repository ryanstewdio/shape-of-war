// GW2 sound effects: pure parameter and envelope helpers plus the event wiring controller.
// No Web Audio here, so tests run in node. gw2Synth.ts supplies the Backend that makes sound.
// Sustained voices (saw buzz, whirlpool, shield hum) are started and stopped by bus events and
// are never stacked: one saw, at most NOVA_MAX whirlpools, one hum per boss id.
import type { Bus } from '../core/events';

/** Mirrors the sim's Kind.GravityWell; tests/audio/gw2.test.ts checks it against the enum. */
export const WELL_KIND = 9;
export const NOVA_MAX = 2;

export const SAW_RAMP_IN = 0.06;
export const SAW_RAMP_OUT = 0.12;
export const SAW_BASE_HZ = 110;
export const SAW_DETUNE_CENTS = 14;
export const SAW_WOBBLE_HZ = 28;
export const SAW_GAIN = 0.1;

export const NOVA_RELEASE = 0.4;
/** Fade for every sustained voice when a level resets or the player leaves play, seconds. */
export const RESET_FADE = 0.1;
export const NOVA_GAIN = 0.16;
export const NOVA_PAN_PERIOD = 3.2;
export const NOVA_FILTER_LO = 160;
export const NOVA_FILTER_HI = 900;
export const NOVA_RISE_SEC = 8;

export const ARRIVE_SEC = 1.5;
export const SLITHER_SEC = 0.22;

export const SHIELD_HUM_HZ = 98;
export const SHIELD_HUM_GAIN = 0.05;
export const SHIELD_RELEASE = 0.25;
/** Bright glassy chord, a major add9 voicing, Hz. */
export const SHIELD_CHORD: readonly number[] = [880, 1108.73, 1318.51, 1760];
/** Falling pings of the shatter, Hz. */
export const SHATTER_PINGS: readonly number[] = [2637, 1976, 1397, 988];

export type LoopKind = 'saw' | 'nova' | 'shieldHum';
export type OneShot = 'arrive' | 'slither' | 'shieldUp' | 'shatter';

/** Pure: gain envelope level of a linear ramp, 0 to 1, clamped. */
export function rampLevel(elapsed: number, dur: number): number {
  if (!(dur > 0)) return 1;
  return Math.min(1, Math.max(0, elapsed / dur));
}

/** Pure: the saw buzz gain at `elapsed` seconds after an on (ramp in) or off (ramp out) edge. */
export function sawGainAt(on: boolean, elapsed: number): number {
  return on ? SAW_GAIN * rampLevel(elapsed, SAW_RAMP_IN) : SAW_GAIN * (1 - rampLevel(elapsed, SAW_RAMP_OUT));
}

/** Pure: the two detuned sawtooth frequencies, Hz. */
export function sawPair(): readonly [number, number] {
  const k = Math.pow(2, SAW_DETUNE_CENTS / 1200);
  return [SAW_BASE_HZ / k, SAW_BASE_HZ * k];
}

/** Pure: the saw band pass sweep centre at time t, Hz, a slow triangle between 300 and 900. */
export function sawSweepHz(t: number): number {
  const ph = (((t / 0.9) % 1) + 1) % 1;
  const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
  return 300 + 600 * tri;
}

/** Pure: stereo pan -1 to 1 at age t seconds; one full sweep per NOVA_PAN_PERIOD. */
export function novaPanAt(t: number): number {
  return Math.sin((2 * Math.PI * t) / NOVA_PAN_PERIOD);
}

/** Pure: whirlpool low pass cutoff at age t, rising and then holding at the top. */
export function novaFilterAt(t: number): number {
  const f = rampLevel(t, NOVA_RISE_SEC);
  return NOVA_FILTER_LO * Math.pow(NOVA_FILTER_HI / NOVA_FILTER_LO, f);
}

/** Pure: arrival whoosh gain at t in 0..ARRIVE_SEC: a rise, then a soft thud tail. */
export function arriveGainAt(t: number): number {
  if (t < 0 || t > ARRIVE_SEC) return 0;
  const rise = rampLevel(t, ARRIVE_SEC * 0.85);
  if (t <= ARRIVE_SEC * 0.85) return 0.14 * rise * rise;
  return 0.14 * (1 - rampLevel(t - ARRIVE_SEC * 0.85, ARRIVE_SEC * 0.15));
}

/** A running sustained voice. stop is idempotent. */
export interface LoopHandle {
  stop(releaseSec: number): void;
}

/** What the controller needs from the sound side. Returns null when audio is not available. */
export interface Gw2Backend {
  startLoop(kind: LoopKind): LoopHandle | null;
  playOnce(kind: OneShot): void;
}

export interface Gw2Controller {
  /** Live sustained voices, for tests and the voice cap. */
  loopCount(): number;
  dispose(): void;
}

/** Wire the GW2 events on `b` to `backend`. Payload objects are reused by the sim: fields are read here. */
export function installGw2(b: Bus, backend: Gw2Backend): Gw2Controller {
  let saw: LoopHandle | null = null;
  const novas = new Map<number, LoopHandle>();
  const shields = new Map<string, { hum: LoopHandle | null }>();

  const stopSaw = (release: number = SAW_RAMP_OUT): void => {
    saw?.stop(release);
    saw = null;
  };
  const stopShield = (id: string, release: number = SHIELD_RELEASE): void => {
    const s = shields.get(id);
    if (!s) return;
    s.hum?.stop(release);
    shields.delete(id);
  };
  /** Stop every sustained voice with a short fade and clear all bookkeeping. */
  const stopAll = (): void => {
    stopSaw(RESET_FADE);
    for (const h of novas.values()) h.stop(RESET_FADE);
    novas.clear();
    for (const id of [...shields.keys()]) stopShield(id, RESET_FADE);
  };

  const offs = [
    b.on('sim:saw', (p) => {
      if (p.on) {
        if (saw === null) saw = backend.startLoop('saw');
      } else stopSaw();
    }),
    b.on('sim:wellNova', (p) => {
      if (novas.has(p.id) || novas.size >= NOVA_MAX) return;
      const h = backend.startLoop('nova');
      if (h) novas.set(p.id, h);
    }),
    b.on('fx:kill', (p) => {
      if (p.kind !== WELL_KIND) return;
      const h = novas.get(p.id);
      if (!h) return;
      h.stop(NOVA_RELEASE);
      novas.delete(p.id);
    }),
    b.on('sim:wellArrive', () => backend.playOnce('arrive')),
    b.on('sim:wellSpawn', () => backend.playOnce('slither')),
    b.on('sim:bossShield', (p) => {
      if (p.up) {
        if (shields.has(p.id)) return;
        backend.playOnce('shieldUp');
        shields.set(p.id, { hum: backend.startLoop('shieldHum') });
      } else if (shields.has(p.id)) {
        stopShield(p.id);
        backend.playOnce('shatter');
      }
    }),
    b.on('sim:bossDown', (p) => stopShield(p.id)),
    b.on('game:start', stopAll),
    b.on('game:quit', stopAll),
    b.on('game:over', stopAll),
    // Leaving play (menu, results, title, settings) must leave nothing looping. Pause and resume
    // are deliberately not handled: live voices stay tracked and stop only on their own events.
    b.on('ui:screen', (p) => {
      if (p.screen !== 'play') stopAll();
    }),
  ];
  return {
    loopCount: () => (saw ? 1 : 0) + novas.size + [...shields.values()].filter((s) => s.hum).length,
    dispose: () => {
      stopAll();
      for (const off of offs) off();
    },
  };
}
