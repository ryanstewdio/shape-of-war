// Swarm session entry points for wiring in main.ts: createGame replaces createWorld, stepGame
// replaces stepWorld in the loop's step hook. stepGame allocates nothing.
import type { StartBonus } from '../core/bonus';
import { DIFFICULTY, type Difficulty } from '../core/difficulty';
import type { FreePlayConfig } from '../core/freeplayConfig';
import { bus } from '../core/events';
import type { InputState } from '../input/types';
import type { EndlessDef, LevelDef } from '../levelgen/leveldef';
import { FREE_PLAY_ARRIVAL_GAP_SCALE } from '../levelgen/freeplay';
import { bossContacts, stepBossSchedule } from './bosses/core';
import { initLevelBoss } from './bosses/index';
import { bulletHits, orbitHits, separate, shipHits, shipPickups } from './combat';
import { clearEnemyBullets, stepEnemyBullets } from './enemyBullets';
import { clearPickup } from './pickup';
import { applyDriftOption } from './drift';
import { freePlaySurfaceRules } from './trough';
import { equipWeapon, pauseSaw, setPermanentWeapon, setWeaponPickups, stepWeapons } from './weapons';
import { registerSwarmBehaviours } from './defs';
import { stepDrone } from './drones';
import { spawnWells, stepWells } from './enemies/gravitywell';
import { SUPER_CHARGE_MAX } from './geoms';
import { stepObjective } from './objective';
import { stepPlayer } from './player';
import { stepPond } from './pondRipple';
import { stepPresence } from './presence';
import { stepSpawner } from './spawner';
import { endlessLevel, startEndless, stepEndlessAwards } from './endless';
import { currentMultiplier, gs, syncMultiplier, type GameMode, type GameState, type ScoringPort, type SegmentSource } from './state';
import { stepSupers, triggerSuper } from './supers';
import { resetWellState, stepWellArrivals } from './wellArrival';
import { levelWithLiveCap, levelWithTarget } from './difficulty';
import { createWorld, ENTITY_CAP, stepWorld, type World } from './world';

export interface GameOptions {
  mode?: GameMode;
  /** Injected vibrate (tests pass a spy). Default navigator.vibrate when present. */
  vibrate?: (ms: number) => void;
  /** Ledger's scoring hooks. Default: base value x multiplier, kept in gs(w). */
  scoring?: ScoringPort;
  /** Record every wave spawn in gs(w).spawnLog (tests and debugging; allocates). */
  logSpawns?: boolean;
  capacity?: number;
  /** Settings "Weapon pickups" (docs/11). Default on. Same as calling setWeaponPickups after create. */
  weaponPickups?: boolean;
  /** Gravity well super nova after 5 to 7 s (G3C). Default on; the v1 golden tests turn it off to stay v1 identical. */
  wellNova?: boolean;
  /** Release polish: Settings difficulty (docs/14 item 6). Default normal, bit identical to the v3 sim. */
  difficulty?: Difficulty;
  /** R2: the par reward chosen on the previous results screen. Absent changes nothing. */
  startBonus?: StartBonus;
  /**
   * Free Play options, rules side (docs/14): lives, run length, loadout, pickups and drift. Absent
   * changes nothing. Overrides weaponPickups and the level's drone and super kinds.
   */
  freePlay?: FreePlayConfig;
}

/** Free Play: the level with the config's drone and super kinds (a copy; the caller's level is untouched). */
export function freePlayLevelRules(level: LevelDef, fp: FreePlayConfig): LevelDef {
  // Trough wave: the Free Play surface option ('trough' turns a flat arena into a trough).
  const lv = freePlaySurfaceRules(level, fp);
  if (lv.drone === fp.drone && lv.superType === fp.superType) return lv;
  return { ...lv, drone: fp.drone, superType: fp.superType };
}

/**
 * Free Play rules on a fresh game (docs/14). lives: exactly 1, 3 or 5, or Infinity for infinite (the
 * run is never lost; deaths still reset the multiplier and count in gs(w).deaths). length: a score
 * attack ends the run with success once w.time reaches it (scoreAttackLeft). weapon: equipped at the
 * spawn for its normal duration, or for the whole run when pickups are off. pickups off: no weapon
 * or drone pickups drop. drift: off, low (today) or high (2x), open drums only.
 */
