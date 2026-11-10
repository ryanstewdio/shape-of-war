// Settings, progress and score persistence (docs/03 section 8). Ledger owns from W2.
// One key per value so a corrupt value cannot poison the rest. Every storage access is wrapped
// in try/catch: private mode, quota or a missing localStorage fall back to an in memory copy,
// then to defaults.
import type { StartBonus } from './bonus';
import type { Difficulty } from './difficulty';
import { DEFAULT_FREE_PLAY, type FreePlayConfig } from './freeplayConfig';
import { BOSS_IDS, ENEMY_KINDS, V2_ENEMY_KINDS, type EnemyKind, type FreePlayArena } from '../levelgen/leveldef';
import { asStarCount, type StarCount } from './stars';

export interface Settings {
  neon: number;
  volume: number;
  showFps: boolean;
}

/** The subset of the DOM Storage API used here, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SETTINGS_PREFIX = 'sow.settings.';
export const DEFAULT_SETTINGS: Readonly<Settings> = { neon: 70, volume: 70, showFps: false };

/** In memory store used when localStorage is missing or throws, so values hold for the session. */
const memory = new Map<string, string>();

/** Wraps localStorage: each call falls back to the in memory map if the real store throws. */
const fallbackStorage: StorageLike = {
  getItem(key) {
    try {
      const s: StorageLike | undefined = globalThis.localStorage;
      if (s) return s.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      // private mode or blocked storage: use memory
    }
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
    try {
      const s: StorageLike | undefined = globalThis.localStorage;
      if (s) s.setItem(key, value);
    } catch {
      // quota or private mode: the memory copy still holds for this session
    }
  },
};

function defaultStorage(): StorageLike | null {
  return fallbackStorage;
}

function readInt(store: StorageLike | null, key: string, def: number, lo: number, hi: number): number {
  if (store === null) return def;
  try {
    const v = store.getItem(key);
    if (v === null) return def;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  } catch {
    return def;
  }
}

export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    neon: readInt(storage, `${SETTINGS_PREFIX}neon`, d.neon, 0, 100),
    volume: readInt(storage, `${SETTINGS_PREFIX}volume`, d.volume, 0, 100),
    showFps: readInt(storage, `${SETTINGS_PREFIX}showFps`, d.showFps ? 1 : 0, 0, 1) === 1,
  };
}

/** Pure: the string stored for a value. Numbers are rounded and clamped to 0..100. */
export function encodeSetting<K extends keyof Settings>(_k: K, v: Settings[K]): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(Math.min(100, Math.max(0, Math.round(v))));
}

export function saveSetting<K extends keyof Settings>(
  k: K,
  v: Settings[K],
  storage: StorageLike | null = defaultStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(`${SETTINGS_PREFIX}${k}`, encodeSetting(k, v));
  } catch {
    // quota or private mode: ignore, the game still runs
  }
}

function readRaw(store: StorageLike | null, key: string): string | null {
  if (store === null) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(store: StorageLike | null, key: string, value: string): void {
  if (store === null) return;
  try {
    store.setItem(key, value);
  } catch {
    // quota or private mode: ignore, the game still runs
  }
}

// Glow path (W2 brief): "bloom" or "fallback", default "bloom", applied at boot.

export type GlowPathSetting = 'bloom' | 'fallback';
export const GLOW_PATH_KEY = `${SETTINGS_PREFIX}glowPath`;
export const DEFAULT_GLOW_PATH: GlowPathSetting = 'bloom';

/** Pure: anything other than the two valid strings falls back to "bloom". */
export function parseGlowPath(raw: string | null): GlowPathSetting {
  return raw === 'fallback' ? 'fallback' : DEFAULT_GLOW_PATH;
}

export function loadGlowPath(storage: StorageLike | null = defaultStorage()): GlowPathSetting {
  return parseGlowPath(readRaw(storage, GLOW_PATH_KEY));
}

export function saveGlowPath(p: GlowPathSetting, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, GLOW_PATH_KEY, parseGlowPath(p));
}

