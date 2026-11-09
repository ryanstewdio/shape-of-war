// Level validator, docs/02-level-generator.md section 11. Pure: no Date, no PRNG, no DOM.
// validateLevel collects every failure and never stops at the first. Every error string starts
// with the invariant id, for example "A3: obstacle 1 spawn clearance 120.0 < 200".
import {
  ARENA_SHAPES,
  BANDS,
  DRONE_KINDS,
  ENDLESS_ARENA,
  ENDLESS_SEGMENT_SEC,
  ENEMY_KINDS,
  GENERATOR_VERSION,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
  GENERATOR_VERSION_V4,
  GENERATOR_VERSION_V5,
  GENERATOR_VERSION_V6,
  GENERATOR_VERSION_V7,
  GENERATOR_VERSION_V8,
  GENERATOR_VERSION_V9,
  GENERATOR_VERSION_V10,
  isT3Version,
  levelMaxLive,
  LEVELDEF_VERSION,
  LONG_BANDS,
  LONG_MIN_REPEAT_SEC,
  MAX_RETRIES,
  R1_STAR_MULS,
  hasR1Stars,
  isLongVersion,
  isR3Version,
  r3ObjectiveTable,
  SPAWN_PATTERNS,
  SUPER_KINDS,
  bandOf,
  effectiveIndexOf,
  forEachSpawn,
  levelSeed,
  segmentSeed,
  speedScaleFor,
} from './leveldef';
import { DRUM_BAR_THICK, MEMBRANE_MAX, MEMBRANE_MIN } from './drum';
import { BOSS_LEVEL_AT_SEC, BOSS_LONG_LEVEL_AT_SEC, BOSS_MAX_WELLS, BOSS_R3_LEVEL_AT_SEC, BOSS_V5_LEVEL_AT_SEC, BOSS_SEGMENT_AT_SEC, FIRST_FIGHT_HP_MUL, bossForLevel, bossForSegment, bossTierOf, freePlayBossFor, sameBoss, t3BossForLevel } from './boss';
import type {
  ArenaDef,
  Band,
  BossSpec,
  EndlessDef,
  EndlessSegmentDef,
  EnemyKind,
  FreePlayArena,
  FreePlayLevelOptions,
  LevelDef,
  Obstacle,
  RosterEntry,
  ValidationResult,
  Vec2,
  WaveSchedule,
} from './leveldef';
import { ALL_ENEMY_KINDS, isV2Kind } from './v2enemies';
import { LEAVER_FROM_LEVEL, LEAVER_FROM_SEGMENT } from './leveldef';
import type { FreePlayDensity, FreePlaySize } from '../core/freeplayConfig';
import {
  CYLINDER_MAX_OBSTACLES,
  CYLINDER_WIDTH_STEP,
  DRUM_TASTE_KINDS,
  DRUM_TASTE_LEVEL,
  cylDist,
  cylObstacleDistance,
  cylObstacleGap,
  cylinderEligible,
  drumConnected,
  insideRims,
  seamJoined,
} from './cylinder';

// Constants shared with the W2 generator. docs/02 sections 6, 7, 8, 9, 11.
export const ARENA_MIN_HEIGHT = 700;
export const ARENA_MAX_HEIGHT = 1100;
export const ARENA_MAX_WIDTH = 1800;
export const ARENA_MIN_ASPECT = 1.0;
export const ARENA_MAX_ASPECT = 1.8;
export const HEX_ASPECT = 1.1547005;
export const HEX_COS30 = 0.8660254;
export const SPAWN_INSIDE_MARGIN = 100;
export const OBSTACLE_SPAWN_CLEAR = 200;
export const OBSTACLE_EDGE_GAP = 80;
export const OBSTACLE_PAIR_GAP = 80;
export const MAX_OBSTACLES = 3;
export const CONNECT_CELL = 20;
/** A6 on a cylinder: wrapped flood cell, divides every width that is a multiple of 64. */
export const DRUM_CONNECT_CELL = 16;
export const CONNECT_CLEARANCE = 12; // ship radius 10 plus 2
export const CONNECT_MIN_FRACTION = 0.85;
export const ENTRY_EDGE_MARGIN = 40;
export const ENTRY_OBSTACLE_CLEAR = 30;
export const ENTRY_SPAWN_CLEAR = 180;
export const RING_MIN_RADIUS = 260;
export const RING_MAX_RADIUS = 340;
export const MAX_T_OFFSET_SEC = 5;
export const FIRST_WAVE_SEC = 2.5;
export const KILL_RATE = 0.7;
export const MAX_EST_SEC = 600;
export const MAX_WELLS = 3;
export const WELL_SPAWN_FLOOR = 360;
export const WELL_SPAWN_WIDTH_FRACTION = 0.25;
export const WELL_EDGE = 120;
export const WELL_OBSTACLE = 100;
export const WELL_PAIR = 400;
export const MAX_SPAWNERS = 2;
export const SPAWNER_EDGE = 80;
export const SPAWNER_SPAWN_WIDTH_FRACTION = 0.35;
export const SPAWNER_WELL = 200;
export const SPAWNER_OBSTACLE = 60;
export const PAR_MIN = 1000;
export const PAR_STEP = 500;
export const LIVES = 3;
export const BOMBS = 3;

// Fold fit (invariant F1). The whole arena is always visible (docs/01 section 2.3), so any arena
// "fits" by scaling down; what can fail is the ship becoming too small to read. Safe rects are in
// physical pixels: full screen minus the 40 CSS px HUD band at an assumed DPR of 3 (120 px).
// Cutout insets are unknown until G1 and taken as 0 here.
export const SHIP_RADIUS = 10;
export const MIN_SHIP_PX = 16;

export interface SafeRect {
  name: string;
  width: number;
  height: number;
}

export const FOLD_SAFE_RECTS: readonly SafeRect[] = [
  { name: '21:9 cover', width: 2520, height: 1080 - 120 },
  { name: '10:9 main', width: 2184, height: 1968 - 120 },
];

/** Same rule as fitArena in docs/04: scale = min(safeW / arenaW, safeH / arenaH). */
export function fitScale(arenaW: number, arenaH: number, rect: SafeRect): number {
  return Math.min(rect.width / arenaW, rect.height / arenaH);
}

// Geometry helpers.

const EPS = 1e-6;

/** True if p is inside the arena shape shrunk by margin. docs/02 section 6.1. */
export function insideArena(arena: ArenaDef, p: Vec2, margin: number): boolean {
  const hw = arena.width / 2;
  const hh = arena.height / 2;
  const ax = Math.abs(p.x);
  const ay = Math.abs(p.y);
  switch (arena.shape) {
    case 'rect':
    case 'rectObstacles':
      return ax <= hw - margin + EPS && ay <= hh - margin + EPS;
    case 'roundRect': {
      if (ax > hw - margin + EPS || ay > hh - margin + EPS) return false;
      const r = arena.cornerRadius;
      const cx = hw - r;
      const cy = hh - r;
      if (ax <= cx || ay <= cy) return true;
      return Math.hypot(ax - cx, ay - cy) <= r - margin + EPS;
    }
    case 'circle': {
      const lim = hw - margin;
      return lim >= 0 && p.x * p.x + p.y * p.y <= lim * lim + EPS;
    }
    case 'hexagon': {
      const apo = HEX_COS30 * hw - margin;
      return ay <= apo + EPS && HEX_COS30 * ax + 0.5 * ay <= apo + EPS;
    }
  }
}

/** Distance from a point to an axis-aligned obstacle; 0 if inside. */
export function obstaclePointDistance(o: Obstacle, p: Vec2): number {
  const dx = Math.max(Math.abs(p.x - o.cx) - o.w / 2, 0);
  const dy = Math.max(Math.abs(p.y - o.cy) - o.h / 2, 0);
  return Math.hypot(dx, dy);
}

/** Gap between two axis-aligned obstacles; 0 if they touch or overlap. */
export function obstacleGap(a: Obstacle, b: Obstacle): number {
  const dx = Math.max(Math.abs(a.cx - b.cx) - (a.w + b.w) / 2, 0);
  const dy = Math.max(Math.abs(a.cy - b.cy) - (a.h + b.h) / 2, 0);
  return Math.hypot(dx, dy);
}

export function obstacleCorners(o: Obstacle): Vec2[] {
  const hw = o.w / 2;
  const hh = o.h / 2;
  return [
    { x: o.cx - hw, y: o.cy - hh },
    { x: o.cx + hw, y: o.cy - hh },
    { x: o.cx - hw, y: o.cy + hh },
    { x: o.cx + hw, y: o.cy + hh },
  ];
}

/** Inscribed radius of the arena around the origin: distance from centre to the nearest wall. */
export function inscribedRadius(arena: ArenaDef): number {
  if (arena.shape === 'hexagon') return HEX_COS30 * (arena.width / 2);
  return Math.min(arena.width, arena.height) / 2;
}

/**
 * Grid flood fill, docs/02 section 6.3. True if every walkable cell is reachable from the spawn
 * cell and walls remove at most 15 percent of the open floor.
 */
export function isArenaConnected(arena: ArenaDef): boolean {
  const key = connectKey(arena);
  const hit = connectCache.get(key);
  if (hit !== undefined) return hit;
  const ok = floodConnected(arena);
  if (connectCache.size >= CONNECT_CACHE_MAX) connectCache.clear();
  connectCache.set(key, ok);
  return ok;
}

/**
 * Memo for isArenaConnected. The answer depends only on the fields in connectKey, and Number to
 * string is exact, so a hit returns what the flood fill would. It pays off because the validator
 * re-checks the arena the generator just placed, and walled-free arenas repeat across levels.
 */
const connectCache = new Map<string, boolean>();
const CONNECT_CACHE_MAX = 4096;

function connectKey(arena: ArenaDef): string {
  let k = `${arena.shape}|${arena.width}|${arena.height}|${arena.cornerRadius}|${arena.spawnPoint.x}|${arena.spawnPoint.y}`;
  for (const o of arena.obstacles) k += `|${o.cx},${o.cy},${o.w},${o.h}`;
  return k;
}

/**
 * obstaclePointDistance(o, p) >= clearance without the Math.hypot call when one axis already
 * clears: hypot(dx, dy) is never below max(dx, dy), so the answer is the same.
 */
