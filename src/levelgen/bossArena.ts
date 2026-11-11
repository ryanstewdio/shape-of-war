// Boss arenas (Ryan, 2026-11-11, version 13). Guardian levels from BOSS_ARENA_FROM_LEVEL get more
// room for the chase: the arena grows to at least the Free Play medium size of its kind, Spindle's
// to the large size. Pure: no PRNG, no Date, no DOM. The arena stream draws as before, so only the
// size moves; obstacles keep their places (all still inside, clear of spawn and of each other).
import { round1 } from './leveldef';
import type { ArenaDef, BossId } from './leveldef';
import { HEX_ASPECT, guardianArenaMin } from './validate';

/**
 * The version 13 arena of a flat guardian level: each dimension raised to guardianArenaMin of its
 * shape and boss. Rect family: width and height each to at least the minimum (aspect stays 1.0 to
 * 1.8), a roundRect keeps its corner radius share of the height. Circle: the diameter. Hexagon:
 * the height, width from HEX_ASPECT. An arena already that large comes back unchanged.
 */
export function growGuardianArena(arena: ArenaDef, bossId: BossId): ArenaDef {
  const min = guardianArenaMin(arena.shape, bossId);
  if (arena.shape === 'circle') {
    const d = Math.max(arena.width, min.width);
    return d === arena.width ? arena : { ...arena, width: d, height: d };
  }
  if (arena.shape === 'hexagon') {
    if (arena.height >= min.height) return arena;
    return { ...arena, width: round1(min.height * HEX_ASPECT), height: min.height };
  }
  const width = Math.max(arena.width, min.width);
  const height = Math.max(arena.height, min.height);
  if (width === arena.width && height === arena.height) return arena;
  const cornerRadius = arena.shape === 'roundRect' ? round1((arena.cornerRadius * height) / arena.height) : arena.cornerRadius;
  return { ...arena, width, height, cornerRadius };
}
