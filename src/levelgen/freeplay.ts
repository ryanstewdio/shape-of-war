// R2 contract stub (Fable): the Free Play level. Ledger builds the menu and the options screen and
// calls freePlayLevel; Foundry replaces the body with an endless style level built from the options.
import { generateEndless } from './generator';
import type { EndlessDef } from './leveldef';

export type FreePlayArena = 'rect' | 'circle' | 'drum';

export interface FreePlayOptions {
  readonly arena: FreePlayArena;
  /** Obstacles on (rect and circle: pillars; drum: rings or pillars). */
  readonly barriers: boolean;
  readonly seed: number;
}

/** The Free Play run for these options: an Endless run (createEndlessGame) with the chosen arena. Stub: plain Endless until Foundry lands. */
export function freePlayLevel(o: FreePlayOptions): EndlessDef {
  return generateEndless(o.seed >>> 0);
}