// Space physics (v2 addendum, docs/10 wave A): "off", "low", "medium" or "high", default "off".
// SpaceLevelSetting is the same literal union as SpaceLevel in src/core/physics.ts (Forge). It is
// declared here on purpose so the two branches never import each other; Fable glue matches them.

export type SpaceLevelSetting = 'off' | 'low' | 'medium' | 'high';
/** Button order on the settings row. */
export const SPACE_LEVELS: readonly SpaceLevelSetting[] = ['off', 'low', 'medium', 'high'];
export const SPACE_PHYSICS_KEY = `${SETTINGS_PREFIX}spacePhysics`;
export const DEFAULT_SPACE_PHYSICS: SpaceLevelSetting = 'off';

/** Pure: anything other than the three non default strings (exact case) falls back to "off". */
export function parseSpacePhysics(raw: string | null): SpaceLevelSetting {
  return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : DEFAULT_SPACE_PHYSICS;
}

export function loadSpacePhysics(storage: StorageLike | null = defaultStorage()): SpaceLevelSetting {
  return parseSpacePhysics(readRaw(storage, SPACE_PHYSICS_KEY));
}

export function saveSpacePhysics(level: SpaceLevelSetting, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, SPACE_PHYSICS_KEY, parseSpacePhysics(level));
}

// Weapon pickups (v2 addendum, docs/10 wave B): stored as '1' (on) or '0' (off), default on. Kept
// out of Settings and DEFAULT_SETTINGS on purpose, like glowPath and spacePhysics, so the v1
// settings shape and the storage key audit stay as they are.

export const WEAPON_PICKUPS_KEY = `${SETTINGS_PREFIX}weaponPickups`;
export const DEFAULT_WEAPON_PICKUPS = true;

/** Pure: only the exact strings '0' and '1' count. Anything else, and null, gives the default (on). */
export function parseWeaponPickups(raw: string | null): boolean {
  if (raw === '0') return false;
  if (raw === '1') return true;
  return DEFAULT_WEAPON_PICKUPS;
}

/** Pure: the string stored for a value. */
export function encodeWeaponPickups(on: boolean): string {
  return on ? '1' : '0';
}

export function loadWeaponPickups(storage: StorageLike | null = defaultStorage()): boolean {
  return parseWeaponPickups(readRaw(storage, WEAPON_PICKUPS_KEY));
}

export function saveWeaponPickups(on: boolean, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, WEAPON_PICKUPS_KEY, encodeWeaponPickups(on));
}

// Effects tier (v2 addendum 3.8, docs/10 wave D): "low", "standard" or "high", default "standard".
// EffectsTierSetting is the same literal union as EffectsTier in src/render/effects.ts (Glow). It is
// declared here on purpose so the two branches never import each other; Fable glue matches them.
// Kept out of Settings and DEFAULT_SETTINGS, like glowPath and spacePhysics.

export type EffectsTierSetting = 'low' | 'standard' | 'high';
/** Button order on the settings row. */
export const EFFECTS_TIER_SETTINGS: readonly EffectsTierSetting[] = ['low', 'standard', 'high'];
export const EFFECTS_KEY = `${SETTINGS_PREFIX}effects`;
export const DEFAULT_EFFECTS: EffectsTierSetting = 'standard';

/** Pure: anything other than the three exact lower case strings (and null) falls back to "standard". */
export function parseEffects(raw: string | null): EffectsTierSetting {
  return raw === 'low' || raw === 'standard' || raw === 'high' ? raw : DEFAULT_EFFECTS;
}

export function loadEffects(storage: StorageLike | null = defaultStorage()): EffectsTierSetting {
  return parseEffects(readRaw(storage, EFFECTS_KEY));
}

export function saveEffects(tier: EffectsTierSetting, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, EFFECTS_KEY, parseEffects(tier));
}

// 3D tilt (v3 wave 6): "off", "low" or "high", default "off". TiltSetting is the same literal union
// as TiltLevel in src/render/tilt.ts (Glow), declared here so core never imports render.
// Kept out of Settings and DEFAULT_SETTINGS, like effects and glowPath.

