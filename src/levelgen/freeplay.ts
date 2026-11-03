// Release gate R2: Free Play. An Endless style run where the player picks the arena (rect,
// circle or a cylinder drum) and whether it has barriers. The waves are the normal Endless
// segments and roster; only the spawn points are laid out on the chosen arena (freePlaySegment).
// Pure and deterministic: every draw comes from one stream seeded from o.seed, re-derived with
// attemptSeed on a failed validation, and the attempt count is recorded in freePlay.retries.
import { mulberry32, rngInt, rngPick, streamSeed } from '../core/rng';
import type { Rng } from '../core/rng';
import { applyDrumPattern } from './drum';
import { attemptSeed, endlessSegmentOn, generateEndless, placeObstacles } from './generator';
import { DEFAULT_GEN_CONFIG, GENERATOR_VERSION_V7, MAX_RETRIES, deepFreeze } from './leveldef';
import type { ArenaDef, EndlessDef, EndlessSegmentDef, FreePlayArena, FreePlayInfo, GenConfig } from './leveldef';
import { FREE_PLAY_CIRCLE, FREE_PLAY_RECT, MAX_OBSTACLES, validateFreePlay } from './validate';

export type { FreePlayArena } from './leveldef';

export interface FreePlayOptions {
  readonly arena: FreePlayArena;
  /** Obstacles on (rect and circle: pillars; drum: rings or pillars). */
  readonly barriers: boolean;
  readonly seed: number;
}

/** Salt of the Free Play arena stream. ASCII "FREE". */
export const FREE_PLAY_SALT = 0x46524545;
/** Drum size: the Endless arena, whose width 1600 is 25 x 64. */
export const FREE_PLAY_DRUM: Readonly<{ width: number; height: number }> = Object.freeze({ width: 1600, height: 1000 });
/** Fewest barriers on a rect or circle with barriers on (the most is MAX_OBSTACLES). */
export const FREE_PLAY_MIN_OBSTACLES = 2;
/** Drum barrier layouts, equally likely. */
export const FREE_PLAY_DRUM_PATTERNS = ['rings', 'pillars'] as const;

function baseArena(kind: FreePlayArena): ArenaDef {
  const size = kind === 'circle' ? { width: FREE_PLAY_CIRCLE, height: FREE_PLAY_CIRCLE } : kind === 'drum' ? FREE_PLAY_DRUM : FREE_PLAY_RECT;
  return { shape: kind === 'circle' ? 'circle' : 'rect', width: size.width, height: size.height, cornerRadius: 0, obstacles: [], spawnPoint: { x: 0, y: 0 } };
}

/**
 * The arena of one attempt. Draws: none with barriers off. Rect and circle: the count, then the
 * flat placement (placeObstacles). Drum: the pattern, then its layout (drum.ts, no membranes).
 */
export function freePlayArena(r: Rng, kind: FreePlayArena, barriers: boolean): { arena: ArenaDef; drumPattern: FreePlayInfo['drumPattern'] } {
  const base = baseArena(kind);
  if (!barriers) return { arena: base, drumPattern: null };
  if (kind === 'drum') {
    const pattern = rngPick(r, FREE_PLAY_DRUM_PATTERNS);
    return { arena: applyDrumPattern(base, pattern, r, false, true), drumPattern: pattern };
  }
  const obstacles = placeObstacles(r, base, rngInt(r, FREE_PLAY_MIN_OBSTACLES, MAX_OBSTACLES));
  return { arena: { ...base, shape: kind === 'rect' ? 'rectObstacles' : 'circle', obstacles }, drumPattern: null };
}

function buildFreePlay(o: FreePlayOptions, attempt: number, cfg: GenConfig): EndlessDef {
  const seed = o.seed >>> 0;
  const { arena, drumPattern } = freePlayArena(mulberry32(streamSeed(attemptSeed(seed, attempt), FREE_PLAY_SALT)), o.arena, o.barriers);
  const endless = generateEndless(seed, cfg);
  const freePlay: FreePlayInfo = { arena: o.arena, barriers: o.barriers, drumPattern, retries: attempt };
  return {
    ...endless,
    generatorVersion: GENERATOR_VERSION_V7,
    surface: o.arena === 'drum' ? 'cylinder' : 'flat',
    arena,
    roster: endless.roster.map((e) => ({ ...e })),
    hazards: { wells: [], spawners: [] },
    freePlay,
  };
}

/**
 * The Free Play run for these options: an Endless run (createEndlessGame) on the chosen arena,
 * version 7. Re-derives with attemptSeed(seed, k), k 1 to MAX_RETRIES, until validateFreePlay
 * passes; the last attempt is returned if none does. Waves: freePlaySegment(def, s).
 */
export function freePlayLevel(o: FreePlayOptions, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessDef {
  let def = buildFreePlay(o, 0, cfg);
  for (let k = 1; k <= MAX_RETRIES && !validateFreePlay(def).ok; k++) def = buildFreePlay(o, k, cfg);
  return deepFreeze(def);
}

/**
 * Segment s of a Free Play run: the normal Endless segment (roster, budget, ramp, boss) with the
 * spawn points laid out on the def's arena, wrapped on a drum. On the plain rect it equals
 * generateEndlessSegment(def.endlessSeed, s). Wiring passes (s) => freePlaySegment(def, s).
 */
export function freePlaySegment(def: EndlessDef, segment: number, cfg: GenConfig = DEFAULT_GEN_CONFIG): EndlessSegmentDef {
  return endlessSegmentOn(def.endlessSeed, segment, cfg, def.arena, def.surface === 'cylinder');
}
