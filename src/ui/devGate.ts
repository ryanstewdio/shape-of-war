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
  'trough',
  'glow',
  'stress',
  'particles',
  'bloomRes',
  'bloomQuality',
  'bloomBlur',
];

/** The build time flag: VITE_SOW_DEV=1 turns every dev item on (the build:cap:dev test APK). */
export function envDevFlag(): string | undefined {
  return import.meta.env.VITE_SOW_DEV;
}

/** Pure: true when the query carries dev=1 exactly, or the build flag is '1'. */
export function isDev(search: string, flag: string | undefined = envDevFlag()): boolean {
  return flag === '1' || new URLSearchParams(search).get(DEV_PARAM) === '1';
}

/** Pure: the query every knob reader may see. The query unchanged in a dev session, '' otherwise. */
export function gateSearch(search: string, flag: string | undefined = envDevFlag()): string {
  return isDev(search, flag) ? search : '';
}
