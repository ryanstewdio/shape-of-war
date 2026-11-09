// Story scene sound (P1, docs/19 Sound): synthesised, mythic, calm. Driven by 'ui:story' from
// Ledger's scene player. Phase start: opening and briefing get a soft rising reveal, a guardian
// scene a low slow minor drone (the boss motif lives in the music scheduler and cannot be reused
// cleanly as a one shot), freed a warm major chord that blooms. Phase panel: one quiet shimmer
// tick, never per typewriter character. Phase end (close or skip): every voice fades within
// FADE_SEC, so a skip leaves no hanging note. Pure parameters plus the event controller; no Web
// Audio here, so tests run in node. storySfxSynth.ts makes the sound. Music is left alone: the
// music engine has no external duck hook, so scenes play over the menu or level bed.
import type { Bus } from '../core/events';

export type StoryType = 'opening' | 'briefing' | 'guardian' | 'freed';

/** Fade out on phase end, seconds. Must stay under 0.3. */
export const FADE_SEC = 0.25;
/** Level of every cue voice. The summed cue peaks well below the bossDeath voices (0.22, 0.18, 0.2). */
export const REVEAL_GAIN = 0.05;
export const DRONE_GAIN = 0.04;
export const CHORD_GAIN = 0.03;
export const TICK_GAIN = 0.015;
/** Cue lengths, seconds. A phase end cuts them short with the fade. */
export const REVEAL_SEC = 1.2;
export const DRONE_SEC = 12;
export const CHORD_SEC = 3;
export const TICK_SEC = 0.35;
/** Bloom: seconds for the freed chord to rise to full level. */
export const BLOOM_SEC = 1.6;

/** Guardian drone roots, Hz (low A, D, E, G, C). One is picked per scene id. */
export const DRONE_ROOTS: readonly number[] = [55, 73.42, 82.41, 98, 65.41];
/** Minor triad plus octave above the root, in semitones. */
export const DRONE_SEMITONES: readonly number[] = [0, 3, 7, 12];
/** Freed chord: C major spread, Hz (C4, E4, G4, C5). */
export const CHORD_HZ: readonly number[] = [261.63, 329.63, 392, 523.25];
/** Reveal sweep, Hz: a soft rise from A4 to E5. */
export const REVEAL_F0 = 440;
export const REVEAL_F1 = 659.25;
/** Shimmer tick pitch, Hz (E6). */
export const TICK_HZ = 1318.5;

export type StoryCue =
  | { readonly kind: 'reveal'; readonly f0: number; readonly f1: number; readonly gain: number; readonly sec: number }
  | { readonly kind: 'drone'; readonly freqs: readonly number[]; readonly gain: number; readonly sec: number }
  | { readonly kind: 'chord'; readonly freqs: readonly number[]; readonly gain: number; readonly sec: number; readonly bloomSec: number };

/** Pure: a small stable hash of a string, used only to pick a drone root. */
export function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Pure: the start cue for a scene type and id. */
export function cueFor(type: StoryType, id: string): StoryCue {
  if (type === 'guardian') {
    const root = DRONE_ROOTS[idHash(id) % DRONE_ROOTS.length] ?? 55;
    return { kind: 'drone', freqs: DRONE_SEMITONES.map((s) => root * Math.pow(2, s / 12)), gain: DRONE_GAIN, sec: DRONE_SEC };
  }
  if (type === 'freed') {
    return { kind: 'chord', freqs: CHORD_HZ, gain: CHORD_GAIN, sec: CHORD_SEC, bloomSec: BLOOM_SEC };
  }
  return { kind: 'reveal', f0: REVEAL_F0, f1: REVEAL_F1, gain: REVEAL_GAIN, sec: REVEAL_SEC };
}

/** What the controller needs from the sound side. Each call is silent when audio is not available. */
export interface StoryBackend {
  /** Start a cue, replacing any cue still sounding. */
  play(cue: StoryCue): void;
  /** One quiet shimmer tick. */
  tick(hz: number): void;
  /** Fade every story voice to silence over `sec` and release it. Safe with nothing sounding. */
  stop(sec: number): void;
}

export interface StoryController {
  dispose(): void;
}

/** Wire 'ui:story' on `b` to `backend`. Payload objects are reused: fields are read here. */
export function installStorySfx(b: Bus, backend: StoryBackend): StoryController {
  const off = b.on('ui:story', (p) => {
    if (p.phase === 'start') backend.play(cueFor(p.type, p.id));
    else if (p.phase === 'panel') backend.tick(TICK_HZ);
    else backend.stop(FADE_SEC);
  });
  return {
    dispose(): void {
      off();
      backend.stop(FADE_SEC);
    },
  };
}