function clearOfObstacle(o: Obstacle, x: number, y: number, clearance: number): boolean {
  const dx = Math.max(Math.abs(x - o.cx) - o.w / 2, 0);
  const dy = Math.max(Math.abs(y - o.cy) - o.h / 2, 0);
  if (dx >= clearance || dy >= clearance) return true;
  return Math.hypot(dx, dy) >= clearance;
}

function floodConnected(arena: ArenaDef): boolean {
  const nx = Math.ceil(arena.width / CONNECT_CELL);
  const ny = Math.ceil(arena.height / CONNECT_CELL);
  if (!(nx > 0 && ny > 0) || nx * ny > 1_000_000) return false;
  const x0 = -arena.width / 2;
  const y0 = -arena.height / 2;
  const walk = new Uint8Array(nx * ny);
  let inside = 0;
  let walkable = 0;
  const obstacles = arena.obstacles;
  const c = { x: 0, y: 0 };
  for (let j = 0; j < ny; j++) {
    c.y = y0 + (j + 0.5) * CONNECT_CELL;
    for (let i = 0; i < nx; i++) {
      c.x = x0 + (i + 0.5) * CONNECT_CELL;
      if (!insideArena(arena, c, CONNECT_CLEARANCE)) continue;
      inside++;
      let clear = true;
      for (let n = 0; n < obstacles.length && clear; n++) {
        const o = obstacles[n];
        if (o !== undefined) clear = clearOfObstacle(o, c.x, c.y, CONNECT_CLEARANCE);
      }
      if (clear) {
        walk[j * nx + i] = 1;
        walkable++;
      }
    }
  }
  const si = Math.min(nx - 1, Math.max(0, Math.floor((arena.spawnPoint.x - x0) / CONNECT_CELL)));
  const sj = Math.min(ny - 1, Math.max(0, Math.floor((arena.spawnPoint.y - y0) / CONNECT_CELL)));
  const start = sj * nx + si;
  if (walk[start] !== 1) return false;
  const queue = new Int32Array(walkable);
  const seen = new Uint8Array(nx * ny);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  const visit = (n: number): void => {
    if (seen[n] === 1 || walk[n] !== 1) return;
    seen[n] = 1;
    queue[tail++] = n;
  };
  while (head < tail) {
    const k = queue[head++] ?? 0;
    const i = k % nx;
    const j = (k - i) / nx;
    if (i > 0) visit(k - 1);
    if (i < nx - 1) visit(k + 1);
    if (j > 0) visit(k - nx);
    if (j < ny - 1) visit(k + nx);
  }
  return tail === walkable && walkable >= CONNECT_MIN_FRACTION * inside;
}

// JSON checks.

/** Path of the first difference between a and its JSON round trip, or null if deep equal. */
export function jsonDiff(a: unknown, b: unknown, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return path;
  if (Array.isArray(a) !== Array.isArray(b)) return path;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return path;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(rb, k)) return `${path}.${k}`;
    const d = jsonDiff(ra[k], rb[k], `${path}.${k}`);
    if (d !== null) return d;
  }
  return null;
}

/**
 * Path suffix (".a.0.b") of the first value a JSON.stringify then JSON.parse round trip would not
 * give back deep equal, "" for the root, or null if it round trips. Walks the value without
 * serialising (J1 on a band 4 level was most of the generator's time). Fails on: non finite
 * numbers and -0, undefined, functions, symbols, bigints, array holes, toJSON, non plain objects.
 */
export function jsonRoundTripDiff(v: unknown): string | null {
  switch (typeof v) {
    case 'string':
    case 'boolean':
      return null;
    case 'number':
      return Number.isFinite(v) && !Object.is(v, -0) ? null : '';
    case 'object': {
      if (v === null) return null;
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (!(i in v)) return `.${i}`;
          const d = jsonRoundTripDiff(v[i]);
          if (d !== null) return `.${i}${d}`;
        }
        return null;
      }
      const proto: unknown = Object.getPrototypeOf(v);
      if ((proto !== Object.prototype && proto !== null) || 'toJSON' in v) return '';
      const rec = v as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        const d = jsonRoundTripDiff(rec[k]);
        if (d !== null) return `.${k}${d}`;
      }
      return null;
    }
    default:
      return '';
  }
}

/** Paths of values JSON cannot carry exactly: non finite numbers, functions, undefined, symbols, bigints. */
export function nonJsonValues(v: unknown, path = '$', out: string[] = []): string[] {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path} = ${String(v)}`);
  } else if (typeof v === 'function' || typeof v === 'undefined' || typeof v === 'symbol' || typeof v === 'bigint') {
    out.push(`${path} is ${typeof v}`);
  } else if (typeof v === 'object' && v !== null) {
    for (const [k, child] of Object.entries(v)) nonJsonValues(child, `${path}.${k}`, out);
  }
  return out;
}

// Check runner.

type Report = (msg: string) => void;

class Collector {
  readonly errors: string[] = [];

  check(id: string, fn: (report: Report) => void): void {
    const report: Report = (msg) => this.errors.push(`${id}: ${msg}`);
    try {
      fn(report);
    } catch (e) {
      report(`check threw on malformed def (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  result(): ValidationResult {
    return { ok: this.errors.length === 0, errors: this.errors };
  }
}

const f1 = (v: number): string => v.toFixed(1);
const isInt = (v: number): boolean => Number.isInteger(v);
/** Any EnemyKind, v1 or v2. Mine and Slime are hazards with no EnemyKind, so they fail here. */
const isKind = (k: string): k is EnemyKind => (ALL_ENEMY_KINDS as readonly string[]).includes(k);
const inRange = (v: number, lo: number, hi: number): boolean => v >= lo - EPS && v <= hi + EPS;
const onStep = (v: number, lo: number, step: number): boolean => Math.abs((v - lo) / step - Math.round((v - lo) / step)) < EPS;

/**
 * One walk that is true only when J1 and J2 both have nothing to report: every reachable value is
 * a string, boolean, null or finite non -0 number, every array is dense with no extra keys, and
 * every object is plain with no toJSON. On such a value jsonRoundTripDiff returns null and
 * nonJsonValues (which walks the same keys) finds nothing, so checkJson can skip both walks.
 * Anything else returns false and the exact checks run. Primitives are tested inline so the
 * common leaf costs no call.
 */
export function isPlainJson(v: unknown): boolean {
  if (typeof v !== 'object') return isPlainJsonLeaf(v);
  if (v === null) return true;
  if (Array.isArray(v)) {
    const arr: readonly unknown[] = v;
    for (let i = 0; i < arr.length; i++) {
      if (!(i in arr)) return false;
      const x = arr[i];
      if (typeof x === 'object' ? !isPlainJson(x) : !isPlainJsonLeaf(x)) return false;
    }
    return Object.keys(arr).length === arr.length;
  }
  const proto: unknown = Object.getPrototypeOf(v);
  if ((proto !== Object.prototype && proto !== null) || 'toJSON' in v) return false;
  const rec = v as Record<string, unknown>;
  const keys = Object.keys(rec);
  for (let i = 0; i < keys.length; i++) {
    const x = rec[keys[i] ?? ''];
    if (typeof x === 'object' ? !isPlainJson(x) : !isPlainJsonLeaf(x)) return false;
  }
  return true;
}

function isPlainJsonLeaf(v: unknown): boolean {
  switch (typeof v) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(v) && !Object.is(v, -0);
    default:
      return false;
  }
}

function checkJson(c: Collector, def: unknown): void {
  // Fast path: a clean def gets the same (empty) result from J1 and J2 in one walk.
  // A throwing getter falls through to the exact checks, which report it.
  let clean = false;
  try {
    clean = isPlainJson(def);
  } catch {
    clean = false;
  }
  if (clean) return;
  c.check('J1', (report) => {
    const d = jsonRoundTripDiff(def);
    if (d !== null) report(`JSON round trip differs at $${d} (serialisation)`);
  });
  c.check('J2', (report) => {
    for (const p of nonJsonValues(def)) report(`non JSON value at ${p} (serialisation)`);
  });
}

function checkVersions(c: Collector, version: number, generatorVersion: number): void {
  c.check('J3', (report) => {
    if (version !== LEVELDEF_VERSION) report(`version ${version} !== ${LEVELDEF_VERSION}`);
    const known = [GENERATOR_VERSION, GENERATOR_VERSION_V2, GENERATOR_VERSION_V3, GENERATOR_VERSION_V4, GENERATOR_VERSION_V5, GENERATOR_VERSION_V6, GENERATOR_VERSION_V7, GENERATOR_VERSION_V8, GENERATOR_VERSION_V9, GENERATOR_VERSION_V10];
    if (!known.includes(generatorVersion)) report(`generatorVersion ${generatorVersion} not ${known.join(', ')}`);
  });
}

/**
 * What the validator may know about the config that made a def. A GenConfig fits. Without it the
 * boss checks cannot tell a flag off def from a flag on one, so a boss level with no boss passes
 * B1 and J7 is skipped; every other boss check runs either way.
 */
export interface BossCheckOptions {
  enableBosses: boolean;
}

/**
 * What validateLevel may know about the config that made a def. A GenConfig fits. enableCylinder
 * false makes V1 reject a cylinder def; absent, a cylinder def is judged on C1 alone.
 */
export interface LevelCheckOptions extends BossCheckOptions {
  enableCylinder?: boolean;
  /** Release polish: true or false makes J8 tie GENERATOR_VERSION_V5 to the flag; absent skips J8. */
  enableLongLevels?: boolean;
  /** Release gate R1: with enableLongLevels true, true or false makes J9 tie GENERATOR_VERSION_V6 to the flag. */
  enableR1Pacing?: boolean;
  /** Release gate R3: with enableLongLevels and enableR1Pacing true, J10 ties GENERATOR_VERSION_V8 to this flag. */
  enableR3Length?: boolean;
  /** Tester 3: with the version 8 flags on, J10 and J11 tie GENERATOR_VERSION_V9 to this flag. */
  enableT3?: boolean;
  /** Tester Tom: with the version 9 flags on, J11 and J12 tie GENERATOR_VERSION_V10 to this flag. */
  enableParRamp?: boolean;
}

interface BossRules {
  /** What the schedule says for this level or segment (null: not a boss level or segment). */
  want: BossSpec | null;
  /** For messages: 'level' or 'segment', and its index. */
  unit: 'level' | 'segment';
  index: number;
  atSec: number;
  /** Seconds of objective time on a timed level (survive or scoreInTime), else null. */
  timedSec: number | null;
}

