// Boss health bar contract (Morpheus stub, Ryan 2026-11-11). Every guardian's health shows as two
// stacked bars inside the HUD bar: a blue Shield bar that empties first (the guardian cracks when
// it is gone), then a red Health bar. Brood empties both, then splits into Broodlings, which get
// their own Shield and Health bars under a "Broodlings" label. Swarm owns the real numbers (it
// replaces the body of bossBar); Ledger draws whatever this returns. Pure, no PRNG.
import type { BossView } from './view';

export interface BossBar {
  /** Shield bar fill, 1 full to 0 gone. 0 once the guardian has cracked. */
  shield: number;
  /** Health bar fill, 1 full to 0 gone. Stays 1 while the shield is up. */
  health: number;
  /** Label for the bar; empty means the guardian's own name. "Broodlings" during Brood's split phase. */
  label: string;
}

/** Share of the hit points that belong to the Shield bar (stub value; Swarm may replace it per guardian). */
export const SHIELD_SHARE = 0.5;

/** Stub: splits hp at SHIELD_SHARE. Swarm replaces this with per guardian and Broodling aware values. */
export function bossBar(v: Readonly<BossView>): BossBar {
  if (!v.active || v.maxHp <= 0) return { shield: 0, health: 0, label: '' };
  const f = Math.max(0, Math.min(1, v.hp / v.maxHp));
  const split = 1 - SHIELD_SHARE;
  const shield = f > split ? (f - split) / SHIELD_SHARE : 0;
  const health = f > split ? 1 : f / split;
  return { shield, health, label: '' };
}
