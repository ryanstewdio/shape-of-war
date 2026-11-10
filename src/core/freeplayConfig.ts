// Free Play options contract stub (Fable, docs/14 "Free Play options"). Ledger builds the setup screen
// and fills a FreePlayConfig; Foundry builds the run from the level side (enemies, density, bosses,
// wells, arena size); Forge applies the rules side (lives, run length, loadout, pickups, drift).
// Pure types and defaults only.
import type { BaseWeaponKind } from './events';
import type { BossId, DroneKind, EnemyKind, SuperKind } from '../levelgen/leveldef';

export type FreePlayDensity = 'low' | 'normal' | 'swarm';
export type FreePlayLives = 1 | 3 | 5 | 'infinite';
/** Endless, or a timed score attack of this many seconds. */
export type FreePlayLength = 'endless' | 180 | 300 | 600;
export type FreePlayBosses = 'off' | 'every3' | BossId;
export type FreePlayWells = 'off' | 'normal' | 'many';
export type FreePlayDrift = 'off' | 'low' | 'high';
export type FreePlaySize = 'small' | 'medium' | 'large';
/** Trough wave stub (Morpheus 2026-11-10): Free Play arena surface. Absent means flat. */
export type FreePlaySurface = 'flat' | 'trough';

export interface FreePlayConfig {
  /** Enemy kinds allowed; empty means the normal Endless roster. */
  readonly enemies: readonly EnemyKind[];
  readonly density: FreePlayDensity;
  readonly lives: FreePlayLives;
  readonly length: FreePlayLength;
  /** Starting weapon, or null for none. */
  readonly weapon: BaseWeaponKind | null;
  readonly pickups: boolean;
  readonly drone: DroneKind;
  readonly superType: SuperKind;
  readonly bosses: FreePlayBosses;
  readonly wells: FreePlayWells;
  readonly drift: FreePlayDrift;
  readonly size: FreePlaySize;
  /** Trough wave stub: absent or 'flat' is a flat arena (old saves have no field). */
  readonly surface?: FreePlaySurface;
}

export const DEFAULT_FREE_PLAY: FreePlayConfig = Object.freeze({
  enemies: [],
  density: 'normal',
  lives: 3,
  length: 'endless',
  weapon: null,
  pickups: true,
  drone: 'attack',
  superType: 'turbo',
  bosses: 'off',
  wells: 'normal',
  drift: 'low',
  size: 'medium',
});
