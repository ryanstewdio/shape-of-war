// Boss shield contract (GW2): 'sim:bossShield' { id, up, x, y } fires when any boss shield goes up
// and when it drops (Warden's hive shield, Bastion's phase 3 shield). setShield is the only writer
// of BossState.shielded that reports, so the event fires once per edge and never repeats. The
// payload is BossState.shieldEv, reused (no allocation per edge).
import { bus } from '../../core/events';
import type { BossState } from './state';

/** Raise or drop the shield at (x, y). Emits 'sim:bossShield' only on a change. */
export function setShield(bs: BossState, up: boolean, x: number, y: number, left: number): void {
  const was = bs.shielded;
  bs.shielded = up;
  bs.shieldLeft = up ? (left > 0 ? left : 0) : 0;
  if (was === up) return;
  const e = bs.shieldEv;
  e.id = bs.spec.id;
  e.up = up;
  e.x = x;
  e.y = y;
  bus.emit('sim:bossShield', e);
}