export type TiltSetting = 'off' | 'low' | 'high';
/** Button order on the settings row. */
export const TILT_SETTINGS: readonly TiltSetting[] = ['off', 'low', 'high'];
export const TILT_KEY = `${SETTINGS_PREFIX}tilt`;
export const DEFAULT_TILT: TiltSetting = 'off';

/** Pure: anything other than the three exact lower case strings (and null) falls back to "off". */
export function parseTilt(raw: string | null): TiltSetting {
  return raw === 'off' || raw === 'low' || raw === 'high' ? raw : DEFAULT_TILT;
}

export function loadTilt(storage: StorageLike | null = defaultStorage()): TiltSetting {
  return parseTilt(readRaw(storage, TILT_KEY));
}

export function saveTilt(level: TiltSetting, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, TILT_KEY, parseTilt(level));
}

// Difficulty (release polish, docs/14 item 6; Insane added in R1): "easy", "normal", "hard" or
// "insane", default "normal". The literal union comes from src/core/difficulty.ts. Kept out of
// Settings and DEFAULT_SETTINGS, like the other extra keys. Applied when a level starts (or while
// its intro card still holds the sim), never to a running world.

export const DIFFICULTY_KEY = `${SETTINGS_PREFIX}difficulty`;
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Pure: anything other than the four exact lower case strings (and null) falls back to "normal". */
export function parseDifficulty(raw: string | null): Difficulty {
  return raw === 'easy' || raw === 'normal' || raw === 'hard' || raw === 'insane' ? raw : DEFAULT_DIFFICULTY;
}

export function loadDifficulty(storage: StorageLike | null = defaultStorage()): Difficulty {
  return parseDifficulty(readRaw(storage, DIFFICULTY_KEY));
}

export function saveDifficulty(d: Difficulty, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, DIFFICULTY_KEY, parseDifficulty(d));
}

// R2 (Ryan): difficulty is chosen on the card at the start of every level and of Endless, so the
// Settings Difficulty and Space physics rows are gone. sow.settings.difficulty and
// sow.settings.spacePhysics stay readable (loadDifficulty, loadSpacePhysics) but nothing writes or
// applies them any more. The last choice made on a card lives in sow.progress.difficulty; on a
// phone that has never chosen on a card, the old Settings value seeds it once, so the card
// preselects what the player last set.

export const LAST_DIFFICULTY_KEY = 'sow.progress.difficulty';

/** The difficulty the card preselects: the last card choice, else the old Settings value, else Normal. */
export function loadLastDifficulty(storage: StorageLike | null = defaultStorage()): Difficulty {
  const raw = readRaw(storage, LAST_DIFFICULTY_KEY);
  return raw !== null ? parseDifficulty(raw) : loadDifficulty(storage);
}

export function saveLastDifficulty(d: Difficulty, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, LAST_DIFFICULTY_KEY, parseDifficulty(d));
}

/** Pure (R2): space physics follows difficulty: Easy off, Normal low, Hard medium, Insane high. */
export const SPACE_FOR_DIFFICULTY: Readonly<Record<Difficulty, SpaceLevelSetting>> = Object.freeze({
  easy: 'off',
  normal: 'low',
  hard: 'medium',
  insane: 'high',
});

export function spaceForDifficulty(d: Difficulty): SpaceLevelSetting {
  return SPACE_FOR_DIFFICULTY[parseDifficulty(d)];
}

// R2 par reward: the choice made on a results screen where par was reached, held for the start of
// the next Adventure level. JSON { "level": <index>, "bonus": StartBonus }. Taken once: the level
// start that uses it clears the key ('' reads as none).

export const START_BONUS_KEY = 'sow.progress.startBonus';

export interface PendingBonus {
  readonly level: number;
  readonly bonus: StartBonus;
}

const BASE_WEAPONS: readonly string[] = ['spread', 'rapid', 'pierce', 'orbit'];

