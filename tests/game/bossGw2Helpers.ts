// Shared helpers for the GW2 boss tests: a deterministic numeric hash of the world, boss state and
// enemy bullet pool, so two runs can be compared as "hash equal".
import { bossOf } from '../../src/game/bosses/state';
import { enemyBulletsOf } from '../../src/game/enemyBullets';
import type { World } from '../../src/game/world';

const M = 2147483647;

function mix(h: number, v: number): number {
  const q = Number.isFinite(v) ? Math.round(v * 1000) : 7;
  return (h * 31 + (((q % M) + M) % M)) % M;
}

/** Hash of every live entity, the boss state and the enemy bullet pool. */
export function stateHash(w: World): number {
  let h = 17;
  for (let i = 0; i < w.cap; i++) {
    if (w.alive[i] !== 1) continue;
    h = mix(h, i);
    h = mix(h, w.kind[i] ?? 0);
    h = mix(h, w.a[i] ?? 0);
    h = mix(h, w.x[i] ?? 0);
    h = mix(h, w.y[i] ?? 0);
    h = mix(h, w.hp[i] ?? 0);
    h = mix(h, w.rot[i] ?? 0);
    h = mix(h, w.radius[i] ?? 0);
  }
  const s = bossOf(w);
  if (s !== null) {
    h = mix(h, s.phase);
    h = mix(h, s.shielded ? 1 : 0);
    h = mix(h, s.shieldLeft);
    h = mix(h, s.open ? 1 : 0);
    h = mix(h, s.split ? 1 : 0);
    for (let k = 0; k < s.abl.length; k++) h = mix(h, s.abl[k] ?? 0);
  }
  const p = enemyBulletsOf(w);
  for (let e = 0; e < p.cap; e++) {
    if (p.alive[e] !== 1) continue;
    h = mix(h, e);
    h = mix(h, p.x[e] ?? 0);
    h = mix(h, p.y[e] ?? 0);
  }
  return h;
}