/**
 * B1 to B3 and J7 (docs/13 SPEC 3.3 rule 7). B1: a boss is present exactly when the schedule says
 * so (both ways only when opts says the flag is on), equals the schedule's spec, and comes with
 * GENERATOR_VERSION_V3, which nothing else carries. B2: id in BOSS_IDS and tier from the table.
 * B3: atSec is the fixed entrance second and a timed level has at least 20 s left after it. J7:
 * with the flag off there is no boss field and no version 3.
 */
function checkBoss(c: Collector, boss: BossSpec | undefined, generatorVersion: number, rules: BossRules, opts: BossCheckOptions | undefined): void {
  c.check('B1', (report) => {
    const { want, unit, index } = rules;
    if (boss !== undefined) {
      if (want === null) report(`boss ${String(boss.id)} on ${unit} ${index}, which is not a boss ${unit}`);
      else if (!sameBoss(boss, want)) {
        report(`boss ${String(boss.id)} tier ${boss.tier} at ${boss.atSec} s x${boss.hpMul} !== schedule ${want.id} tier ${want.tier} at ${want.atSec} s x${want.hpMul}`);
      }
      if (generatorVersion !== GENERATOR_VERSION_V3 && !isLongVersion(generatorVersion)) {
        report(`boss present with generatorVersion ${generatorVersion}, want ${GENERATOR_VERSION_V3}, ${GENERATOR_VERSION_V5}, ${GENERATOR_VERSION_V6}, ${GENERATOR_VERSION_V7} or ${GENERATOR_VERSION_V8}`);
      }
    } else {
      if (generatorVersion === GENERATOR_VERSION_V7 && unit === 'level') report(`generatorVersion ${GENERATOR_VERSION_V7} without a boss`);
      if (generatorVersion === GENERATOR_VERSION_V3) report(`generatorVersion ${GENERATOR_VERSION_V3} without a boss`);
      if (want !== null && opts?.enableBosses === true) report(`${unit} ${index} is a boss ${unit} (${want.id}) but has no boss`);
    }
  });
  c.check('B2', (report) => {
    if (boss === undefined) return;
    const tier = bossTierOf(boss.id);
    if (tier === null) report(`boss id ${String(boss.id)} not in BOSS_IDS`);
    else if (boss.tier !== tier) report(`boss ${boss.id} tier ${boss.tier} !== table tier ${tier}`);
    // Tester 3: the first fight of a version 9 run sits at FIRST_FIGHT_HP_MUL (B1 checks the exact value).
    if (!(boss.hpMul >= FIRST_FIGHT_HP_MUL) || !Number.isFinite(boss.hpMul)) report(`boss hpMul ${boss.hpMul} not a finite number from ${FIRST_FIGHT_HP_MUL}`);
  });
  c.check('B3', (report) => {
    if (boss === undefined) return;
    if (boss.atSec !== rules.atSec) report(`boss atSec ${boss.atSec} !== ${rules.atSec}`);
    const T = rules.timedSec;
    if (T !== null && T - boss.atSec < BOSS_MIN_LEFT_SEC) report(`only ${T - boss.atSec} s of a ${T} s objective left after the boss at ${boss.atSec} s, want ${BOSS_MIN_LEFT_SEC}`);
  });
  c.check('J7', (report) => {
    if (opts?.enableBosses !== false) return;
    if (boss !== undefined) report(`boss field present with enableBosses off`);
    if (generatorVersion === GENERATOR_VERSION_V3) report(`generatorVersion ${GENERATOR_VERSION_V3} with enableBosses off`);
  });
}

/** B3: least objective time a survive or scoreInTime boss level keeps after the entrance. */
export const BOSS_MIN_LEFT_SEC = 20;

/**
 * J6: the generator version matches the content. Version 1 (the v1 algorithm alone) never names a
 * v2 kind; version 2 (the v2 enemy stage ran) never applies to band 1. band is null for an
 * EndlessDef, which spans every band.
 */
function checkV2Content(c: Collector, generatorVersion: number, band: Band | null, kinds: () => readonly string[]): void {
  c.check('J6', (report) => {
    if (generatorVersion === GENERATOR_VERSION) {
      const v2 = [...new Set(kinds().filter(isV2Kind))];
      if (v2.length > 0) report(`generatorVersion ${GENERATOR_VERSION} names v2 kinds ${v2.join(', ')}`);
    }
    if (generatorVersion === GENERATOR_VERSION_V2 && band === 1) report(`generatorVersion ${GENERATOR_VERSION_V2} in band 1`);
  });
}

/** Every kind a schedule and roster name, for J6. */
function namedKinds(roster: readonly RosterEntry[], ws: WaveSchedule): string[] {
  const out: string[] = roster.map((e) => e.kind);
  for (const w of ws.waves) for (const e of w.entries) out.push(e.kind);
  return out;
}

/**
 * R1. leaverOk: the Leaver may join (Adventure from LEAVER_FROM_LEVEL, Endless from
 * LEAVER_FROM_SEGMENT). The Leaver joins on top of the drawn roster, so it may make it 7 long.
 */
function checkRoster(c: Collector, roster: readonly RosterEntry[], band: Band, leaverOk: boolean): void {
  c.check('R1', (report) => {
    const max = 6 + (roster.some((e) => e.kind === 'leaver') ? 1 : 0);
    if (roster.length < 3 || roster.length > max) report(`roster size ${roster.length} outside 3 to ${max}`);
    const seen = new Set<string>();
    for (const e of roster) {
      if (!isKind(e.kind)) {
        report(`unknown enemy kind ${String(e.kind)}`);
        continue;
      }
      if (seen.has(e.kind)) report(`duplicate roster kind ${e.kind}`);
      seen.add(e.kind);
      if (e.kind === 'leaver') {
        if (!leaverOk) report(`leaver not eligible here (band ${band})`);
      } else if (BANDS[band].rosterWeights[e.kind] <= 0) report(`${e.kind} not eligible in band ${band}`);
      if (!(e.weight > 0)) report(`${e.kind} weight ${e.weight} not positive`);
    }
    if (!seen.has('grunt')) report('roster lacks grunt');
  });
}

function checkSpeed(c: Collector, speedScale: number, index: number): void {
  c.check('R2', (report) => {
    if (!inRange(speedScale, 1, 1.4)) report(`speedScale ${speedScale} outside 1.00 to 1.40`);
    const want = speedScaleFor(index);
    if (Math.abs(speedScale - want) > EPS) report(`speedScale ${speedScale} !== table value ${want}`);
  });
}

interface WaveRules {
  firstAtSec: number;
  maxLive: number;
  /** null: levels (loop required). Otherwise segment bound on atSec. */
  segmentSec: number | null;
}

/**
 * Point geometry of a surface. Flat: insideArena and plain distances. Cylinder: the margin applies
 * to the rims only (x must be canonical, in [-W/2, W/2)) and every distance wraps in u.
 */
interface Geometry {
  inside(p: Vec2, margin: number): boolean;
  dist(a: Vec2, b: Vec2): number;
  obstacle(o: Obstacle, p: Vec2): number;
}

function geometryOf(arena: ArenaDef, cylinder: boolean): Geometry {
  if (cylinder) {
    const W = arena.width;
    return {
      inside: (p, m) => insideRims(arena, p, m),
      dist: (a, b) => cylDist(a, b, W),
      obstacle: (o, p) => cylObstacleDistance(o, p, W),
    };
  }
  return {
    inside: (p, m) => insideArena(arena, p, m),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    obstacle: obstaclePointDistance,
  };
}

function checkWaves(c: Collector, ws: WaveSchedule, arena: ArenaDef, roster: readonly RosterEntry[], rules: WaveRules, cylinder = false): void {
  c.check('W1', (report) => {
    const first = ws.waves[0];
    if (first === undefined) report('no waves');
    else if (Math.abs(first.atSec - rules.firstAtSec) > EPS) report(`first wave atSec ${first.atSec} !== ${rules.firstAtSec}`);
  });
  c.check('W2', (report) => {
    ws.waves.forEach((w, i) => {
      if (w.index !== i) report(`wave ${i} has index ${w.index}`);
      if (!SPAWN_PATTERNS.includes(w.pattern)) report(`wave ${i} unknown pattern ${String(w.pattern)}`);
      const prev = ws.waves[i - 1];
      if (prev !== undefined && !(w.atSec > prev.atSec)) report(`wave ${i} atSec ${w.atSec} not after ${prev.atSec}`);
    });
  });
  c.check('W3', (report) => {
    const kinds = new Set<string>(roster.map((e) => e.kind));
    ws.waves.forEach((w, i) => {
      w.entries.forEach((e, k) => {
        if (!kinds.has(e.kind)) report(`wave ${i} entry ${k} kind ${e.kind} not in roster`);
      });
    });
  });
  c.check('W4', (report) => {
    ws.waves.forEach((w, i) => {
      w.entries.forEach((e, k) => {
        if (e.mode !== 'fixed') return;
        const g = geometryOf(arena, cylinder);
        const p = { x: e.x, y: e.y };
        const at = (): string => `wave ${i} entry ${k} (${f1(e.x)}, ${f1(e.y)})`;
        if (!g.inside(p, ENTRY_EDGE_MARGIN)) report(`${at()} outside arena bounds margin ${ENTRY_EDGE_MARGIN}`);
        const ds = g.dist(p, arena.spawnPoint);
        if (ds < ENTRY_SPAWN_CLEAR) report(`${at()} spawn clearance ${f1(ds)} < ${ENTRY_SPAWN_CLEAR}`);
        arena.obstacles.forEach((o, j) => {
          const d = g.obstacle(o, p);
          if (d < ENTRY_OBSTACLE_CLEAR) report(`${at()} within ${f1(d)} of obstacle ${j}`);
        });
      });
    });
  });
  c.check('W5', (report) => {
    ws.waves.forEach((w, i) => {
      w.entries.forEach((e, k) => {
        const at = (): string => `wave ${i} entry ${k}`;
        if (e.mode !== 'fixed' && e.mode !== 'ring') report(`${at()} unknown mode ${String(e.mode)}`);
        if (!isInt(e.headingDeg) || !inRange(e.headingDeg, 0, 359)) report(`${at()} headingDeg ${e.headingDeg} not an integer 0 to 359`);
        if (e.mode !== 'ring') return;
        if (!inRange(e.radius, RING_MIN_RADIUS, RING_MAX_RADIUS)) report(`${at()} ring radius ${e.radius} outside ${RING_MIN_RADIUS} to ${RING_MAX_RADIUS}`);
        if (!isInt(e.angleDeg) || !inRange(e.angleDeg, 0, 359)) report(`${at()} angleDeg ${e.angleDeg} not an integer 0 to 359`);
      });
    });
  });
  c.check('W6', (report) => {
    ws.waves.forEach((w, i) => {
      w.entries.forEach((e, k) => {
        if (!inRange(e.tOffsetSec, 0, MAX_T_OFFSET_SEC)) report(`wave ${i} entry ${k} tOffsetSec ${e.tOffsetSec} outside 0 to ${MAX_T_OFFSET_SEC}`);
      });
    });
  });
  c.check('W7', (report) => {
    if (ws.maxLiveEnemies !== rules.maxLive) report(`maxLiveEnemies ${ws.maxLiveEnemies} !== band value ${rules.maxLive}`);
  });
  c.check('W8', (report) => {
    if (rules.segmentSec === null) {
      if (!isInt(ws.loopFromIndex) || ws.waves[ws.loopFromIndex] === undefined) report(`loopFromIndex ${ws.loopFromIndex} is not a wave index`);
      if (!(ws.loopPeriodSec > 0)) report(`loopPeriodSec ${ws.loopPeriodSec} not positive`);
    } else {
      if (ws.loopFromIndex !== -1 || ws.loopPeriodSec !== 0) report(`segment loop fields ${ws.loopFromIndex}, ${ws.loopPeriodSec} must be -1, 0`);
    }
  });
}

