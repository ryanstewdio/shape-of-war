// G3C boss identity (run 0288): the Prism window state machine driven by 'sim:bossWindow', the
// per boss hit flash throttle, crack and break off geometry for 'sim:bossCrack', the identity
// table (silhouette and colour family per boss), the tier 3 halo and the Twins enrage flare.
// Pure functions and small state records only; the renderer owns the Graphics.
import type { Bus, EventKey } from '../core/events';
import { BOSS_IDS } from '../levelgen/leveldef';
import { BREAK_ARCS, BREAK_ARCS_MAX, breakArcs } from './bossDamage';

import { BOSS_BROOD, BOSS_COUNT, BOSS_WARDEN, bossColourOf, bossIndex } from './bossLook';
import { bossBodyR, buildBossSpec } from './bossShapes';
import type { PaletteKey } from './neon';
import type { ShapePrim } from './shapeSpecs';

function fin(v: number, d: number): number {
  return Number.isFinite(v) ? v : d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(u: number): number {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
}

// Identity

export type Silhouette =
  | 'heavyHexagon'
  | 'podCluster'
  | 'thinSpindle'
  | 'flameDiamond'
  | 'splitRings'
  | 'denseRing'
  | 'fortressSquare'
  | 'kiteTrail'
  | 'twinCircles'
  | 'gem';

export interface BossIdentity {
  readonly id: (typeof BOSS_IDS)[number];
  readonly silhouette: Silhouette;
  /** Body colour family (the baked spec colour). */
  readonly hue: PaletteKey;
  /** Attack colour: bullets and hazards of this boss take it (the owner's hue). */
  readonly attack: PaletteKey;
}

const SILHOUETTES: readonly Silhouette[] = [
  'heavyHexagon',
  'podCluster',
  'thinSpindle',
  'flameDiamond',
  'splitRings',
  'denseRing',
  'fortressSquare',
  'kiteTrail',
  'twinCircles',
  'gem',
];

/** One row per boss index, in BOSS_IDS order. */
export const BOSS_IDENTITY: readonly BossIdentity[] = BOSS_IDS.map((id, i) => ({
  id,
  silhouette: SILHOUETTES[i] ?? 'gem',
  hue: bossColourOf(i),
  attack: bossColourOf(i),
}));

// Two tone (v31): every boss but the Prism carries an accent on parts, cores or arms. The body and
// attack hazards keep the primary. Accents are palette colours pushed toward white or black, so they
// follow applyNeon like everything else.

export type AccentPart =
  | 'core'
  | 'sparks'
  | 'axis'
  | 'tips'
  | 'rim'
  | 'pods'
  | 'split'
  | 'centre'
  | 'turrets'
  | 'tail'
  | 'coreA'
  | 'coreB';

export interface AccentTone {
  readonly key: PaletteKey;
  /** Share mixed toward white, then toward black (0 to 1). */
  readonly white: number;
  readonly black: number;
}

export interface AccentEntry {
  readonly part: AccentPart;
  readonly tone: AccentTone;
}

const tone = (key: PaletteKey, white = 0, black = 0): AccentTone => ({ key, white, black });
const SILVER = tone('bossBlue', 0.72);
const GREY = tone('white', 0, 0.42);
const GOLD = tone('bossYellow', 0.08);
const PALE = tone('white');
const VOID = tone('bossViolet', 0, 0.88);

/** Accent parts per boss index, in BOSS_IDS order. The Prism keeps its cycling gem (no accent). */
export const BOSS_TWO_TONE: readonly (readonly AccentEntry[])[] = [
  /* Warden */ [{ part: 'rim', tone: SILVER }],
  /* Brood */ [{ part: 'pods', tone: tone('yellow') }],
  /* Spindle */ [
    { part: 'axis', tone: tone('cyan') },
    { part: 'tips', tone: PALE },
  ],
  /* Ember (look v32: white hot core inside the flame) */ [
    { part: 'core', tone: tone('yellow', 0.6) },
    { part: 'sparks', tone: tone('bossYellow', 0.25) },
  ],
  /* Mirage */ [{ part: 'split', tone: PALE }],
  /* Gravitas */ [
    { part: 'centre', tone: VOID },
    { part: 'rim', tone: PALE },
  ],
  /* Bastion */ [{ part: 'turrets', tone: GREY }],
  /* Tempest */ [{ part: 'tail', tone: tone('cyan') }],
  /* Twins */ [
    { part: 'coreA', tone: GOLD },
    { part: 'coreB', tone: SILVER },
  ],
  /* Prism */ [],
];

/** Pure: the accent tone of a boss part, or null when that boss has none there. */
export function bossAccent(b: number, part: AccentPart): AccentTone | null {
  const row = BOSS_TWO_TONE[bossIndex(b)] ?? [];
  for (const e of row) if (e.part === part) return e.tone;
  return null;
}

function mixInt(a: number, b: number, t: number): number {
  const u = clamp01(t);
  const r = Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * u));
  const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * u));
  const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * u));
  return (r << 16) | (g << 8) | bl;
}