export function applyFreePlay(w: World, fp: FreePlayConfig): void {
  const g = gs(w);
  g.lives = fp.lives === 'infinite' ? Number.POSITIVE_INFINITY : fp.lives;
  g.timeLimit = fp.length === 'endless' ? 0 : fp.length;
  setWeaponPickups(w, fp.pickups);
  if (fp.weapon !== null) {
    if (fp.pickups) equipWeapon(w, fp.weapon, w.x[0] ?? 0, w.y[0] ?? 0);
    else setPermanentWeapon(w, fp.weapon);
  }
  applyDriftOption(w.drift, fp.drift);
  // Free Play wells arrive over time (forge-leaver); 'many' arrives FREE_PLAY_ARRIVAL_GAP_SCALE as far apart.
  g.arrivalGapScale = fp.wells === 'many' ? FREE_PLAY_ARRIVAL_GAP_SCALE : 1;
}

/** Free Play score attack: seconds left (never below 0), or null for a run with no time limit. */
export function scoreAttackLeft(w: World): number | null {
  const limit = gs(w).timeLimit;
  return limit > 0 ? Math.max(0, limit - w.time) : null;
}

/**
 * R2: apply a par start bonus to a fresh game. life: one more life; bomb: one more bomb; weapon:
 * that base weapon active for its normal duration (WEAPON_DURATION), as if collected at the spawn.
 */
export function applyStartBonus(w: World, bonus: StartBonus): void {
  const g = gs(w);
  switch (bonus.kind) {
    case 'life':
      g.lives += 1;
      break;
    case 'bomb':
      g.bombs += 1;
      break;
    case 'weapon':
      equipWeapon(w, bonus.weapon, w.x[0] ?? 0, w.y[0] ?? 0);
      break;
  }
}

export const HUD_INTERVAL = 0.1;

/** Wiring port for Settings "Weapon pickups" (re-exported from weapons.ts). */
export { setWeaponPickups };
/** R2 render port: true while entity id is enraged (also readable as World.enraged[id] === 1). */
export { isEnraged } from './membrane';

export function createGame(level: LevelDef, opts: GameOptions = {}): World {
  registerSwarmBehaviours();
  const difficulty = opts.difficulty ?? 'normal';
  const base = opts.freePlay === undefined ? level : freePlayLevelRules(level, opts.freePlay);
  // R5: liveCapScale scales maxLiveEnemies once here, so every cap reader (spawners, gravity
  // wells, boss adds) sees the scaled value. Normal keeps the level object unchanged.
  // Tester 1: a scoreInTime target scales with parScale here too, so the sim, HUD, intro and
  // results all read one number (world.level.objective). Normal keeps the level unchanged.
  const lv = levelWithTarget(levelWithLiveCap(base, DIFFICULTY[difficulty].liveCapScale, ENTITY_CAP), difficulty);
  const w = createWorld(lv, opts.capacity, difficulty);
  const g = gs(w);
  if (opts.mode !== undefined) g.mode = opts.mode;
  if (opts.vibrate !== undefined) g.vibrate = opts.vibrate;
  if (opts.scoring !== undefined) g.scoring = opts.scoring;
  if (opts.logSpawns === true) g.spawnLog = [];
  if (opts.weaponPickups !== undefined) setWeaponPickups(w, opts.weaponPickups);
  if (opts.wellNova !== undefined) g.wellNovaOn = opts.wellNova;
  syncMultiplier(w);
  resetWellState(w); // GW4: level start, Restart and Retry begin with no wells, arrivals or nova snakes
  spawnWells(w);
  initLevelBoss(w); // V3: arms LevelDef.boss when present; nothing otherwise
  if (opts.freePlay !== undefined) applyFreePlay(w, opts.freePlay);
  // T4: pond ripples come from nova well deaths, so they play wherever wells do (Endless has none).
  if (g.mode === 'endless') w.pond.active = false;
  if (opts.startBonus !== undefined) applyStartBonus(w, opts.startBonus);
  watchPause(w);
  return w;
}

let unwatchPause: (() => void) | null = null;
/** The newest game (level start, Restart, Retry and Next each build a new one). */
let newest: World | null = null;

/**
 * GW3 (Chorus): 'game:pause' silences a sounding chainsaw ('sim:saw' { on: false }) for the newest
 * game only. Resume needs no hook: the first step after 'game:resume' with the aim stick still held
 * and the saw level above 0 emits 'sim:saw' { on: true } (weapons.ts setSaw).
 * GW4: a new game (level start, Restart, Retry, Next) first silences a saw the previous game left
 * sounding (a Retry from the results screen has no pause before it), so no saw carries over.
 */