/**
 * circleObstacles (Free Play only): a circle arena may carry 0 to MAX_OBSTACLES obstacles.
 * sizeScale (Free Play arena size only): the A1 height and width bounds widen by it (below 1 the
 * floor, above 1 the ceilings) and the F1 ship floor shrinks by it above 1.
 */
function checkArena(c: Collector, arena: ArenaDef, cylinder = false, circleObstacles = false, sizeScale = 1): void {
  const lo = Math.min(1, sizeScale);
  const hi = Math.max(1, sizeScale);
  c.check('A1', (report) => {
    const { shape, width: w, height: h } = arena;
    const minH = ARENA_MIN_HEIGHT * lo;
    const maxH = ARENA_MAX_HEIGHT * hi;
    const maxW = ARENA_MAX_WIDTH * hi;
    if (!ARENA_SHAPES.includes(shape)) report(`unknown arena shape ${String(shape)}`);
    if (!inRange(h, minH, maxH)) report(`arena height ${h} outside bounds ${minH} to ${maxH}`);
    if (!(w > 0) || w > maxW + EPS) report(`arena width ${w} outside bounds 0 to ${maxW}`);
    const aspect = w / h;
    if (shape === 'circle') {
      if (w !== h) report(`circle width ${w} !== height ${h}`);
    } else if (shape === 'hexagon') {
      if (Math.abs(aspect - HEX_ASPECT) > 0.01) report(`hexagon aspect ${aspect.toFixed(4)} !== ${HEX_ASPECT}`);
    } else if (!inRange(aspect, ARENA_MIN_ASPECT, ARENA_MAX_ASPECT)) {
      report(`arena aspect ${aspect.toFixed(3)} outside bounds ${ARENA_MIN_ASPECT} to ${ARENA_MAX_ASPECT}`);
    }
  });
  c.check('F1', (report) => {
    for (const rect of FOLD_SAFE_RECTS) {
      const px = 2 * SHIP_RADIUS * fitScale(arena.width, arena.height, rect);
      const floor = MIN_SHIP_PX / hi;
      if (!(px >= floor - EPS)) report(`arena does not fit ${rect.name} safe rect: ship ${f1(px)} px < ${f1(floor)} px`);
    }
  });
  c.check('A2', (report) => {
    const s = arena.spawnPoint;
    if (s.x !== 0 || s.y !== 0) report(`spawnPoint (${s.x}, ${s.y}) is not (0, 0)`);
    if (!insideArena(arena, s, SPAWN_INSIDE_MARGIN)) report(`spawnPoint not inside arena with margin ${SPAWN_INSIDE_MARGIN}`);
  });
  // A3 to A6 on a cylinder (D13 drum layouts): distances and gaps wrap in u, the edge gap applies to
  // the rims only with every bar inside the canonical u range, up to CYLINDER_MAX_OBSTACLES bars,
  // the two halves of a bar cut at the seam count as one wall, and A6 is a wrapped flood fill.
  // Lazy so a malformed arena is reported by the check wrapper instead of throwing here.
  const wOf = (): number => arena.width;
  c.check('A3', (report) => {
    const W = wOf();
    arena.obstacles.forEach((o, i) => {
      const d = cylinder ? cylObstacleDistance(o, arena.spawnPoint, W) : obstaclePointDistance(o, arena.spawnPoint);
      if (d < OBSTACLE_SPAWN_CLEAR) report(`obstacle ${i} spawn clearance ${f1(d)} < ${OBSTACLE_SPAWN_CLEAR}`);
    });
  });
  c.check('A4', (report) => {
    const W = wOf();
    // Membranes (release polish) sit in a ring beside a bar and are counted by M1, not here.
    const n = arena.obstacles.filter((o) => o.membrane !== true).length;
    const max = cylinder ? CYLINDER_MAX_OBSTACLES : MAX_OBSTACLES;
    if (arena.shape === 'rectObstacles') {
      if (n < 1 || n > max) report(`rectObstacles has ${n} obstacles, want 1 to ${max}`);
    } else if (circleObstacles && arena.shape === 'circle') {
      if (n > max) report(`circle has ${n} obstacles, want 0 to ${max}`);
    } else if (n !== 0) {
      report(`${arena.shape} has ${n} obstacles, want 0`);
    }
    const within = (p: Vec2): boolean =>
      cylinder ? Math.abs(p.x) <= W / 2 + EPS && Math.abs(p.y) <= arena.height / 2 - OBSTACLE_EDGE_GAP + EPS : insideArena(arena, p, OBSTACLE_EDGE_GAP);
    arena.obstacles.forEach((o, i) => {
      if (!(o.w > 0 && o.h > 0)) report(`obstacle ${i} size ${o.w} x ${o.h} not positive`);
      if (!obstacleCorners(o).every(within)) {
        report(`obstacle ${i} outside arena bounds margin ${OBSTACLE_EDGE_GAP}`);
      }
    });
  });
  c.check('A5', (report) => {
    const W = wOf();
    arena.obstacles.forEach((a, i) => {
      arena.obstacles.slice(i + 1).forEach((b, k) => {
        if (cylinder && seamJoined(a, b, W)) return;
        if (cylinder && membraneJoined(a, b)) return;
        const g = cylinder ? cylObstacleGap(a, b, W) : obstacleGap(a, b);
        if (g < OBSTACLE_PAIR_GAP) report(`obstacles ${i} and ${i + k + 1} gap ${f1(g)} < ${OBSTACLE_PAIR_GAP}`);
      });
    });
  });
  c.check('A6', (report) => {
    const ok = cylinder ? drumConnected(arena, DRUM_CONNECT_CELL, CONNECT_CLEARANCE) : isArenaConnected(arena);
    if (!ok) report('walls seal part of the arena (not connected from spawn)');
  });
  c.check('A7', (report) => {
    const r = arena.cornerRadius;
    if (arena.shape === 'roundRect') {
      if (!inRange(r, 0.15 * arena.height - 0.05, 0.3 * arena.height + 0.05)) report(`cornerRadius ${r} outside 0.15 to 0.30 x height`);
    } else if (r !== 0) {
      report(`cornerRadius ${r} must be 0 for ${arena.shape}`);
    }
  });
}