/** Pure: the RGB of an accent tone under a palette (the live palette after applyNeon). */
export function accentRgb(t: AccentTone, pal: Readonly<Record<PaletteKey, number>>): number {
  return mixInt(mixInt(pal[t.key], 0xffffff, t.white), 0x000000, t.black);
}

/** Pure: tint of a boss part entity (pods, turrets): the accent where there is one, else primary. */
export function bossPartTint(b: number, primary: number, pal: Readonly<Record<PaletteKey, number>>): number {
  const i = bossIndex(b);
  const t = bossAccent(i, i === BOSS_BROOD ? 'pods' : 'turrets');
  return t === null ? primary : accentRgb(t, pal);
}

/** Pure: the attack colour key of a boss (its own hue). */
export function bossAttackKey(b: number): PaletteKey {
  return BOSS_IDENTITY[bossIndex(b)]?.attack ?? 'bossBlue';
}

/**
 * Pure: the outer outline of a boss body in arena units (unscaled), for the white hit flash and the
 * run to white. Warden's outline is plates, so it uses its heavy hexagon; the rest use the first
 * primitive of the body layer of their spec.
 */
export function bossOutline(b: number): ShapePrim {
  const i = bossIndex(b);
  const R = bossBodyR(i);
  if (i === BOSS_WARDEN) return { t: 'regularPoly', r: R, sides: 6, rot: 0 };
  const p = buildBossSpec(i, 0).layers[0]?.prims[0];
  return p !== undefined && p.t !== 'line' ? p : { t: 'circle', r: R };
}

/** Outlines of every boss, built once. */
export const BOSS_OUTLINES: readonly ShapePrim[] = Array.from({ length: BOSS_COUNT }, (_, i) => bossOutline(i));

// Prism window

/** Run up length: under this many seconds to the window the body runs to white. */
export const WINDOW_RUN_SEC = 0.5;
/** Contracting ring start radius, as a multiple of the body radius. */
export const WINDOW_RING_R0 = 2;
/** Thin hold ring radius while open. */
export const WINDOW_HOLD_R = 1.12;
/** Opening burst length and the sustained flash level after it. */
export const WINDOW_BURST_SEC = 0.18;
export const WINDOW_HOLD_FLASH = 0.6;

export interface BossWindow {
  /** True once a 'sim:bossWindow' event arrived for the live boss. */
  known: boolean;
  open: boolean;
  /** Seconds to the window (closed) or left in it (open), counted down on the draw clock. */
  left: number;
  /** Seconds since the window opened. */
  openAge: number;
}

export function createBossWindow(): BossWindow {
  return { known: false, open: false, left: Number.POSITIVE_INFINITY, openAge: 0 };
}

export function resetBossWindow(s: BossWindow): void {
  s.known = false;
  s.open = false;
  s.left = Number.POSITIVE_INFINITY;
  s.openAge = 0;
}

/** Apply one 'sim:bossWindow' payload. */
export function windowEvent(s: BossWindow, open: boolean, secondsLeft: number): void {
  const left = fin(secondsLeft, Number.POSITIVE_INFINITY);
  if (open && !s.open) s.openAge = 0;
  s.known = true;
  s.open = open;
  s.left = left < 0 ? 0 : left;
}

/** Advance on the draw clock. An open window that runs out closes on its own. */
export function stepBossWindow(s: BossWindow, dt: number): void {
  const d = fin(dt, 0);
  if (s.left > 0) s.left = Math.max(0, s.left - d);
  if (s.open) {
    s.openAge += d;
    if (s.left <= 0) {
      s.open = false;
      s.left = Number.POSITIVE_INFINITY;
    }
  }
}

