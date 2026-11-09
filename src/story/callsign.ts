// Call sign suggestions and validation (docs/19 "Call sign"). Pure: the draw takes a seed and runs
// through src/core/rng.ts; the caller supplies the seed (freshSeed at the DOM edge). Two short word
// lists so any pair fits the 10 character cap. Plain, friendly words only.
import { CALLSIGN_MAX, CALLSIGN_RE } from '../core/settings';
import { mulberry32, rngPick } from '../core/rng';

export const CALLSIGN_FIRST: readonly string[] = [
  'Nova', 'Swift', 'Glint', 'Star', 'Sky', 'Neon', 'Comet', 'Lucky', 'Brave', 'Quick',
  'Sun', 'Moon', 'Solar', 'Spark', 'Glow', 'Pixel', 'Prism', 'Echo', 'Zip', 'Blue',
];

export const CALLSIGN_SECOND: readonly string[] = [
  'Fox', 'Hawk', 'Wing', 'Kite', 'Owl', 'Wolf', 'Ray', 'Dash', 'Jet', 'Bolt',
  'Lynx', 'Finch', 'Wren', 'Orbit', 'Beam', 'Arrow', 'Pilot', 'Comet', 'Tiger', 'Otter',
];

/** Pure: a suggested call sign for a seed. Same seed, same name; always valid. */
export function suggestCallsign(seed: number): string {
  const r = mulberry32(seed >>> 0);
  for (let i = 0; i < 8; i++) {
    const name = rngPick(r, CALLSIGN_FIRST) + rngPick(r, CALLSIGN_SECOND);
    if (CALLSIGN_RE.test(name)) return name;
  }
  return 'NovaFox';
}

/** Pure: typed text with everything but letters and digits removed, cut to 10 characters. */
export function sanitizeCallsign(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, '').slice(0, CALLSIGN_MAX);
}

/** Pure: true for 3 to 10 letters and digits. */
export function isValidCallsign(text: string): boolean {
  return CALLSIGN_RE.test(text);
}