function checkObjective(c: Collector, def: LevelDef, band: Band): void {
  const long = isLongVersion(def.generatorVersion);
  // Release gate R3: version 8 reads the R3 tables (boss levels keep the LONG_BANDS objectives).
  const l = isR3Version(def.generatorVersion) ? r3ObjectiveTable(band, def.boss !== undefined) : LONG_BANDS[band];
  const b = long ? { ...BANDS[band], surviveSec: l.surviveSec, scoreTimeSec: l.scoreTimeSec } : BANDS[band];
  const o = def.objective;
  c.check('O1', (report) => {
    if (long && o.kind === 'destroy') {
      // Long destroy: the count is sized from the waves, so the clear (the spawn numbered
      // ceil(count / KILL_RATE)) comes no sooner than the band's least clear second.
      if (!isInt(o.count) || o.count < 5 || o.count % 5 !== 0) report(`destroy count ${o.count} not a multiple of 5 from 5`);
      let before = 0;
      forEachSpawn(def.waves, l.destroySec.min, () => {
        before++;
      });
      if (Math.ceil(o.count / KILL_RATE) <= before) report(`destroy ${o.count} clears before ${l.destroySec.min} s (${before} spawns by then)`);
      return;
    }
    switch (o.kind) {
      case 'survive':
        if (!inRange(o.durationSec, b.surviveSec.min, b.surviveSec.max) || !onStep(o.durationSec, b.surviveSec.min, 5)) {
          report(`survive durationSec ${o.durationSec} outside band ${band} range ${b.surviveSec.min} to ${b.surviveSec.max} step 5`);
        }
        break;
      case 'destroy':
        if (!inRange(o.count, b.destroyCount.min, b.destroyCount.max) || !onStep(o.count, b.destroyCount.min, 5)) {
          report(`destroy count ${o.count} outside band ${band} range ${b.destroyCount.min} to ${b.destroyCount.max} step 5`);
        }
        break;
      case 'scoreInTime':
        if (!inRange(o.timeLimitSec, b.scoreTimeSec.min, b.scoreTimeSec.max) || !onStep(o.timeLimitSec, b.scoreTimeSec.min, 15)) {
          report(`scoreInTime timeLimitSec ${o.timeLimitSec} outside band ${band} range ${b.scoreTimeSec.min} to ${b.scoreTimeSec.max} step 15`);
        }
        break;
      default:
        report(`unknown objective kind ${String((o as { kind: unknown }).kind)}`);
    }
  });
  c.check('O2', (report) => {
    if (o.kind !== 'scoreInTime') return;
    if (!(o.target >= PAR_MIN) || o.target % PAR_STEP !== 0) report(`target ${o.target} not a multiple of ${PAR_STEP} at least ${PAR_MIN}`);
    if (o.target > def.par) report(`target ${o.target} above par ${def.par}`);
  });
  c.check('P1', (report) => {
    const p = def.par;
    if (!(p >= PAR_MIN) || p % PAR_STEP !== 0) report(`par ${p} not a multiple of ${PAR_STEP} at least ${PAR_MIN}`);
    const s = def.stars;
    // Release gate R1: version 6 stars sit at R1_STAR_MULS x par, each on the PAR_STEP grid (R3: version 8 too).
    const muls = hasR1Stars(def.generatorVersion) ? R1_STAR_MULS : ([1, 2, 4] as const);
    const want = muls.map((m) => (m === 1 ? p : Math.max(PAR_MIN, Math.round((m * p) / PAR_STEP) * PAR_STEP)));
    if (s.length !== 3 || s.some((v, i) => v !== want[i])) report(`stars [${s.join(', ')}] !== [${muls.map((m) => `${m} x par`).join(', ')}] for par ${p}`);
  });
  c.check('W9', (report) => {
    if (o.kind !== 'destroy') return;
    let n = 0;
    forEachSpawn(def.waves, MAX_EST_SEC, () => {
      n++;
    });
    if (n < o.count / KILL_RATE) report(`only ${n} spawns in ${MAX_EST_SEC} s for destroy ${o.count} (need ${Math.ceil(o.count / KILL_RATE)})`);
  });
  c.check('W11', (report) => {
    // Release polish: on a long level no wave plays again within LONG_MIN_REPEAT_SEC.
    if (!long) return;
    if (def.waves.loopPeriodSec < LONG_MIN_REPEAT_SEC) report(`loopPeriodSec ${def.waves.loopPeriodSec} < ${LONG_MIN_REPEAT_SEC}`);
  });
  c.check('W10', (report) => {
    if (o.kind === 'destroy') return;
    const T = o.kind === 'survive' ? o.durationSec : o.timeLimitSec;
    if (!def.waves.waves.some((w) => w.atSec <= 5)) report('no wave starts within the first 5 s');
    const late = forEachSpawn(def.waves, T, (t) => t >= 0.8 * T);
    if (!late) report(`no spawns in the last 20 percent of ${T} s`);
  });
}

function checkHazards(c: Collector, def: LevelDef, band: Band): void {
  const { arena, hazards } = def;
  // Lazy so a malformed arena is reported by the check wrapper instead of throwing here.
  const wellClear = (): number => Math.max(WELL_SPAWN_WIDTH_FRACTION * arena.width, WELL_SPAWN_FLOOR);
  const spawnerClear = (): number => SPAWNER_SPAWN_WIDTH_FRACTION * arena.width;
  const g = (): Geometry => geometryOf(arena, def.surface === 'cylinder');
  const fromSpawn = (p: Vec2): number => g().dist(p, arena.spawnPoint);
  c.check('H1', (report) => {
    const n = hazards.wells.length;
    if (n > MAX_WELLS) report(`hazards: ${n} gravity wells, want 0 to ${MAX_WELLS}`);
    hazards.wells.forEach((w, i) => {
      const d = fromSpawn(w);
      if (d < wellClear()) report(`well ${i} spawn clearance ${f1(d)} < ${f1(wellClear())}`);
      if (!g().inside(w, WELL_EDGE)) report(`well ${i} outside arena bounds margin ${WELL_EDGE}`);
      arena.obstacles.forEach((o, j) => {
        const d2 = g().obstacle(o, w);
        if (d2 < WELL_OBSTACLE) report(`well ${i} within ${f1(d2)} of obstacle ${j}`);
      });
    });
  });
  c.check('H2', (report) => {
    hazards.wells.forEach((a, i) => {
      hazards.wells.slice(i + 1).forEach((b, k) => {
        const d = g().dist(a, b);
        if (d < WELL_PAIR) report(`wells ${i} and ${i + k + 1} distance ${f1(d)} < ${WELL_PAIR}`);
      });
    });
  });
  c.check('H3', (report) => {
    const n = hazards.spawners.length;
    if (n > MAX_SPAWNERS) report(`hazards: ${n} spawners, want 0 to ${MAX_SPAWNERS}`);
    hazards.spawners.forEach((s, i) => {
      const d = fromSpawn(s);
      if (d < spawnerClear()) report(`spawner ${i} spawn clearance ${f1(d)} < ${f1(spawnerClear())}`);
      if (!g().inside(s, SPAWNER_EDGE)) report(`spawner ${i} outside arena bounds margin ${SPAWNER_EDGE}`);
      hazards.wells.forEach((w, j) => {
        const dw = g().dist(s, w);
        if (dw < SPAWNER_WELL) report(`spawner ${i} within ${f1(dw)} of well ${j}`);
      });
      arena.obstacles.forEach((o, j) => {
        const d2 = g().obstacle(o, s);
        if (d2 < SPAWNER_OBSTACLE) report(`spawner ${i} within ${f1(d2)} of obstacle ${j}`);
      });
      if (!(s.spawnAtSec >= 0) || !(s.emitEverySec > 0) || !(s.dartsPerEmit >= 1) || !isInt(s.dartsPerEmit)) {
        report(`spawner ${i} timing ${s.spawnAtSec}, ${s.emitEverySec}, ${s.dartsPerEmit} invalid`);
      }
    });
  });
  c.check('H4', (report) => {
    if (band === 1 && (hazards.wells.length > 0 || hazards.spawners.length > 0)) report('band 1 must have no hazards');
    if (band === 2 && hazards.spawners.length > 0) report('band 2 must have no spawners');
  });
  c.check('B4', (report) => {
    // Rule 12 (docs/13 SPEC 3.3 rule 5): a boss level has no spawners and at most one well.
    if (def.boss === undefined) return;
    if (hazards.spawners.length > 0) report(`boss level has ${hazards.spawners.length} spawners, want 0`);
    if (hazards.wells.length > BOSS_MAX_WELLS) report(`boss level has ${hazards.wells.length} gravity wells, want 0 to ${BOSS_MAX_WELLS}`);
  });
}

function checkLoadout(c: Collector, def: LevelDef): void {
  c.check('L1', (report) => {
    if (def.lives !== LIVES) report(`lives ${def.lives} !== ${LIVES}`);
    if (def.bombs !== BOMBS) report(`bombs ${def.bombs} !== ${BOMBS}`);
    if (!DRONE_KINDS.includes(def.drone)) report(`unknown drone ${String(def.drone)}`);
    if (!SUPER_KINDS.includes(def.superType)) report(`unknown superType ${String(def.superType)}`);
  });
}

/**
 * Validates a LevelDef against every docs/02 section 11 invariant plus F1 (fold fit) and the v3
 * boss invariants B1 to B4 and J7. Pass the GenConfig (or its enableBosses) that made the def to
 * make B1 strict both ways and to run J7; generateLevel does.
 */
