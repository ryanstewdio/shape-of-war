// Release polish: membrane gaps (docs/14 item 9). An obstacle with membrane true is a wall for the
// ship, player bullets, enemy bullets and boss entities (every confineOn caller by default). Enemy
// moves that go through moveTo, moveToHit or driftEntity pass through it instead, at
// MEMBRANE_SPEED of their step while their circle overlaps it. Levels without a membrane never
// reach this module (World.membranes false), so they stay bit identical. No allocation.
import type { ArenaDef } from '../levelgen/leveldef';
import { confineOn, overlapsMembrane, type ConfineResult } from './arena';
import { Kind, type World } from './world';

/** Fraction of an enemy's step kept while it overlaps a membrane. */
export const MEMBRANE_SPEED = 0.35;

/** Pure: true when the arena has at least one membrane obstacle. */
export function hasMembrane(arena: ArenaDef): boolean {
  const obs = arena.obstacles;
  for (let i = 0; i < obs.length; i++) if (obs[i]?.membrane === true) return true;
  return false;
}

/**
 * Pure: kinds that squeeze through membranes: the wave enemies, the hazard spawner and the V2
 * enemies and hazards. Not the ship, drones, geoms, pickups, wells or any boss entity.
 */
export function passesMembrane(k: number): boolean {
  return (k >= Kind.Grunt && k <= Kind.SnakeBody) || k === Kind.Spawner || (k >= Kind.Charger && k <= Kind.Slime);
}

const d = { x: 0, y: 0 };

/**
 * Confined move of entity id to (nx, ny) on a level with membranes. A kind that passes slows to
 * MEMBRANE_SPEED of the step while it overlaps a membrane and ignores membranes when confined;
 * any other kind is confined exactly as confineOn does.
 */
export function membraneMove(w: World, id: number, nx: number, ny: number, out: ConfineResult): ConfineResult {
  const r = w.radius[id] ?? 0;
  if (!passesMembrane(w.kind[id] ?? 0)) return confineOn(w.surface, w.level.arena, nx, ny, r, out);
  const x = w.x[id] ?? 0;
  const y = w.y[id] ?? 0;
  let tx = nx;
  let ty = ny;
  if (overlapsMembrane(w.surface, w.level.arena, x, y, r)) {
    w.surface.delta(x, y, nx, ny, d);
    tx = x + d.x * MEMBRANE_SPEED;
    ty = y + d.y * MEMBRANE_SPEED;
  }
  return confineOn(w.surface, w.level.arena, tx, ty, r, out, true);
}