/** Pure: a StartBonus from untrusted JSON, or null. */
export function parseStartBonus(v: unknown): StartBonus | null {
  if (typeof v !== 'object' || v === null || !('kind' in v)) return null;
  if (v.kind === 'life') return { kind: 'life' };
  if (v.kind === 'bomb') return { kind: 'bomb' };
  if (v.kind === 'weapon' && 'weapon' in v && typeof v.weapon === 'string' && BASE_WEAPONS.includes(v.weapon)) {
    return { kind: 'weapon', weapon: v.weapon as 'spread' | 'rapid' | 'pierce' | 'orbit' };
  }
  return null;
}

/** Pure: the stored pending reward, or null for anything malformed. */
export function parsePendingBonus(raw: string | null): PendingBonus | null {
  if (raw === null || raw === '') return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || !('level' in v) || !('bonus' in v)) return null;
    const level = typeof v.level === 'number' && Number.isInteger(v.level) && v.level >= FIRST_LEVEL ? v.level : null;
    const bonus = parseStartBonus(v.bonus);
    return level === null || bonus === null ? null : { level, bonus };
  } catch {
    return null;
  }
}

export function loadPendingBonus(storage: StorageLike | null = defaultStorage()): PendingBonus | null {
  return parsePendingBonus(readRaw(storage, START_BONUS_KEY));
}

export function savePendingBonus(p: PendingBonus, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, START_BONUS_KEY, JSON.stringify({ level: Math.floor(p.level), bonus: p.bonus }));
}

/**
 * Take the reward for a level start: returns it and clears the key when it was held for `level`,
 * otherwise null and the key is left alone (a Retry of the level that earned it keeps it waiting).
 */
export function takePendingBonus(level: number, storage: StorageLike | null = defaultStorage()): StartBonus | null {
  const p = loadPendingBonus(storage);
  if (p === null || p.level !== Math.floor(level)) return null;
  writeRaw(storage, START_BONUS_KEY, '');
  return p.bonus;
}

// Menu theme (chorus menu-themes request): the raw index text "0" to "2" of the last title theme, so
// the rotation continues across boots. Audio validates the value; this module stores it as is.
// Kept out of Settings and DEFAULT_SETTINGS, like the other extra keys.

export const MENU_THEME_KEY = `${SETTINGS_PREFIX}menuTheme`;

export function loadMenuTheme(storage: StorageLike | null = defaultStorage()): string | null {
  return readRaw(storage, MENU_THEME_KEY);
}

export function saveMenuTheme(raw: string, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, MENU_THEME_KEY, raw);
}

// Music volume (v2 addendum 3.9, docs/10 wave D): an integer 0 to 100, default 50, where 0 is off.
// Stored as plain decimal text. Kept out of Settings and DEFAULT_SETTINGS on purpose, like the
// other v2 keys, so the v1 settings shape and the storage key audit stay as they are.

export const MUSIC_KEY = `${SETTINGS_PREFIX}music`;
export const DEFAULT_MUSIC = 50;

/** Pure: round and clamp to 0..100. A value that is not a finite number gives the default. */
export function clampMusic(v: number): number {
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_MUSIC;
}

/**
 * Pure: a stored music volume. Only whole decimal text counts (an optional minus sign, then digits),
 * and a whole number outside 0..100 is clamped. Null, empty, decimals, units and any other text give 50.
 */
export function parseMusic(raw: string | null): number {
  if (raw === null || !/^-?\d{1,15}$/.test(raw)) return DEFAULT_MUSIC;
  return clampMusic(Number(raw));
}

/** Pure: the string stored for a value (rounded and clamped, so the stored text always parses back). */
export function encodeMusic(v: number): string {
  return String(clampMusic(v));
}

export function loadMusic(storage: StorageLike | null = defaultStorage()): number {
  return parseMusic(readRaw(storage, MUSIC_KEY));
}

export function saveMusic(v: number, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, MUSIC_KEY, encodeMusic(v));
}

// Progress and scores (docs/03 section 8). Level indices are 1 based.

export const RUN_SEED_KEY = 'sow.progress.runSeed';
export const UNLOCKED_KEY = 'sow.progress.unlocked';
export const ADVENTURE_SCORES_KEY = 'sow.scores.adventure';
export const FIRST_LEVEL = 1;