function watchPause(w: World): void {
  if (newest !== null && newest !== w) pauseSaw(newest);
  newest = w;
  if (unwatchPause !== null) unwatchPause();
  unwatchPause = bus.on('game:pause', () => pauseGame(w));
}

/** The game paused (also wired to 'game:pause' by createGame): silences the saw. */
export function pauseGame(w: World): void {
  pauseSaw(w);
}

/** Swap the scoring hooks at runtime (Ledger wiring). */
export function setScoring(w: World, port: ScoringPort): void {
  gs(w).scoring = port;
  syncMultiplier(w);
}

/**
 * Debug and stress hook: while on, the ship cannot die (enemy contact, well cores), so a stress
 * scene keeps its entities. Normal play never sets it.
 */
export function setInvulnerable(w: World, on: boolean): void {
  gs(w).invulnerable = on;
}

/** Read only view of the session counters for HUD and debug. */
export function gameState(w: World): Readonly<GameState> {
  return gs(w);
}

/**
 * Start an Endless run (docs/01 section 2.2). The source supplies segment s; wire it as
 * (s) => generateEndlessSegment(def.endlessSeed, s). Segment 0 is requested here, segment s + 1
 * when segment s starts. Lives and bombs follow the EndlessDef award rules.
 */
export function createEndlessGame(def: EndlessDef, source: SegmentSource, opts: Omit<GameOptions, 'mode'> = {}): World {
  const seg0 = source(0);
  const w = createGame(endlessLevel(def, seg0), { ...opts, mode: 'endless' });
  startEndless(w, def, source, seg0);
  return w;
}

/**
 * The clock the objective reads (survive and scoreInTime): the wave clock, which pauses during the
 * respawn delay and while a boss level holds (docs/01 section 8, docs/13 boss rule 9). It is not
 * w.time, which keeps running through both. HUD countdowns should read this so "0:00" and
 * "Defeat the boss" show when the sim's own test passes, not seconds early.
 */
export function objectiveClock(w: World): number {
  return gs(w).waveClock;
}

/** True while the entity is telegraphing (render: draw at 50 percent alpha, flashing). */
export function isTelegraphing(w: World, id: number): boolean {
  return (gs(w).tele[id] ?? 0) > 0;
}

/** Telegraph seconds left for id, 0 when live (render: flash phase and fade in). */
export function telegraphLeft(w: World, id: number): number {
  return gs(w).tele[id] ?? 0;
}

function emitHud(w: World, dt: number): void {
  const g = gs(w);
  g.hudTimer -= dt;
  if (g.hudTimer > 0) return;
  g.hudTimer += HUD_INTERVAL;
  if (g.hudTimer < 0) g.hudTimer = 0;
  const h = g.hud;
  h.score = g.score;
  h.multiplier = currentMultiplier(w);
  h.lives = g.lives;
  h.bombs = g.bombs;
  h.superCharge = g.superCharge / SUPER_CHARGE_MAX;
  bus.emit('hud:score', h);
}

export function stepGame(w: World, dt: number, input: InputState): void {
  const g = gs(w);
  if (g.outcome !== 'running') return;
  stepWorld(w, dt, input);
  stepPond(w, dt); // T4: nova well ripples expire and push (no op with no live wave)
  stepWeapons(w, dt);
  stepWellArrivals(w); // GW2: wells arriving in play (telegraph, then live)
  stepWells(w, dt);
  separate(w, dt);
  bulletHits(w);
  orbitHits(w, dt);
  shipHits(w);
  bossContacts(w, dt); // V3: boss body, lethal hazards and pulls (no op without a boss)
  stepEnemyBullets(w, dt); // V3: boss bullets, charge, flight and ship contact (no op without a pool)
  shipPickups(w);
  stepPlayer(w, dt, input);
  stepDrone(w, dt);
  if (input.superPressed) triggerSuper(w);
  stepSupers(w, dt);
  stepSpawner(w, dt);
  stepBossSchedule(w, dt); // V3: boss entrance at boss.atSec, view mode, hud:boss
  stepEndlessAwards(w);
  stepObjective(w);
  if (g.outcome !== 'running') {
    clearPickup(w); // level end clears the weapon pickup
    clearEnemyBullets(w); // and every boss bullet (docs/13 boss projectiles rule 9)
  }
  stepPresence(w, dt); // bus only: enter, exit and threat (docs/10 wave C)
  emitHud(w, dt);
}
