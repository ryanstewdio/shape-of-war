// Tester build gate (docs/14 item 4). Every test URL knob (?boss, ?tilt, ?seed, ?level, ?debug,
// ?surface, ?glow, ?stress, ?particles, the bloom knobs and any other) works only when ?dev=1 is
// also present. Without it main.ts reads an empty query and strips the query from the address bar
// before any other module looks at window.location, so a stray link from a tester changes nothing.
// Pure: no DOM.

export const DEV_PARAM = 'dev';

/** Knobs known at release time, listed so the tests can prove each one is gated. Not exhaustive by design: the gate is all or nothing. */
export const DEV_KNOBS: readonly string[] = [
  'boss',
  'tilt',
  'seed',
  'level',
  'debug',
  'surface',
  'glow',
  'stress',
  'particles',
  'bloomRes',
  'bloomQuality',
  'bloomBlur',
];

/** Pure: true when the query carries dev=1 exactly. */
export function isDev(search: string): boolean {
  return new URLSearchParams(search).get(DEV_PARAM) === '1';
}

/** Pure: the query every knob reader may see. The query unchanged with ?dev=1, '' otherwise. */
export function gateSearch(search: string): string {
  return isDev(search) ? search : '';
}