/** Pure: a stored uint32 decimal, or null if missing or corrupt. */
export function parseUint32(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 0xffffffff ? n >>> 0 : null;
}

/** The persistent run seed. Created with `fresh` and stored on first launch. */
export function loadRunSeed(fresh: () => number, storage: StorageLike | null = defaultStorage()): number {
  const stored = parseUint32(readRaw(storage, RUN_SEED_KEY));
  if (stored !== null) return stored;
  const seed = fresh() >>> 0;
  writeRaw(storage, RUN_SEED_KEY, String(seed));
  return seed;
}

/** Highest unlocked level index, at least FIRST_LEVEL. */
export function loadUnlocked(storage: StorageLike | null = defaultStorage()): number {
  return readInt(storage, UNLOCKED_KEY, FIRST_LEVEL, FIRST_LEVEL, 1_000_000);
}

/** Raise the unlocked index to `index` if higher. Returns the stored value. */
export function unlockLevel(index: number, storage: StorageLike | null = defaultStorage()): number {
  const next = Math.max(loadUnlocked(storage), Math.floor(index));
  writeRaw(storage, UNLOCKED_KEY, String(next));
  return next;
}

export interface LevelBest {
  best: number;
  /** Best stars earned (R1: capped by difficulty, 4 only from an Insane win). */
  stars: StarCount;
  /** R1: the difficulty the best stars were earned on. Absent on entries saved before R1. */
  difficulty?: Difficulty;
}

export type AdventureScores = Record<string, LevelBest>;

function asStars(v: unknown): StarCount {
  return asStarCount(v);
}

function storedDifficulty(v: unknown): Difficulty | undefined {
  if (typeof v !== 'string') return undefined;
  const d = parseDifficulty(v);
  return d === v ? d : undefined;
}

/** Pure: parse the stored map, dropping any entry that is not well formed. */
export function parseAdventureScores(raw: string | null): AdventureScores {
  if (raw === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  const out: AdventureScores = {};
  for (const [k, v] of Object.entries(data)) {
    if (!/^\d+$/.test(k) || typeof v !== 'object' || v === null) continue;
    const best: unknown = 'best' in v ? v.best : undefined;
    const st: unknown = 'stars' in v ? v.stars : undefined;
    const diff = storedDifficulty('difficulty' in v ? v.difficulty : undefined);
    if (typeof best !== 'number' || !Number.isFinite(best) || best < 0) continue;
    const entry: LevelBest = { best: Math.floor(best), stars: asStars(st) };
    if (diff !== undefined) entry.difficulty = diff;
    out[k] = entry;
  }
  return out;
}

export function loadAdventureScores(storage: StorageLike | null = defaultStorage()): AdventureScores {
  return parseAdventureScores(readRaw(storage, ADVENTURE_SCORES_KEY));
}

/**
 * Pure: merge one result into the map. Best score and best stars are kept independently. A higher
 * star count replaces a lower one together with the difficulty it was earned on (R1); an equal or
 * lower count keeps the stored stars and their difficulty.
 */
export function mergeAdventureScore(
  scores: Readonly<AdventureScores>,
  index: number,
  score: number,
  starCount: StarCount,
  difficulty?: Difficulty,
): { scores: AdventureScores; best: number; newBest: boolean } {
  const key = String(Math.floor(index));
  const prev = scores[key];
  const newBest = prev === undefined || score > prev.best;
  const earned = asStars(starCount);
  const betterStars = prev === undefined || earned > prev.stars;
  const entry: LevelBest = {
    best: newBest ? Math.floor(score) : (prev?.best ?? 0),
    stars: betterStars ? earned : prev.stars,
  };
  const diff = betterStars ? difficulty : prev.difficulty;
  if (diff !== undefined) entry.difficulty = diff;
  return { scores: { ...scores, [key]: entry }, best: entry.best, newBest };
}

/** Record a finished attempt. Returns the best score for the level and the new best flag. */
export function recordAdventureScore(
  index: number,
  score: number,
  starCount: StarCount,
  storage: StorageLike | null = defaultStorage(),
  difficulty?: Difficulty,
): { best: number; newBest: boolean } {
  const merged = mergeAdventureScore(loadAdventureScores(storage), index, score, starCount, difficulty);
  writeRaw(storage, ADVENTURE_SCORES_KEY, JSON.stringify(merged.scores));
  return { best: merged.best, newBest: merged.newBest };
}

// Endless high scores (docs/03 section 8): top 10, sorted by score descending.

export const ENDLESS_SCORES_KEY = 'sow.scores.endless';
export const ENDLESS_TOP = 10;

export interface EndlessEntry {
  score: number;
  /** Epoch ms when the game ended. */
  at: number;
}

/** Pure: highest score first; equal scores keep the earlier game first. Sorts in place. */
function sortEndless(rows: EndlessEntry[]): EndlessEntry[] {
  return rows.sort((a, b) => b.score - a.score || a.at - b.at);
}

/** Pure: parse the stored table, dropping malformed rows, then sort and cap. */
export function parseEndlessScores(raw: string | null): EndlessEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: EndlessEntry[] = [];
  for (const row of data) {
    if (typeof row !== 'object' || row === null) continue;
    const score: unknown = 'score' in row ? row.score : undefined;
    const at: unknown = 'at' in row ? row.at : undefined;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) continue;
    out.push({ score: Math.floor(score), at: typeof at === 'number' && Number.isFinite(at) ? at : 0 });
  }
  return sortEndless(out).slice(0, ENDLESS_TOP);
}

