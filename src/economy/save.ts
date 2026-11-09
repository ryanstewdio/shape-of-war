// Versioned JSON save for the gem ledger and inventory. Pure: no storage calls (a later wave
// wires storage and registers its key). Loading never throws: corrupt input falls back to an empty
// wallet and the result says why. Each entry is replayed through apply, so a save can never hold
// a duplicate id, a negative balance or an item bought without the gems.
import { apply, EMPTY_LEDGER, type Ledger, type LedgerEntry } from './ledger';

export const SAVE_VERSION = 1;

export interface WalletSaveV1 {
  readonly version: 1;
  readonly entries: readonly LedgerEntry[];
  readonly inventory: readonly string[];
}

/** Hand written pre ledger shape: a bare balance and owned item list, no ids. */
export interface WalletSaveV0 {
  readonly gems: number;
  readonly owned: readonly string[];
}

export type LoadStatus = 'ok' | 'empty' | 'migrated' | 'corrupt';

export interface LoadResult {
  readonly ledger: Ledger;
  readonly status: LoadStatus;
  /** Why the save was rejected, for logging; empty unless status is "corrupt". */
  readonly problems: readonly string[];
}

/** Id of the single earn entry that carries a v0 balance into the ledger. */
export const V0_MIGRATION_ID = 'migrate:v0';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0);
}

/** Pure: the v1 save for a ledger. */
export function toSave(l: Ledger): WalletSaveV1 {
  return { version: SAVE_VERSION, entries: [...l.entries], inventory: [...l.inventory] };
}

/** Pure: JSON text for a ledger. */
export function serialize(l: Ledger): string {
  return JSON.stringify(toSave(l));
}

/** Pure: one entry from untrusted JSON, or a reason it is not one. */
export function parseEntry(v: unknown): LedgerEntry | string {
  if (!isRecord(v)) return 'entry is not an object';
  const { kind, id, gems } = v;
  if (typeof id !== 'string' || id.length === 0) return 'entry id missing';
  if (typeof gems !== 'number' || !Number.isSafeInteger(gems) || gems <= 0) return `entry ${id}: bad gems`;
  if (kind === 'earn') {
    const source = typeof v.source === 'string' ? v.source : '';
    return { kind, id, gems, source };
  }
  if (kind === 'spend') {
    if (typeof v.itemId !== 'string' || v.itemId.length === 0) return `entry ${id}: item id missing`;
    return { kind, id, gems, itemId: v.itemId };
  }
  return `entry ${id}: unknown kind`;
}

/** Pure: true when the value looks like a v0 save. */
export function isV0(v: unknown): v is WalletSaveV0 {
  return isRecord(v) && !('version' in v) && typeof v.gems === 'number' && isStringArray(v.owned);
}

/**
 * Migration hook: v0 to v1. The balance becomes one earn entry and owned items move to the
 * inventory with no spend (they were already paid for). Returns a reason string if unusable.
 */
export function migrateV0(v: WalletSaveV0): WalletSaveV1 | string {
  if (!Number.isSafeInteger(v.gems) || v.gems < 0) return 'v0: bad gems';
  const entries: LedgerEntry[] = v.gems > 0 ? [{ kind: 'earn', id: V0_MIGRATION_ID, gems: v.gems, source: 'migration' }] : [];
  return { version: 1, entries, inventory: [...new Set(v.owned)] };
}

/** Migrations keyed by the version they upgrade from. A future v2 adds an entry for 1. */
export const MIGRATIONS: Readonly<Record<number, (v: Record<string, unknown>) => unknown>> = Object.freeze({});

function corrupt(problems: string[]): LoadResult {
  return { ledger: EMPTY_LEDGER, status: 'corrupt', problems };
}

/** Pure: rebuild a ledger from a v1 save, replaying every entry through apply. */
function rebuild(v: unknown): Ledger | string[] {
  if (!isRecord(v) || v.version !== SAVE_VERSION) return ['not a v1 save'];
  if (!Array.isArray(v.entries)) return ['entries missing'];
  if (!isStringArray(v.inventory)) return ['inventory missing or bad'];
  const inventory: readonly string[] = v.inventory;
  let l: Ledger = EMPTY_LEDGER;
  for (const raw of v.entries) {
    const e = parseEntry(raw);
    if (typeof e === 'string') return [e];
    const r = apply(l, e);
    if (r.status !== 'applied') return [`entry ${e.id}: ${r.status}`];
    l = r.ledger;
  }
  // The inventory may hold items with no spend (migrated v0 items), but every spend's item must
  // be in it.
  const missing = l.inventory.filter((id) => !inventory.includes(id));
  if (missing.length > 0) return [`inventory missing ${missing.join(', ')}`];
  return { entries: l.entries, inventory: [...new Set(inventory)] };
}

/** Pure: a ledger from parsed JSON. Never throws. */
export function fromSave(v: unknown): LoadResult {
  if (v === null || v === undefined) return { ledger: EMPTY_LEDGER, status: 'empty', problems: [] };
  let migrated = false;
  let cur: unknown = v;
  if (isV0(cur)) {
    const m = migrateV0(cur);
    if (typeof m === 'string') return corrupt([m]);
    cur = m;
    migrated = true;
  }
  for (let guard = 0; guard < 16 && isRecord(cur) && typeof cur.version === 'number' && cur.version < SAVE_VERSION; guard++) {
    const step = MIGRATIONS[cur.version];
    if (step === undefined) return corrupt([`no migration from v${cur.version}`]);
    cur = step(cur);
    migrated = true;
  }
  if (isRecord(cur) && typeof cur.version === 'number' && cur.version > SAVE_VERSION) {
    return corrupt([`save v${cur.version} is newer than v${SAVE_VERSION}`]);
  }
  const r = rebuild(cur);
  if (Array.isArray(r)) return corrupt(r);
  return { ledger: r, status: migrated ? 'migrated' : 'ok', problems: [] };
}

/** Pure: a ledger from stored text (null when nothing is stored). Never throws. */
export function deserialize(text: string | null): LoadResult {
  if (text === null || text === '') return { ledger: EMPTY_LEDGER, status: 'empty', problems: [] };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return corrupt(['not JSON']);
  }
  if (v === null) return corrupt(['null save']);
  try {
    return fromSave(v);
  } catch {
    return corrupt(['load threw']);
  }
}