export function validateLevel(def: LevelDef, opts?: LevelCheckOptions): ValidationResult {
  const c = new Collector();
  checkJson(c, def);
  checkVersions(c, def.version, def.generatorVersion);
  const band = bandOf(def.levelIndex);
  c.check('J4', (report) => {
    if (!isInt(def.runSeed) || def.runSeed < 0 || def.runSeed > 0xffffffff) report(`runSeed ${def.runSeed} not a uint32`);
    if (!isInt(def.levelIndex) || def.levelIndex < 1) report(`levelIndex ${def.levelIndex} not an integer from 1`);
    const want = levelSeed(def.runSeed, def.levelIndex);
    if (def.seed !== want) report(`seed ${def.seed} !== levelSeed(runSeed, levelIndex) ${want}`);
    if (def.band !== band) report(`band ${def.band} !== bandOf(${def.levelIndex}) ${band}`);
  });
  checkArena(c, def.arena, def.surface === 'cylinder');
  checkRoster(c, def.roster, band, def.levelIndex >= LEAVER_FROM_LEVEL);
  checkSpeed(c, def.speedScale, def.levelIndex);
  checkObjective(c, def, band);
  checkWaves(c, def.waves, def.arena, def.roster, {
    firstAtSec: FIRST_WAVE_SEC,
    // Tester Tom: version 10 scales the cap by PAR_RAMP_SCALE on levels 1 to 14.
    maxLive: levelMaxLive(band, def.levelIndex, def.generatorVersion),
    segmentSec: null,
  }, def.surface === 'cylinder');
  checkHazards(c, def, band);
  checkLoadout(c, def);
  checkSurface(c, def.surface, opts?.enableCylinder !== false);
  checkCylinder(c, def);
  checkV2Content(c, def.generatorVersion, band, () => namedKinds(def.roster, def.waves));
  const o = def.objective;
  // Release gate R2: version 7 (the R1 config) brings the boss in at 200 s, versions 5 and 6 at 240 s.
  const v = def.generatorVersion;
  // Release gate R3: version 8 at 120 s.
  const bossAt = isR3Version(v) ? BOSS_R3_LEVEL_AT_SEC : v === GENERATOR_VERSION_V7 ? BOSS_LONG_LEVEL_AT_SEC : isLongVersion(v) ? BOSS_V5_LEVEL_AT_SEC : BOSS_LEVEL_AT_SEC;
  checkBoss(c, def.boss, def.generatorVersion, {
    // Tester 3: version 9 reads the T3 order (Brood, then Warden) and the softer first fight.
    want: isT3Version(v) ? t3BossForLevel(def.levelIndex, bossAt) : bossForLevel(def.levelIndex, bossAt),
    unit: 'level',
    index: def.levelIndex,
    atSec: bossAt,
    timedSec: o.kind === 'survive' ? o.durationSec : o.kind === 'scoreInTime' ? o.timeLimitSec : null,
  }, opts);
  checkMembranes(c, def);
  c.check('J8', (report) => {
    // Release polish: version 5 exactly when the long level flag is on (when the caller says).
    const flag = opts?.enableLongLevels;
    if (flag === undefined) return;
    const v5 = isLongVersion(def.generatorVersion);
    if (flag && !v5) report(`generatorVersion ${def.generatorVersion} with enableLongLevels on, want ${GENERATOR_VERSION_V5} or ${GENERATOR_VERSION_V6}`);
    if (!flag && v5) report(`generatorVersion ${def.generatorVersion} with enableLongLevels off`);
  });
  c.check('J9', (report) => {
    // Release gate R1: on a long level, version 6 exactly when the R1 flag is on and the level has
    // no boss (boss levels keep version 5), when the caller says.
    // Release gate R2: a boss level of that config is version 7 exactly.
    if (opts?.enableLongLevels !== true) return;
    const v6 = def.generatorVersion === GENERATOR_VERSION_V6;
    const v7 = def.generatorVersion === GENERATOR_VERSION_V7;
    // Release gate R3: with the R3 length on, J10 owns the version instead.
    const r1 = opts.enableR1Pacing === true && opts.enableR3Length !== true;
    const flag = r1 && def.boss === undefined;
    const flag7 = r1 && def.boss !== undefined;
    if (flag && !v6) report(`generatorVersion ${def.generatorVersion} with enableR1Pacing on, want ${GENERATOR_VERSION_V6}`);
    if (!flag && v6) report(`generatorVersion ${GENERATOR_VERSION_V6} with enableR1Pacing off or on a boss level`);
    if (flag7 && !v7) report(`generatorVersion ${def.generatorVersion} on a boss level with enableR1Pacing on, want ${GENERATOR_VERSION_V7}`);
    if (!flag7 && v7) report(`generatorVersion ${GENERATOR_VERSION_V7} with enableR1Pacing off or on a level without a boss`);
  });
  c.check('J10', (report) => {
    // Release gate R3: on a long level, version 8 exactly when the R1 pacing and the R3 length are
    // both on (boss or not), when the caller says.
    if (opts?.enableLongLevels !== true) return;
    // Tester 3: with enableT3 on as well, J11 owns the version instead.
    const flag = opts.enableR1Pacing === true && opts.enableR3Length === true && opts.enableT3 !== true;
    const v8 = def.generatorVersion === GENERATOR_VERSION_V8;
    if (flag && !v8) report(`generatorVersion ${def.generatorVersion} with enableR3Length on, want ${GENERATOR_VERSION_V8}`);
    if (!flag && v8) report(`generatorVersion ${GENERATOR_VERSION_V8} with enableR1Pacing or enableR3Length off, or enableT3 on`);
  });
  c.check('J11', (report) => {
    // Tester 3: on a long level, version 9 exactly when the version 8 flags and enableT3 are on, when the caller says.
    if (opts?.enableLongLevels !== true) return;
    // Tester Tom: with enableParRamp on as well, J12 owns the version instead.
    const flag = opts.enableR1Pacing === true && opts.enableR3Length === true && opts.enableT3 === true && opts.enableParRamp !== true;
    const v9 = def.generatorVersion === GENERATOR_VERSION_V9;
    if (flag && !v9) report(`generatorVersion ${def.generatorVersion} with enableT3 on, want ${GENERATOR_VERSION_V9}`);
    if (!flag && v9) report(`generatorVersion ${GENERATOR_VERSION_V9} with enableT3 or a version 8 flag off, or enableParRamp on`);
  });
  c.check('J12', (report) => {
    // Tester Tom: on a long level, version 10 exactly when the version 9 flags and enableParRamp are on, when the caller says.
    if (opts?.enableLongLevels !== true) return;
    const flag = opts.enableR1Pacing === true && opts.enableR3Length === true && opts.enableT3 === true && opts.enableParRamp === true;
    const v10 = def.generatorVersion === GENERATOR_VERSION_V10;
    if (flag && !v10) report(`generatorVersion ${def.generatorVersion} with enableParRamp on, want ${GENERATOR_VERSION_V10}`);
    if (!flag && v10) report(`generatorVersion ${GENERATOR_VERSION_V10} with enableParRamp or a version 9 flag off`);
  });
  checkDrumTaste(c, def, opts);
  c.check('J5', (report) => {
    const r = def.retries;
    if (r === undefined || !isInt(r) || r < 0 || r > MAX_RETRIES) report(`retries ${String(r)} not an integer 0 to ${MAX_RETRIES}`);
  });
  return c.result();
}

/**
 * V1: the surface is 'flat', or 'cylinder' where allowCylinder (a level with the cylinder flag not
 * known to be off). Every other value, and a missing field, is an error.
 */
function checkSurface(c: Collector, surface: unknown, allowCylinder = false): void {
  c.check('V1', (report) => {
    if (surface === 'flat' || (allowCylinder && surface === 'cylinder')) return;
    report(`surface ${String(surface)} !== 'flat'${allowCylinder ? " or 'cylinder'" : ''}`);
  });
}

/**
 * C1 (D13 phase C0): a cylinder level is level 11 or later and not a boss level, its arena is rect
 * or rectObstacles with a width that is a multiple of 64 u, and it carries GENERATOR_VERSION_V4,
 * which no flat def carries.
 */
function checkCylinder(c: Collector, def: LevelDef): void {
  c.check('C1', (report) => {
    const cyl = def.surface === 'cylinder';
    if (!cyl) {
      if (def.generatorVersion === GENERATOR_VERSION_V4) report(`generatorVersion ${GENERATOR_VERSION_V4} on a ${String(def.surface)} level`);
      return;
    }
    const taste = isT3Version(def.generatorVersion) && def.levelIndex === DRUM_TASTE_LEVEL;
    if (!cylinderEligible(def.levelIndex) && !taste) report(`cylinder on level ${def.levelIndex}: only levels from 11 that are not boss levels`);
    const a = def.arena;
    if (a.shape !== 'rect' && a.shape !== 'rectObstacles') report(`cylinder arena shape ${String(a.shape)}, want rect or rectObstacles`);
    if (!isInt(a.width / CYLINDER_WIDTH_STEP)) report(`cylinder width ${a.width} not a multiple of ${CYLINDER_WIDTH_STEP}`);
    if (def.generatorVersion !== GENERATOR_VERSION_V4 && !isLongVersion(def.generatorVersion)) {
      report(`cylinder with generatorVersion ${def.generatorVersion}, want ${GENERATOR_VERSION_V4}, ${GENERATOR_VERSION_V5} or ${GENERATOR_VERSION_V6}`);
    }
  });
}

/**
 * T1 (Tester 3, version 9): level DRUM_TASTE_LEVEL is a gentle open drum (cylinder, no
 * obstacles, noDrift, at most one well, no spawners, only DRUM_TASTE_KINDS) when the config has
 * drums (opts.enableCylinder not false). noDrift appears on that level only.
 */
function checkDrumTaste(c: Collector, def: LevelDef, opts: LevelCheckOptions | undefined): void {
  c.check('T1', (report) => {
    const nd: unknown = (def as { noDrift?: unknown }).noDrift;
    const taste = isT3Version(def.generatorVersion) && def.levelIndex === DRUM_TASTE_LEVEL && opts?.enableCylinder !== false;
    if (nd !== undefined && nd !== true) report(`noDrift ${String(nd)} must be true or absent`);
    if (!taste) {
      if (nd !== undefined) report(`noDrift on level ${def.levelIndex} (generatorVersion ${def.generatorVersion}), only the version 9 drum taste level ${DRUM_TASTE_LEVEL}`);
      return;
    }
    if (def.surface !== 'cylinder') report(`drum taste level ${DRUM_TASTE_LEVEL} surface ${String(def.surface)}, want cylinder`);
    if (def.arena.obstacles.length > 0) report(`drum taste level has ${def.arena.obstacles.length} obstacles, want an open drum`);
    if (nd !== true) report('drum taste level lacks noDrift');
    if (def.hazards.wells.length > 1) report(`drum taste level has ${def.hazards.wells.length} gravity wells, want 0 or 1`);
    if (def.hazards.spawners.length > 0) report(`drum taste level has ${def.hazards.spawners.length} spawners, want 0`);
    const kinds = namedKinds(def.roster, def.waves).filter((k) => !DRUM_TASTE_KINDS.includes(k));
    if (kinds.length > 0) report(`drum taste level names ${[...new Set(kinds)].join(', ')}, want only ${DRUM_TASTE_KINDS.join(', ')}`);
  });
}

/** Most membranes one ring carries. */
export const MAX_MEMBRANES_PER_RING = 2;

/** True when a membrane and a bar of the same ring touch end to end (gap 0 by design). */
function membraneJoined(a: Obstacle, b: Obstacle): boolean {
  if (a.membrane !== true && b.membrane !== true) return false;
  if (a.cy !== b.cy || a.h !== b.h) return false;
  return Math.abs(Math.abs(a.cx - b.cx) - (a.w + b.w) / 2) <= EPS;
}

/**
 * M1 (release polish, docs/14 item 9): a membrane appears only on a long cylinder level with
 * barrier rings. Each is exactly membrane: true, a horizontal ring segment MEMBRANE_MIN to
 * MEMBRANE_MAX u wide and one bar thick, touching a solid bar of its own ring end to end, with at
 * most MAX_MEMBRANES_PER_RING per ring.
 */
function checkMembranes(c: Collector, def: LevelDef): void {
  c.check('M1', (report) => {
    const obs = def.arena.obstacles;
    const perRow = new Map<number, number>();
    obs.forEach((o, i) => {
      const m: unknown = (o as { membrane?: unknown }).membrane;
      if (m === undefined) return;
      if (m !== true) {
        report(`obstacle ${i} membrane ${String(m)} must be true or absent`);
        return;
      }
      if (def.surface !== 'cylinder') report(`membrane obstacle ${i} on a ${String(def.surface)} level`);
      if (!isLongVersion(def.generatorVersion)) report(`membrane obstacle ${i} with generatorVersion ${def.generatorVersion}, want ${GENERATOR_VERSION_V5} or ${GENERATOR_VERSION_V6}`);
      if (o.h !== DRUM_BAR_THICK || !inRange(o.w, MEMBRANE_MIN, MEMBRANE_MAX)) report(`membrane ${i} size ${o.w} x ${o.h}, want ${MEMBRANE_MIN} to ${MEMBRANE_MAX} x ${DRUM_BAR_THICK}`);
      if (!obs.some((b) => b.membrane !== true && b.w > b.h && membraneJoined(o, b))) report(`membrane ${i} does not continue a ring bar`);
      perRow.set(o.cy, (perRow.get(o.cy) ?? 0) + 1);
    });
    for (const [v, n] of perRow) if (n > MAX_MEMBRANES_PER_RING) report(`ring at v ${v} has ${n} membranes, want 1 to ${MAX_MEMBRANES_PER_RING}`);
  });
}