/**
 * Pure: insert one result. Returns the new table and the 1 based rank of the new row, or 0 if it
 * did not make the top 10. A tie with an existing score ranks below it.
 */
export function insertEndlessScore(
  table: readonly EndlessEntry[],
  entry: EndlessEntry,
): { table: EndlessEntry[]; rank: number } {
  const row: EndlessEntry = { score: Math.max(0, Math.floor(entry.score)), at: entry.at };
  const sorted = sortEndless([...table]);
  let i = 0;
  while (i < sorted.length && (sorted[i]?.score ?? 0) >= row.score) i++;
  sorted.splice(i, 0, row);
  return { table: sorted.slice(0, ENDLESS_TOP), rank: i < ENDLESS_TOP ? i + 1 : 0 };
}

export function loadEndlessScores(storage: StorageLike | null = defaultStorage()): EndlessEntry[] {
  return parseEndlessScores(readRaw(storage, ENDLESS_SCORES_KEY));
}

/** Record a finished Endless game. Returns its rank (0 if outside the top 10) and the best score. */
export function recordEndlessScore(
  score: number,
  at: number,
  storage: StorageLike | null = defaultStorage(),
): { rank: number; best: number } {
  const r = insertEndlessScore(loadEndlessScores(storage), { score, at });
  writeRaw(storage, ENDLESS_SCORES_KEY, JSON.stringify(r.table));
  return { rank: r.rank, best: r.table[0]?.score ?? 0 };
}

// Schema version (docs/03 section 8).

export const SCHEMA_KEY = 'sow.schema';
export const SCHEMA_VERSION = 1;

/** Write sow.schema on first launch. Returns the stored version (1 today). */
export function ensureSchema(storage: StorageLike | null = defaultStorage()): number {
  const v = parseUint32(readRaw(storage, SCHEMA_KEY));
  if (v !== null) return v;
  writeRaw(storage, SCHEMA_KEY, String(SCHEMA_VERSION));
  return SCHEMA_VERSION;
}

/**
 * Settings screen "Reset progress": unlocked back to 1, the Adventure table cleared, any held par
 * reward dropped, and (Ryan 2026-11-10) the story keys cleared too, so the next Adventure start
 * plays the opening and asks for a call sign again.
 */
export function resetProgress(storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, UNLOCKED_KEY, String(FIRST_LEVEL));
  writeRaw(storage, ADVENTURE_SCORES_KEY, '{}');
  writeRaw(storage, START_BONUS_KEY, '');
  writeRaw(storage, STORY_SEEN_KEY, '{}');
  writeRaw(storage, CALLSIGN_KEY, '');
}

