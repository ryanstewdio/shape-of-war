// R2 contract stub (Fable): the reward for reaching par, carried into the next level start.
// Ledger shows the choice on the results screen and passes it in GameOptions.startBonus; Forge applies it.
import type { BaseWeaponKind } from './events';

export type StartBonus = { kind: 'life' } | { kind: 'bomb' } | { kind: 'weapon'; weapon: BaseWeaponKind };