/** Validates an EndlessDef: J1 to J3, V1, the fixed arena, full catalogue roster, fixed kit (docs/01 section 2.2). */
export function validateEndless(def: EndlessDef): ValidationResult {
  const c = new Collector();
  checkJson(c, def);
  checkVersions(c, def.version, def.generatorVersion);
  checkSurface(c, def.surface);
  c.check('E1', (report) => {
    if (def.mode !== 'endless') report(`mode ${String(def.mode)} !== 'endless'`);
    if (def.objective.kind !== 'none') report(`objective ${String(def.objective.kind)} !== 'none'`);
    if (!isInt(def.endlessSeed) || def.endlessSeed < 0 || def.endlessSeed > 0xffffffff) report(`endlessSeed ${def.endlessSeed} not a uint32`);
    const a = def.arena;
    const e = ENDLESS_ARENA;
    if (a.shape !== e.shape || a.width !== e.width || a.height !== e.height || a.obstacles.length !== 0) report('arena is not the fixed Endless arena');
    if (def.hazards.wells.length !== 0 || def.hazards.spawners.length !== 0) report('Endless v1 has no hazards');
    if (def.drone !== 'attack' || def.superType !== 'turbo') report(`kit ${String(def.drone)}, ${String(def.superType)} !== attack, turbo`);
    if (def.lives !== LIVES || def.bombs !== BOMBS) report(`start lives ${def.lives}, bombs ${def.bombs} !== ${LIVES}, ${BOMBS}`);
    if (def.segmentSec !== ENDLESS_SEGMENT_SEC) report(`segmentSec ${def.segmentSec} !== ${ENDLESS_SEGMENT_SEC}`);
    if (!(def.budgetPerSegment > 0)) report(`budgetPerSegment ${def.budgetPerSegment} not positive: ramp must be unbounded`);
  });
  c.check('E2', (report) => {
    const seen = new Set<string>();
    for (const e of def.roster) {
      if (!isKind(e.kind) || seen.has(e.kind) || !(e.weight > 0)) report(`bad roster entry ${String(e.kind)} weight ${e.weight}`);
      seen.add(e.kind);
    }
    if (!seen.has('grunt')) report('roster lacks grunt');
    // The catalogue: the v1 six, plus the six v2 kinds when the v2 enemy stage is on.
    const max = def.generatorVersion === GENERATOR_VERSION_V2 ? ALL_ENEMY_KINDS.length : ENEMY_KINDS.length;
    if (def.roster.length < 3 || def.roster.length > max) report(`roster size ${def.roster.length} outside 3 to ${max}`);
  });
  checkV2Content(c, def.generatorVersion, null, () => def.roster.map((e) => e.kind));
  return c.result();
}

/**
 * Validates an Endless segment: J1 to J3, seeds, R1, R2, W1 to W8 on the fixed Endless arena, S1,
 * and the boss checks B1 to B3 and J7 against bossForSegment (atSec 10, no objective clock).
 */
export function validateSegment(seg: EndlessSegmentDef, opts?: BossCheckOptions): ValidationResult {
  return segmentChecks(seg, ENDLESS_ARENA, false, opts);
}

/**
 * Release gate R2: validates a Free Play segment (endlessSegmentOn on the def's arena) with every
 * validateSegment check, W4 run on the Free Play arena (wrapped on a drum).
 */
export function validateFreePlaySegment(seg: EndlessSegmentDef, def: EndlessDef, opts?: BossCheckOptions): ValidationResult {
  return segmentChecks(seg, def.arena, def.surface === 'cylinder', opts, def.freePlay?.options, def.roster);
}

/**
 * fp: the Free Play options of the def (absent: the plain Endless rules). Chosen enemies replace
 * R1 with FP5 (the roster is exactly the chosen kinds) and J6 reads no band; Swarm raises the W7
 * maxLiveEnemies; the boss follows freePlayBossFor.
 */
function segmentChecks(
  seg: EndlessSegmentDef,
  arena: ArenaDef,
  cylinder: boolean,
  opts: BossCheckOptions | undefined,
  fp?: FreePlayLevelOptions,
  catalogue: readonly RosterEntry[] = [],
): ValidationResult {
  const c = new Collector();
  checkJson(c, seg);
  checkVersions(c, seg.version, seg.generatorVersion);
  const effective = effectiveIndexOf(seg.segment);
  const band = bandOf(effective);
  c.check('J4', (report) => {
    if (!isInt(seg.segment) || seg.segment < 0) report(`segment ${seg.segment} not an integer from 0`);
    const want = segmentSeed(seg.endlessSeed, seg.segment);
    if (seg.seed !== want) report(`seed ${seg.seed} !== segmentSeed(endlessSeed, segment) ${want}`);
    if (seg.effectiveIndex !== effective) report(`effectiveIndex ${seg.effectiveIndex} !== ${effective}`);
    if (seg.band !== band) report(`band ${seg.band} !== bandOf(${effective}) ${band}`);
  });
  const chosen = fp !== undefined && fp.enemies.length > 0 ? fp.enemies : null;
  // R5: the Free Play snake may join any band's roster; R1 judges the rest.
  const snakeFloor = fp !== undefined && freePlaySnakeAllowed(fp, catalogue) && seg.segment >= FREE_PLAY_SNAKE_FROM_SEGMENT;
  if (snakeFloor) {
    c.check('FP6', (report) => {
      const n = seg.waves.waves.reduce((k, w) => k + w.entries.filter((e) => e.kind === 'snake').length, 0);
      if (n < FREE_PLAY_SNAKES_PER_SEGMENT) report(`${n} snakes, want at least ${FREE_PLAY_SNAKES_PER_SEGMENT}`);
      if (!seg.roster.some((e) => e.kind === 'snake')) report('roster lacks the allowed snake');
    });
  }
  if (chosen === null) checkRoster(c, snakeFloor ? seg.roster.filter((e) => e.kind !== 'snake') : seg.roster, band, seg.segment >= LEAVER_FROM_SEGMENT);
  else {
    c.check('FP5', (report) => {
      const kinds = seg.roster.map((e) => e.kind);
      if (kinds.join(',') !== chosen.join(',')) report(`roster ${kinds.join(', ')} !== chosen ${chosen.join(', ')}`);
      for (const e of seg.roster) if (!(e.weight > 0)) report(`${e.kind} weight ${e.weight} not positive`);
    });
  }
  checkSpeed(c, seg.speedScale, effective);
  checkWaves(
    c,
    seg.waves,
    arena,
    seg.roster,
    {
      firstAtSec: seg.segment === 0 ? FIRST_WAVE_SEC : 0,
      maxLive: fp === undefined ? BANDS[band].maxLiveEnemies : freePlayMaxLive(BANDS[band].maxLiveEnemies, fp.density),
      segmentSec: ENDLESS_SEGMENT_SEC,
    },
    cylinder,
  );
  c.check('S1', (report) => {
    seg.waves.waves.forEach((w, i) => {
      if (!(w.atSec >= 0 && w.atSec < ENDLESS_SEGMENT_SEC)) report(`wave ${i} atSec ${w.atSec} outside 0 to ${ENDLESS_SEGMENT_SEC}`);
    });
  });
  checkV2Content(c, seg.generatorVersion, chosen === null ? band : null, () => namedKinds(seg.roster, seg.waves));
  const want = fp === undefined ? bossForSegment(seg.segment) : freePlayBossFor(fp.bosses, seg.segment, cylinder);
  checkBoss(c, seg.boss, seg.generatorVersion, { want, unit: 'segment', index: seg.segment, atSec: BOSS_SEGMENT_AT_SEC, timedSec: null }, opts);
  return c.result();
}

// Release gate R2: Free Play (freeplay.ts). The arena follows the player's options, so the fixed
// arena rule E1 is replaced by FP1 and FP2; everything else matches validateEndless.

/** Free Play rect arena: the Endless arena size. */
export const FREE_PLAY_RECT: Readonly<{ width: number; height: number }> = Object.freeze({ width: ENDLESS_ARENA.width, height: ENDLESS_ARENA.height });
/** Free Play circle arena diameter. */
export const FREE_PLAY_CIRCLE = 1100;

// Free Play options (docs/14), the level side. Shared by freeplay.ts and the checks below.

/** Arena size multiplier per option, applied to every arena dimension. */
export const FREE_PLAY_SIZE_SCALE: Readonly<Record<FreePlaySize, number>> = Object.freeze({ small: 0.75, medium: 1, large: 1.3 });
/** Spawn count multiplier per density option (each wave's budget). R5 (Ryan): Swarm 1.8 to 1.95, about 7 percent more spawns and 8 percent more live cap. */
export const FREE_PLAY_DENSITY_SCALE: Readonly<Record<FreePlayDensity, number>> = Object.freeze({ low: 0.6, normal: 1, swarm: 1.95 });
/** Live enemy ceiling for Swarm: src/game/world.ts ENTITY_CAP, copied to keep levelgen standalone. */
export const FREE_PLAY_ENTITY_CAP = 512;
/**
 * R5 (Ryan: wells normal placed none). Free Play is an Endless run and the game adds no well
 * arrivals in Endless, so the level side places them: wells 'normal' 1 to 2, 'many' 2 to 4.
 */
export const FREE_PLAY_NORMAL_WELLS: Readonly<{ min: number; max: number }> = Object.freeze({ min: 1, max: 2 });
/** Gravity wells with wells 'many'. The game holds at most 4 (src/game/state.ts MAX_WELLS). */
export const FREE_PLAY_MANY_WELLS: Readonly<{ min: number; max: number }> = Object.freeze({ min: 2, max: 4 });
/** Least distance from a Free Play well to the ship spawn point, u (fits the small circle). */
export const FREE_PLAY_WELL_SPAWN_CLEAR = 240;
/** Least distance between two Free Play wells, u. */
export const FREE_PLAY_WELL_PAIR = 300;