/** Pure: whiteness 0 to 1 of the body: 1 while open, rising over the last WINDOW_RUN_SEC before it. */
export function windowWhite(s: BossWindow): number {
  if (!s.known) return 0;
  if (s.open) return 1;
  if (s.left >= WINDOW_RUN_SEC) return 0;
  return smooth(1 - s.left / WINDOW_RUN_SEC);
}

/** Pure: flash level while open: a short full burst, then a sustained hold. 0 while closed. */
export function windowFlash(s: BossWindow): number {
  if (!s.known || !s.open) return 0;
  const burst = 1 - s.openAge / WINDOW_BURST_SEC;
  return burst > WINDOW_HOLD_FLASH ? burst : WINDOW_HOLD_FLASH;
}

export interface WindowRing {
  /** Radius as a multiple of the body radius. */
  r: number;
  alpha: number;
  /** Line width multiplier (thin while open). */
  width: number;
}

/** Pure: contracting from 2x during the run up, a thin held ring while open, else hidden. */
export function windowRing(s: BossWindow, out: WindowRing): WindowRing {
  const wv = windowWhite(s);
  if (s.known && s.open) {
    out.r = WINDOW_HOLD_R;
    out.alpha = 0.9;
    out.width = 0.5;
  } else if (wv > 0) {
    out.r = WINDOW_RING_R0 + (1 - WINDOW_RING_R0) * wv;
    out.alpha = wv;
    out.width = 1;
  } else {
    out.r = 0;
    out.alpha = 0;
    out.width = 0;
  }
  return out;
}

// Hit flash

/** At most 20 flashes per second per boss. */
export const BOSS_FLASH_MIN_MS = 50;
/** Outline flash length. */
export const BOSS_FLASH_SEC = 0.06;

/** Last flash time per boss index (ms on the draw clock). */
export type BossFlashThrottle = Float64Array;

export function createBossFlashThrottle(): BossFlashThrottle {
  return new Float64Array(BOSS_COUNT).fill(Number.NEGATIVE_INFINITY);
}

/** True (and records it) if boss b may flash at nowMs. */
export function bossFlashAllow(t: BossFlashThrottle, b: number, nowMs: number): boolean {
  const i = bossIndex(b);
  const last = t[i] ?? Number.NEGATIVE_INFINITY;
  if (nowMs - last < BOSS_FLASH_MIN_MS) return false;
  t[i] = nowMs;
  return true;
}

/** Pure: outline flash alpha at age seconds (1 to 0 over 60 ms). */
export function hitFlashAlpha(ageSec: number): number {
  const a = fin(ageSec, Number.POSITIVE_INFINITY);
  return a < 0 ? 1 : a >= BOSS_FLASH_SEC ? 0 : 1 - a / BOSS_FLASH_SEC;
}

/** Pure: sparks per hit, 2 or 3 by sequence. */
export function hitSparkCount(seq: number): number {
  return 2 + ((seq | 0) & 1);
}

// Cracks (look v33): battle damage by incompleteness, never black. At each stage the outline loses
// whole segments (BREAK_SHARE of the perimeter, a hashed arc table per boss and seed) from the body
// geometry itself, the remaining outline beside each gap shifts hue toward the accent and flickers,
// torn ends carry bright stubs, and the removed pieces fall away as outline fragments in the boss
// colours. The layout maths is in bossDamage.ts.

/** Outline fragments: points per fragment, drift (u), life (s) and spin (rad/s). */
export const FRAG_PTS = 8;
export const PIECE_DRIFT = 60;
export const PIECE_LIFE = 1.5;
export const PIECE_SPIN = 1.6;
/** Fragment slots: one per removed arc over both stages. */
export const PIECES_MAX = BREAK_ARCS_MAX;
/** Torn edges settle in over this many seconds after a stage lands (stubs flare then hold). */
export const BREAK_SETTLE_SEC = 0.6;