/** Pure: a typed run seed, or null. Accepts 1 to 10 digits up to 4294967295. */
export function parseSeedInput(text: string): number | null {
  return parseUint32(text.trim());
}

// Adventure progression rules (docs/01 section 2.1).

/** Pure: unlocked index after finishing `index`. Success unlocks index + 1, regardless of stars. */
export function unlockAfter(unlocked: number, index: number, success: boolean): number {
  const base = Math.max(FIRST_LEVEL, Math.floor(unlocked));
  return success ? Math.max(base, Math.floor(index) + 1) : base;
}

/** Pure: true if level `index` can be started from level select. */
export function isUnlocked(unlocked: number, index: number): boolean {
  return Number.isInteger(index) && index >= FIRST_LEVEL && index <= Math.max(FIRST_LEVEL, unlocked);
}

// Free Play options (docs/14 "Free Play options"): the last setup screen choice, one JSON key
// { arena, barriers, config }. Difficulty stays in sow.progress.difficulty. Each field is checked
// on its own, so one bad field falls back to its default and the rest survive.

export const FREE_PLAY_KEY = `${SETTINGS_PREFIX}freePlay`;

export interface FreePlaySetup {
  readonly arena: FreePlayArena;
  readonly barriers: boolean;
  readonly config: FreePlayConfig;
}

export const DEFAULT_FREE_PLAY_SETUP: FreePlaySetup = Object.freeze({ arena: 'rect', barriers: false, config: DEFAULT_FREE_PLAY });

/** Every enemy kind the setup screen offers, in screen order. */
export const FREE_PLAY_ENEMY_KINDS: readonly EnemyKind[] = [...ENEMY_KINDS, ...V2_ENEMY_KINDS];

function oneOf<T>(v: unknown, allowed: readonly T[], def: T): T {
  const hit = allowed.find((a) => a === v);
  return hit === undefined ? def : hit;
}

function field(o: object, k: string): unknown {
  return k in o ? (o as Record<string, unknown>)[k] : undefined;
}

/** Pure: a list of enemy kinds, known kinds only, no repeats, in FREE_PLAY_ENEMY_KINDS order. */
export function parseEnemyKinds(v: unknown): EnemyKind[] {
  if (!Array.isArray(v)) return [];
  const raw: readonly unknown[] = v;
  return FREE_PLAY_ENEMY_KINDS.filter((k) => raw.includes(k));
}

/** Pure: a FreePlayConfig from untrusted JSON; each bad or missing field takes its default. */
export function parseFreePlayConfig(v: unknown): FreePlayConfig {
  const d = DEFAULT_FREE_PLAY;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const g = (k: string): unknown => field(v, k);
  return {
    enemies: parseEnemyKinds(g('enemies')),
    density: oneOf(g('density'), ['low', 'normal', 'swarm'] as const, d.density),
    lives: oneOf(g('lives'), [1, 3, 5, 'infinite'] as const, d.lives),
    length: oneOf(g('length'), ['endless', 180, 300, 600] as const, d.length),
    weapon: g('weapon') === null ? null : oneOf(g('weapon'), ['spread', 'rapid', 'pierce', 'orbit'] as const, d.weapon),
    pickups: typeof g('pickups') === 'boolean' ? g('pickups') === true : d.pickups,
    drone: oneOf(g('drone'), ['attack', 'collect', 'ram'] as const, d.drone),
    superType: oneOf(g('superType'), ['homing', 'detonate', 'turbo'] as const, d.superType),
    bosses: oneOf(g('bosses'), ['off', 'every3', ...BOSS_IDS] as const, d.bosses),
    wells: oneOf(g('wells'), ['off', 'normal', 'many'] as const, d.wells),
    drift: oneOf(g('drift'), ['off', 'low', 'high'] as const, d.drift),
    size: oneOf(g('size'), ['small', 'medium', 'large'] as const, d.size),
  };
}