/** Arena width and height of a Free Play arena at a size. Rect and circle on the 10 u grid; drum width a multiple of 64. */
export function freePlayArenaSize(kind: FreePlayArena, size: FreePlaySize): { width: number; height: number } {
  const k = FREE_PLAY_SIZE_SCALE[size];
  const ten = (v: number): number => Math.round((v * k) / 10) * 10;
  if (kind === 'circle') return { width: ten(FREE_PLAY_CIRCLE), height: ten(FREE_PLAY_CIRCLE) };
  if (kind === 'drum') return { width: Math.round((FREE_PLAY_RECT.width * k) / CYLINDER_WIDTH_STEP) * CYLINDER_WIDTH_STEP, height: ten(FREE_PLAY_RECT.height) };
  return { width: ten(FREE_PLAY_RECT.width), height: ten(FREE_PLAY_RECT.height) };
}

/**
 * Snake spawns every Free Play segment from FREE_PLAY_SNAKE_FROM_SEGMENT holds at least. R6: one
 * per 30 s (R5) put a lone snake in a corner that the attack drone killed within about 5 s, so on
 * device none was seen; 3 per segment keep one on screen most of the time.
 */
export const FREE_PLAY_SNAKES_PER_SEGMENT = 3;
/** R6: the first segment with the snake floor: the first, so a snake shows within the opening waves. */
export const FREE_PLAY_SNAKE_FROM_SEGMENT = 0;

/** Well count range of a wells option, or null for 'off'. */
export function freePlayWellRange(wells: FreePlayLevelOptions['wells']): Readonly<{ min: number; max: number }> | null {
  return wells === 'many' ? FREE_PLAY_MANY_WELLS : wells === 'normal' ? FREE_PLAY_NORMAL_WELLS : null;
}

/** R5: the snake is allowed in a Free Play run: chosen, or no kinds chosen and the catalogue has it. Independent of wells. */
export function freePlaySnakeAllowed(o: FreePlayLevelOptions, catalogue: readonly RosterEntry[]): boolean {
  return o.enemies.length > 0 ? o.enemies.includes('snake') : catalogue.some((e) => e.kind === 'snake');
}

/** maxLiveEnemies of a Free Play segment: the band value, raised by the Swarm scale up to the entity cap. */
export function freePlayMaxLive(bandMax: number, density: FreePlayDensity): number {
  return density === 'swarm' ? Math.min(FREE_PLAY_ENTITY_CAP, Math.round(bandMax * FREE_PLAY_DENSITY_SCALE.swarm)) : bandMax;
}

const FP_DENSITIES: readonly string[] = ['low', 'normal', 'swarm'];
const FP_WELLS: readonly string[] = ['off', 'normal', 'many'];
const FP_SIZES: readonly string[] = ['small', 'medium', 'large'];

/** FP3: the options record is well formed and its enemies are catalogue kinds in order. */
function checkFreePlayOptions(c: Collector, o: FreePlayLevelOptions, roster: readonly RosterEntry[]): void {
  c.check('FP3', (report) => {
    const catalogue = new Set<string>(roster.map((e) => e.kind));
    const order = ALL_ENEMY_KINDS.filter((k) => o.enemies.includes(k));
    if (order.join(',') !== o.enemies.join(',')) report(`enemies ${o.enemies.join(', ')} not unique kinds in catalogue order`);
    for (const k of o.enemies) if (!catalogue.has(k)) report(`enemy ${String(k)} not in the run catalogue`);
    if (!FP_DENSITIES.includes(o.density)) report(`density ${String(o.density)}`);
    if (!FP_WELLS.includes(o.wells)) report(`wells ${String(o.wells)}`);
    if (!FP_SIZES.includes(o.size)) report(`size ${String(o.size)}`);
    if (o.bosses !== 'off' && o.bosses !== 'every3' && bossTierOf(o.bosses) === null) report(`bosses ${String(o.bosses)}`);
  });
}

/** FP4: wells 'normal' places 1 to 2 wells and 'many' 2 to 4, inside the arena, clear of the spawn, obstacles and each other. */
function checkFreePlayWells(c: Collector, def: EndlessDef, range: Readonly<{ min: number; max: number }> | null): void {
  c.check('FP4', (report) => {
    const wells = def.hazards.wells;
    if (def.hazards.spawners.length !== 0) report('Free Play has no hazard spawners');
    if (range === null) {
      if (wells.length !== 0) report(`${wells.length} wells with wells off`);
      return;
    }
    const { min, max } = range;
    if (wells.length < min || wells.length > max) report(`${wells.length} wells, want ${min} to ${max}`);
    const g = geometryOf(def.arena, def.surface === 'cylinder');
    wells.forEach((w, i) => {
      if (!g.inside(w, WELL_EDGE)) report(`well ${i} outside arena margin ${WELL_EDGE}`);
      if (g.dist(w, def.arena.spawnPoint) < FREE_PLAY_WELL_SPAWN_CLEAR) report(`well ${i} within ${FREE_PLAY_WELL_SPAWN_CLEAR} of spawn`);
      if (def.arena.obstacles.some((o) => g.obstacle(o, w) < WELL_OBSTACLE)) report(`well ${i} within ${WELL_OBSTACLE} of an obstacle`);
      wells.slice(i + 1).forEach((v, k) => {
        if (g.dist(w, v) < FREE_PLAY_WELL_PAIR) report(`wells ${i} and ${i + k + 1} closer than ${FREE_PLAY_WELL_PAIR}`);
      });
    });
  });
}

/**
 * Validates a Free Play EndlessDef: J1 to J3, V1, FP1 (mode, kit, clocks, version 7, the freePlay
 * record), FP2 (the arena follows the options), A1 to A7 and F1 on the arena (wrapped on a drum),
 * and the E2 roster.
 */
export function validateFreePlay(def: EndlessDef): ValidationResult {
  const c = new Collector();
  checkJson(c, def);
  checkVersions(c, def.version, def.generatorVersion);
  checkSurface(c, def.surface, true);
  const fp = def.freePlay;
  c.check('FP1', (report) => {
    if (fp === undefined) report('freePlay record missing');
    else if (!isInt(fp.retries) || fp.retries < 0 || fp.retries > MAX_RETRIES) report(`retries ${fp.retries} not an integer 0 to ${MAX_RETRIES}`);
    if (def.generatorVersion !== GENERATOR_VERSION_V7) report(`generatorVersion ${def.generatorVersion} !== ${GENERATOR_VERSION_V7}`);
    if (def.mode !== 'endless') report(`mode ${String(def.mode)} !== 'endless'`);
    if (def.objective.kind !== 'none') report(`objective ${String(def.objective.kind)} !== 'none'`);
    if (!isInt(def.endlessSeed) || def.endlessSeed < 0 || def.endlessSeed > 0xffffffff) report(`endlessSeed ${def.endlessSeed} not a uint32`);
    if (def.drone !== 'attack' || def.superType !== 'turbo') report(`kit ${String(def.drone)}, ${String(def.superType)} !== attack, turbo`);
    if (def.lives !== LIVES || def.bombs !== BOMBS) report(`start lives ${def.lives}, bombs ${def.bombs} !== ${LIVES}, ${BOMBS}`);
    if (def.segmentSec !== ENDLESS_SEGMENT_SEC) report(`segmentSec ${def.segmentSec} !== ${ENDLESS_SEGMENT_SEC}`);
    if (!(def.budgetPerSegment > 0)) report(`budgetPerSegment ${def.budgetPerSegment} not positive: ramp must be unbounded`);
  });
  const options = fp?.options;
  if (options !== undefined) checkFreePlayOptions(c, options, def.roster);
  checkFreePlayWells(c, def, options === undefined ? null : freePlayWellRange(options.wells));
  c.check('FP2', (report) => {
    if (fp === undefined) return;
    const a = def.arena;
    const want = freePlayArenaSize(fp.arena, options?.size ?? 'medium');
    const n = a.obstacles.length;
    const cyl = def.surface === 'cylinder';
    if (n > 0 !== fp.barriers) report(`barriers ${String(fp.barriers)} with ${n} obstacles`);
    if (a.obstacles.some((o) => o.membrane === true)) report('Free Play has no membranes');
    if ((fp.drumPattern !== null) !== (fp.arena === 'drum' && fp.barriers)) report(`drumPattern ${String(fp.drumPattern)} on ${fp.arena}, barriers ${String(fp.barriers)}`);
    switch (fp.arena) {
      case 'rect':
        if (cyl) report('rect Free Play on a cylinder');
        if (a.shape !== (fp.barriers ? 'rectObstacles' : 'rect')) report(`rect Free Play shape ${a.shape}`);
        if (a.width !== want.width || a.height !== want.height) report(`rect Free Play size ${a.width} x ${a.height}`);
        break;
      case 'circle':
        if (cyl) report('circle Free Play on a cylinder');
        if (a.shape !== 'circle' || a.width !== want.width || a.height !== want.height) report(`circle Free Play arena ${a.shape} ${a.width} x ${a.height}`);
        break;
      case 'drum':
        if (!cyl) report(`drum Free Play surface ${String(def.surface)}`);
        if (a.shape !== (fp.barriers ? 'rectObstacles' : 'rect')) report(`drum Free Play shape ${a.shape}`);
        if (!isInt(a.width / CYLINDER_WIDTH_STEP)) report(`drum width ${a.width} not a multiple of ${CYLINDER_WIDTH_STEP}`);
        if (options !== undefined && (a.width !== want.width || a.height !== want.height)) report(`drum Free Play size ${a.width} x ${a.height}`);
        break;
      default:
        report(`unknown Free Play arena ${String(fp.arena)}`);
    }
  });
  checkArena(c, def.arena, def.surface === 'cylinder', true, FREE_PLAY_SIZE_SCALE[options?.size ?? 'medium'] ?? 1);
  c.check('E2', (report) => {
    const seen = new Set<string>();
    for (const e of def.roster) {
      if (!isKind(e.kind) || seen.has(e.kind) || !(e.weight > 0)) report(`bad roster entry ${String(e.kind)} weight ${e.weight}`);
      seen.add(e.kind);
    }
    if (!seen.has('grunt')) report('roster lacks grunt');
    if (def.roster.length < 3 || def.roster.length > ALL_ENEMY_KINDS.length) report(`roster size ${def.roster.length} outside 3 to ${ALL_ENEMY_KINDS.length}`);
  });
  return c.result();
}