export interface BossCracks {
  stage: number;
  /** Local angle (radians, body frame) the arc table is laid from: the first hit side. */
  offset: number;
  /** Seed of the arc table (boss index mixed with the level seed). */
  seed: number;
  /** Seconds since the latest stage landed. */
  age: number;
  /** Removed arcs of the current stage: (start, end) local angle pairs, arcCount of them. */
  arcs: Float32Array;
  arcCount: number;
}

export function createBossCracks(): BossCracks {
  return { stage: 0, offset: 0, seed: 0, age: 0, arcs: new Float32Array(BREAK_ARCS_MAX * 2), arcCount: 0 };
}

export function resetBossCracks(c: BossCracks): void {
  c.stage = 0;
  c.age = 0;
  c.arcCount = 0;
}

/** Pure: distance from the centre to the outline of p along local angle theta (arena units). */
export function outlineRadius(p: ShapePrim, theta: number): number {
  const th = fin(theta, 0);
  if (p.t === 'circle') return p.r;
  if (p.t === 'regularPoly') {
    const n = Math.max(3, p.sides);
    const seg = (Math.PI * 2) / n;
    // Vertices sit at rot - PI / 2 + k * seg (PixiJS regularPoly starts at the top).
    let d = (th - p.rot + Math.PI / 2) % seg;
    if (d < 0) d += seg;
    return (p.r * Math.cos(Math.PI / n)) / Math.cos(d - seg / 2);
  }
  if (p.t === 'rect') {
    const c = Math.abs(Math.cos(th));
    const s = Math.abs(Math.sin(th));
    const a = c > 1e-6 ? p.w / 2 / c : Number.POSITIVE_INFINITY;
    const b = s > 1e-6 ? p.h / 2 / s : Number.POSITIVE_INFINITY;
    return Math.min(a, b);
  }
  // Polygon or line: the farthest crossing of the ray with an edge.
  const pts = p.pts;
  const n = pts.length >> 1;
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  let best = 0;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    const ax = pts[k * 2] ?? 0;
    const ay = pts[k * 2 + 1] ?? 0;
    const ex = (pts[j * 2] ?? 0) - ax;
    const ey = (pts[j * 2 + 1] ?? 0) - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den;
    const u = (ax * dy - ay * dx) / den;
    if (t > best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

/**
 * Apply 'sim:bossCrack' (stage 1 or 2) at local angle a. Stages only rise; a repeat is ignored. The
 * arc table is laid from the first hit side and kept, so stage 2 widens the stage 1 gaps and adds
 * new ones. A stage 2 that arrives first lays its arcs directly. Returns true when the stage advanced.
 */
export function crackEvent(c: BossCracks, stage: number, a: number, seed: number): boolean {
  const s = stage >= 2 ? 2 : 1;
  if (s <= c.stage) return false;
  if (c.stage < 1) {
    c.offset = fin(a, 0);
    c.seed = Math.floor(fin(seed, 0));
  }
  c.arcCount = breakArcs(s, c.seed, c.offset, c.arcs);
  c.age = 0;
  c.stage = s;
  return true;
}

/** Pure: the arc indices newly removed by a stage (stage 1: 0 to 2, stage 2: 3 and 4). */
export function newArcRange(stage: number): [number, number] {
  return stage >= 2 ? [BREAK_ARCS[0], BREAK_ARCS[1]] : [0, BREAK_ARCS[0]];
}

/** Advance the settle clock on the draw clock. */
export function stepBossCracks(c: BossCracks, dt: number): void {
  if (c.stage >= 1 && c.age < BREAK_SETTLE_SEC) c.age += fin(dt, 0);
}

/**
 * Pure: an outline fragment of p (arena units) centred on local angle theta with half span half,
 * written into out as FRAG_PTS (x, y) pairs relative to the fragment's own centre. The centre (body
 * frame, arena units) goes into centre.
 */
export function fragmentPts(p: ShapePrim, theta: number, half: number, out: Float32Array, centre: Float32Array): Float32Array {
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < FRAG_PTS; k++) {
    const t = theta - half + (2 * half * k) / (FRAG_PTS - 1);
    const r = outlineRadius(p, t);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    out[k * 2] = x;
    out[k * 2 + 1] = y;
    cx += x;
    cy += y;
  }
  cx /= FRAG_PTS;
  cy /= FRAG_PTS;
  for (let k = 0; k < FRAG_PTS; k++) {
    out[k * 2] = (out[k * 2] ?? 0) - cx;
    out[k * 2 + 1] = (out[k * 2 + 1] ?? 0) - cy;
  }
  centre[0] = cx;
  centre[1] = cy;
  return out;
}

/** Pure: drift distance (ease out) of a fragment at age seconds. */
export function pieceDrift(age: number): number {
  const u = clamp01(fin(age, PIECE_LIFE) / PIECE_LIFE);
  return PIECE_DRIFT * (1 - (1 - u) * (1 - u));
}

/** Pure: alpha of a fragment at age seconds (fades out over PIECE_LIFE). */
export function pieceAlpha(age: number): number {
  const u = clamp01(fin(age, PIECE_LIFE) / PIECE_LIFE);
  return (1 - u) * Math.sqrt(1 - u);
}

/** Pure: tumble angle of a fragment at age seconds; dir is +1 or -1. It slows as it drifts. */
export function pieceSpin(age: number, dir: number): number {
  const a = clamp01(fin(age, PIECE_LIFE) / PIECE_LIFE) * PIECE_LIFE;
  return (dir < 0 ? -1 : dir > 0 ? 1 : 0) * PIECE_SPIN * (a - (a * a) / (PIECE_LIFE * 3));
}

// Tier 3 halo and Twins flare

/** Slow red pulse of tier 3 bodies. */
export const TIER3_PULSE_HZ = 0.5;
/** Halo width in body radii and its base alpha. */
export const TIER3_HALO_WIDTH = 0.5;
export const TIER3_HALO_ALPHA = 0.32;

/** Pure: tier 3 pulse level 0 to 1 at timeSec; 0 for other tiers. */
export function tier3Pulse(tier: number, timeSec: number): number {
  if (tier !== 3) return 0;
  return 0.5 + 0.5 * Math.sin(fin(timeSec, 0) * TIER3_PULSE_HZ * Math.PI * 2);
}

/** Pure: tier 3 halo alpha (with the pulse) or 0 for other tiers. */
export function tier3HaloAlpha(tier: number, timeSec: number): number {
  if (tier !== 3) return 0;
  return TIER3_HALO_ALPHA * (0.7 + 0.6 * tier3Pulse(tier, timeSec));
}

/** Twins enrage flare rate, faster than the tier 3 pulse. */
export const TWINS_FLARE_HZ = 3;

/** Pure: Twins survivor flare alpha (phase 2 on), 0 before. */
export function twinsFlare(phase: number, timeSec: number): number {
  if (!(fin(phase, 1) >= 2)) return 0;
  return 0.45 + 0.4 * Math.sin(fin(timeSec, 0) * TWINS_FLARE_HZ * Math.PI * 2);
}

// Bus (coded against the event names; before Swarm's change lands the keys are not in Events and
// nothing emits them, so the handlers never run)

export const BOSS_WINDOW_EVENT = 'sim:bossWindow';
export const BOSS_CRACK_EVENT = 'sim:bossCrack';
type WindowKey = Extract<EventKey, typeof BOSS_WINDOW_EVENT>;
type CrackKey = Extract<EventKey, typeof BOSS_CRACK_EVENT>;

function field(p: unknown, k: string): unknown {
  return typeof p === 'object' && p !== null ? (p as Record<string, unknown>)[k] : undefined;
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** Pure: the id string of a payload, or the empty string. */
export function payloadId(p: unknown): string {
  const v = field(p, 'id');
  return typeof v === 'string' ? v : '';
}

export function onBossWindow(b: Bus, h: (id: string, open: boolean, secondsLeft: number) => void): () => void {
  return b.on<WindowKey>(BOSS_WINDOW_EVENT as WindowKey, (p: unknown) =>
    h(payloadId(p), field(p, 'open') === true, num(field(p, 'secondsLeft'), Number.POSITIVE_INFINITY)),
  );
}

export function onBossCrack(b: Bus, h: (id: string, stage: number, x: number, y: number) => void): () => void {
  return b.on<CrackKey>(BOSS_CRACK_EVENT as CrackKey, (p: unknown) =>
    h(payloadId(p), num(field(p, 'stage'), 1), num(field(p, 'x'), Number.NaN), num(field(p, 'y'), Number.NaN)),
  );
}