/** Pure: the stored setup, or the default for anything missing or malformed. */
export function parseFreePlaySetup(raw: string | null): FreePlaySetup {
  const d = DEFAULT_FREE_PLAY_SETUP;
  if (raw === null || raw === '') return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return d;
  const barriers = field(v, 'barriers');
  return {
    arena: oneOf(field(v, 'arena'), ['rect', 'circle', 'drum'] as const, d.arena),
    barriers: typeof barriers === 'boolean' ? barriers : d.barriers,
    config: parseFreePlayConfig(field(v, 'config')),
  };
}

/** Pure: the JSON stored for a setup (validated first, so only known values are written). */
export function encodeFreePlaySetup(s: FreePlaySetup): string {
  const v = parseFreePlaySetup(JSON.stringify(s));
  return JSON.stringify({ arena: v.arena, barriers: v.barriers, config: v.config });
}

export function loadFreePlaySetup(storage: StorageLike | null = defaultStorage()): FreePlaySetup {
  return parseFreePlaySetup(readRaw(storage, FREE_PLAY_KEY));
}

export function saveFreePlaySetup(s: FreePlaySetup, storage: StorageLike | null = defaultStorage()): void {
  writeRaw(storage, FREE_PLAY_KEY, encodeFreePlaySetup(s));
}

// Story scenes (docs/19, brief ledger-story-scenes): two device only keys. The call sign is never
// sent anywhere. Seen scenes map each trigger id to the Adventure level it was shown on, so level
// select can offer "Replay story" for that level. Reset progress clears both (Ryan 2026-11-10).

export const CALLSIGN_KEY = 'sow.progress.callsign';
export const STORY_SEEN_KEY = 'sow.progress.storySeen';

/** A call sign: letters and digits only, 3 to 10 characters. */
export const CALLSIGN_RE = /^[A-Za-z0-9]{3,10}$/;
export const CALLSIGN_MIN = 3;
export const CALLSIGN_MAX = 10;

/** Pure: the stored call sign, or null when missing or not valid. */
export function parseCallsign(raw: string | null): string | null {
  return raw !== null && CALLSIGN_RE.test(raw) ? raw : null;
}

export function loadCallsign(storage: StorageLike | null = defaultStorage()): string | null {
  return parseCallsign(readRaw(storage, CALLSIGN_KEY));
}

/** Writes only a valid call sign; returns whether it was written. */
export function saveCallsign(name: string, storage: StorageLike | null = defaultStorage()): boolean {
  if (!CALLSIGN_RE.test(name)) return false;
  writeRaw(storage, CALLSIGN_KEY, name);
  return true;
}

/** Trigger id to the 1 based Adventure level it was first shown on. */
export type StorySeen = Readonly<Record<string, number>>;

const STORY_ID_RE = /^[a-z]+(:[a-z]+(\+[a-z]+)?)?$/;

/** Pure: the stored seen map; malformed rows are dropped, a malformed value reads as empty. */
export function parseStorySeen(raw: string | null): StorySeen {
  if (raw === null || raw === '') return {};
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, lvl] of Object.entries(v)) {
    if (!STORY_ID_RE.test(k)) continue;
    if (typeof lvl !== 'number' || !Number.isInteger(lvl) || lvl < 1) continue;
    out[k] = lvl;
  }
  return out;
}

export function loadStorySeen(storage: StorageLike | null = defaultStorage()): StorySeen {
  return parseStorySeen(readRaw(storage, STORY_SEEN_KEY));
}

/** Pure: the map with `id` marked as shown on `level`; an id already seen keeps its first level. */
export function markStorySeen(seen: StorySeen, id: string, level: number): StorySeen {
  if (seen[id] !== undefined || !STORY_ID_RE.test(id)) return seen;
  return { ...seen, [id]: Math.max(1, Math.floor(level)) };
}

/** Mark one scene as seen and persist. Returns the new map. */
export function recordStorySeen(id: string, level: number, storage: StorageLike | null = defaultStorage()): StorySeen {
  const prev = loadStorySeen(storage);
  const next = markStorySeen(prev, id, level);
  if (next !== prev) writeRaw(storage, STORY_SEEN_KEY, JSON.stringify(next));
  return next;
}
