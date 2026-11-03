// R2 enraged enemies (glow-r2-membrane). An enemy that squeezed through a membrane is enraged for
// the rest of its life (sim:enrage). The renderer tints its body and glow hot red (the palette red,
// so it follows applyNeon) with a subtle flicker. Ids are tracked from the event: a slot is cleared
// when it dies or its kind changes, so a reused slot never inherits the look. No pixi, no PRNG.
import { mixRgb } from './mapFx';

/** Share the palette red is lifted toward white at rest: hot, not dark. */
export const ENRAGE_LIFT = 0.12;
/** Extra lift toward white at the flicker peak (subtle). */
export const ENRAGE_FLICKER_WHITE = 0.16;
/** Flicker rate in Hz. */
export const ENRAGE_HZ = 7;
/** Glow multiplier at rest and its extra at the flicker peak. */
export const ENRAGE_GLOW = 1.3;
export const ENRAGE_GLOW_FLICKER = 0.25;
/** Kind marker for a slot marked by the event but not yet seen alive. */
export const ENRAGE_UNSEEN = -1;

export interface EnrageTrack {
  /** 1 when the slot is enraged. */
  on: Uint8Array;
  /** Kind seen at the first draw after the mark (ENRAGE_UNSEEN until then). */
  kind: Int32Array;
}

export function createEnrageTrack(cap: number): EnrageTrack {
  const n = Math.max(1, Math.floor(cap));
  return { on: new Uint8Array(n), kind: new Int32Array(n).fill(ENRAGE_UNSEEN) };
}

/** Grow the track to hold at least cap slots, keeping the marks. */
export function growEnrageTrack(t: EnrageTrack, cap: number): void {
  if (cap <= t.on.length) return;
  const on = new Uint8Array(cap);
  on.set(t.on);
  const kind = new Int32Array(cap).fill(ENRAGE_UNSEEN);
  kind.set(t.kind);
  t.on = on;
  t.kind = kind;
}

/** sim:enrage: mark the slot. Ids outside the track grow it. */
export function markEnraged(t: EnrageTrack, id: number): void {
  if (!Number.isInteger(id) || id < 0) return;
  if (id >= t.on.length) growEnrageTrack(t, id + 1);
  t.on[id] = 1;
  t.kind[id] = ENRAGE_UNSEEN;
}

/** The slot died or was hidden: drop the mark. */
export function clearEnraged(t: EnrageTrack, i: number): void {
  if (i < 0 || i >= t.on.length || t.on[i] !== 1) return;
  t.on[i] = 0;
  t.kind[i] = ENRAGE_UNSEEN;
}

/** Is live slot i of this kind enraged? The first sighting pins the kind; a different kind clears it. */
export function isEnraged(t: EnrageTrack, i: number, kind: number): boolean {
  if (i < 0 || i >= t.on.length || t.on[i] !== 1) return false;
  const k = t.kind[i] ?? ENRAGE_UNSEEN;
  if (k === ENRAGE_UNSEEN) {
    t.kind[i] = kind;
    return true;
  }
  if (k !== kind) {
    clearEnraged(t, i);
    return false;
  }
  return true;
}

/** Pure: flicker level 0 to 1 at render time t for a slot hash h (two beating sines, deterministic). */
export function enrageFlicker(t: number, h: number): number {
  const a = Math.sin(2 * Math.PI * (ENRAGE_HZ * t + h));
  const b = Math.sin(2 * Math.PI * (ENRAGE_HZ * 2.3 * t + 3 * h));
  const f = 0.5 + 0.5 * a * (0.7 + 0.3 * b);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/** Pure: hot red body and glow tint from the palette red (already through applyNeon). */
export function enrageTint(red: number, t: number, h: number): number {
  return mixRgb(red, 0xffffff, ENRAGE_LIFT + ENRAGE_FLICKER_WHITE * enrageFlicker(t, h));
}

/** Pure: glow multiplier of an enraged enemy (the glow sprite alpha goes through applyNeon too). */
export function enrageGlowMul(t: number, h: number): number {
  return ENRAGE_GLOW + ENRAGE_GLOW_FLICKER * enrageFlicker(t, h);
}
