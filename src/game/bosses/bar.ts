// Boss health bar (Ryan 2026-11-11; contract stubbed by Morpheus, numbers by Swarm). Every
// guardian's health shows as two stacked bars inside the HUD bar: a blue Shield bar that empties
// first (the guardian cracks, sim:bossCrack stage 1, the moment it is gone), then a red Health bar
// (stage 2 lands halfway down it, at CRACK_AT[1] of the hit points). Brood empties both, then splits
// into Broodlings, which get their own Shield and Health bars under a "Broodlings" label and reach
// 0 only when the last Broodling falls. Gravitas and Tempest carry their remaining hit points into
// their parts, so their bars run on without a jump. Ledger draws whatever this returns. Pure, no PRNG.
import { CRACK_AT } from './table';
import type { BossView } from './view';

export interface BossBar {
  /** Shield bar fill, 1 full to 0 gone. 0 once the guardian has cracked. */
  shield: number;
  /** Health bar fill, 1 full to 0 gone. Stays 1 while the shield is up. */
  health: number;
  /** Label for the bar; empty means the guardian's own name. "Broodlings" during Brood's split phase. */
  label: string;
}

/**
 * Share of the hit points that belong to the Shield bar: everything above the stage 1 crack line,
 * so the shield empties exactly when the guardian cracks. One share for every guardian and for the
 * Broodlings' own bar.
 */
export const SHIELD_SHARE = 1 - CRACK_AT[0];

/** The label of the Broodlings' bar. */
export const BROODLINGS_LABEL = 'Broodlings';

/** Pure: the two fills for hp of max (tenths), shield first. */
export function barFills(hp: number, max: number): { shield: number; health: number } {
  if (!(max > 0)) return { shield: 0, health: 0 };
  const h = hp < 0 ? 0 : hp > max ? max : hp;
  const line = max * CRACK_AT[0];
  if (h >= line) return { shield: (h - line) / (max - line), health: 1 };
  return { shield: 0, health: h / line };
}

/**
 * The bar of the guardian in view: the body's hit points, or after a split the parts' sum (the
 * Broodlings' own bar for Brood). Empty bars with no guardian to show.
 */
export function bossBar(v: Readonly<BossView>): BossBar {
  const on = v.barOn ?? v.active;
  const hp = v.barHp ?? v.hp;
  const max = v.barMax ?? v.maxHp;
  if (!on || !(max > 0)) return { shield: 0, health: 0, label: '' };
  const f = barFills(hp, max);
  return { shield: f.shield, health: f.health, label: v.broodlings === true ? BROODLINGS_LABEL : '' };
}
