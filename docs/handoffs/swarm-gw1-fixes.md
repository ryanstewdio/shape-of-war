# Swarm hand-off: gw1-fixes

Branch: feat/swarm-gw1-fixes. Session: https://claude.ai/code/session_018Gwqi3rChNwuRFkQeoS98b

## What changed
- Warden. Why the shield never showed: it ran in phase 2 only, and `onPhase` restarted its clock at the phase change, so the first shield came 14 s after half health. Most fights ended before that. Now it runs in every phase. The first shield comes 10 s after the entrance, then every 14 s, measured start to start on step time (not the enraged rate). After a ship death the cycle restarts and the next shield again comes 10 s in. Hornets are a fixed 8 per shield (2 bursts of 4) and live in their own pool (`BossState.hornetIds`, `MAX_HORNETS = 8`), so full add slots never block them. When the shield drops, the core is open for 2.5 s (`WARDEN_SHIELD.openSec`). A ring window can no longer cut that window short. HP goes from 360 to 432 hits. Rings come every 4.05 s (was 4.5) and 3.15 s in phase 2 (was 3.5).
- Orbit v2. Two rings of 4 spikes: the inner ring at 80 u turns forward, the outer ring at 100 u turns back. No blades, no push. While the aim stick is held, a saw level rises from 0 to 1 over 0.25 s and falls just as fast on release. Spikes within 60 degrees of the aim stretch along their tangent to 2.5x (full inside 50 degrees, fading to none at 60). A single saw level is used because at 2.4 rev/s a spike crosses the 120 degree cone in about 0.14 s, so a per-spike 0.25 s ramp could never reach 2.5x. Hits use a capsule (`capsuleHits`). A stretched spike hits every enemy along its length; a resting spike hits one, like a blade (Eclipse resting spikes still pierce 3). Damage and cooldown are unchanged. Halo, Whirl and Eclipse use the same rings and keep their own rev, cooldown and piercing. Eclipse drops from 10 hitters to 8.
- Nova snakes. A well in nova releases a Snake from its centre after a hashed 3 to 4 s (keyed by seed and well position), then one every 6 s. Each well can have at most 2 live snakes, and emergence also respects the snake slots, the free entity pool and `maxLiveEnemies`. An emergence that falls due with no room is skipped. The snakes are normal (scored). The well's explosion removes its snakes wherever they are; a well that is shot down leaves them alive. Endless still has no wells.

## Files touched
src/core/events.ts; src/game/{bullets,combat,remove,state,weapons}.ts; src/game/bosses/{core,state,table,types,warden}.ts; src/game/enemies/{gravitywell,snake}.ts; tests/game/{bossCore,bossWarden,bossWardenShield,weaponCombine,weapons}.test.ts; new tests/game/wellSnakes.test.ts. No tests/qa changes were needed.

## Tests
- bossWardenShield (11): shield at 10/24/38/52 s in a 60 s sim, identical with every add slot full; 8 Hornets live after the second burst; 9th refused; 2.5 s window; phase 2 shields; determinism.
- bossWarden (5, updated): ring and shield windows, new cadence. bossCore: HP numbers updated.
- weaponCombine orbit v2 (8 new): pure rules, capsule, counter rotation and radii, 2.5x stretch in 0.25 s and back, chainsaw vs resting hits, cooldown, Eclipse pierce, pair inheritance; determinism test now hashes saw and spikeLen.
- wellSnakes (8 new): hash range, due rule, timing, head at the well, nova off, the 2-per-well cap with refill after a kill, snake slots full, explosion cleanup, determinism without Math.random.

## Results
`npm test`: 3183 passed, 2 failed, 1 todo. Both failures are in tests/levelgen, which this change does not touch. One is the accepted "200 levels under 350 ms". The other, v2enemies "rosters keep 3 to 6", hit a 60 s timeout under full-suite load and passes alone (33/33). Level snapshots are unchanged. `npm run build`: pass. The v7 grep and the dash check are clean.

## Contracts for other roles
- Glow: `BulletPool.spikeLen` (Float32Array) gives a style 3 spike's length in u along its tangent (the vx, vy direction), centred on x, y. It is 24 at rest and up to 60 while sawing. `phase` is still the angle round the ship. The outer ring's vx, vy point the other way. There are now 8 orbit bullets per weapon (Eclipse had 10).
- Glow and Chorus: new bus event `sim:wellSpawn { id, x, y, kind }`, fired once per emergence. `id` is the well, (x, y) is the well centre, and `kind` is `Kind.SnakeHead`.
- Hornets are no longer in `bs.addIds`. The renderer's `isBossAdd` only checked non-part entities, so Hornet drawing is unaffected.

## Risks and open questions
- A fairness rating near 4 can only be confirmed on device. The tuning is in `WARDEN`, `WARDEN_SHIELD` and the boss table.
- `removeEntity` compacts `wellIds` but not `wellAge` or `wellNova` (an existing quirk). Nova snakes key their clock per entity, so they are not affected.
- Should a well that is shot down also remove its snakes? The brief only covers the explosion.

## Device check for Ryan
1. Play level 5 (Warden). About 10 s after it settles, it should stop, show its shield, and release 4 Hornets and then 4 more. When the shield drops, its core should stay open for about 2.5 s. The shield should repeat every 14 s, before and after half health.
2. Pick up orbit. You should see two rings of 4 spikes turning in opposite directions. Hold the aim stick: the spikes facing the aim should stretch into a saw arc and cut through a whole group. Release, and they shrink back within a quarter second. Try Halo, Whirl and Eclipse too.
3. On a level with a gravity well, wait for the nova, then about 3.5 s more. A snake should crawl out of the well, another 6 s later, and never more than 2 per well at once. Feed the well until it explodes: its snakes should vanish, even far away ones.
