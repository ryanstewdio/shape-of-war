// Append only gem ledger and inventory (docs/16 Economy principles). Pure and immutable: every
// operation returns a new Ledger. An entry id is applied once; a second apply changes nothing.
// Spends never take the balance below zero. No real money concepts live here.
import type { GemAward } from './earn';

export interface EarnEntry {
  readonly kind: 'earn';
  readonly id: string;
  readonly gems: number;
  /** What paid it, for display and audit (an AwardSource or "migration"). */
  readonly source: string;
}

export interface SpendEntry {
  readonly kind: 'spend';
  readonly id: string;
  readonly gems: number;
  /** The shop item this spend bought; it joins the inventory. */
  readonly itemId: string;
}

export type LedgerEntry = EarnEntry | SpendEntry;

export interface Ledger {
  readonly entries: readonly LedgerEntry[];
  /** Owned item ids, in purchase order, no repeats. */
  readonly inventory: readonly string[];
}

export type ApplyStatus = 'applied' | 'duplicate' | 'insufficient' | 'owned' | 'invalid';

export interface ApplyResult {
  readonly ledger: Ledger;
  readonly status: ApplyStatus;
}

export const EMPTY_LEDGER: Ledger = Object.freeze({ entries: Object.freeze([]), inventory: Object.freeze([]) });

/** Pure: current gem balance. */
export function balance(l: Ledger): number {
  let b = 0;
  for (const e of l.entries) b += e.kind === 'earn' ? e.gems : -e.gems;
  return b;
}

/** Pure: true when an entry with this id was already applied. */
export function hasEntry(l: Ledger, id: string): boolean {
  return l.entries.some((e) => e.id === id);
}

/** Pure: the set of applied entry ids, for awardsFor's `claimed`. */
export function entryIds(l: Ledger): Set<string> {
  return new Set(l.entries.map((e) => e.id));
}

/** Pure: true when the item is owned. */
export function owns(l: Ledger, itemId: string): boolean {
  return l.inventory.includes(itemId);
}

function validAmount(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

function validId(s: string): boolean {
  return typeof s === 'string' && s.length > 0;
}

/** Pure: apply one entry. Idempotent by id; a spend is refused if it would go negative. */
export function apply(l: Ledger, e: LedgerEntry): ApplyResult {
  if (!validId(e.id) || !validAmount(e.gems)) return { ledger: l, status: 'invalid' };
  if (hasEntry(l, e.id)) return { ledger: l, status: 'duplicate' };
  if (e.kind === 'earn') {
    return { ledger: { entries: [...l.entries, e], inventory: l.inventory }, status: 'applied' };
  }
  if (!validId(e.itemId)) return { ledger: l, status: 'invalid' };
  if (owns(l, e.itemId)) return { ledger: l, status: 'owned' };
  if (balance(l) < e.gems) return { ledger: l, status: 'insufficient' };
  return { ledger: { entries: [...l.entries, e], inventory: [...l.inventory, e.itemId] }, status: 'applied' };
}

/** Pure: an earn entry from an award. */
export function earnEntry(a: GemAward): EarnEntry {
  return { kind: 'earn', id: a.id, gems: a.gems, source: a.source };
}

/** Pure: apply each award in order. Zero gem awards are skipped as invalid. */
export function applyAwards(l: Ledger, awards: readonly GemAward[]): Ledger {
  return awards.reduce((acc, a) => apply(acc, earnEntry(a)).ledger, l);
}

/** Pure: id of the spend that buys an item. One purchase per item, so repeats are duplicates. */
export function spendId(itemId: string): string {
  return `spend:${itemId}`;
}

/** Pure: buy an item at a gem price. */
export function spend(l: Ledger, itemId: string, price: number): ApplyResult {
  return apply(l, { kind: 'spend', id: spendId(itemId), gems: price, itemId });
}
