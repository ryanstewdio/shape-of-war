# Hand off: forge gw3-saw

Branch: feat/forge-gw3-saw. Session: https://claude.ai/code/session_018Gwqi5pQMraVhp8nizJ39N

## What changed
- Orbit chainsaw bar (weapons.ts): while the saw level s is above 0, both ring tracks bend out toward the aim. A spike at ring angle a sits at r0 x (1 + s x K x f(a - aim)). K is 2.2 outer (100 u to 320 u) and 1.6 inner (80 u to 208 u). f is 1 within 25 deg of the aim and smoothsteps down to 0 at 70 deg. Spikes keep their spin and counter rotation, so they run out one side of the bar, round the tip and back. The bar follows the aim every step, and the 0.25 s ramp up and down is unchanged.
- BulletPool.vx, vy for orbit spikes now hold the unit direction of travel along the bent track (used to be orbit velocity). spikeLen is 24 at rest and up to 40 at the bar tip. The 2.5x tangent stretch is gone. WeaponState.stretch now holds each spike's track radius multiplier.
- Hits (combat.ts orbitHits): the capsule runs from the previous spike position to the current one, lengthened by spikeLen/2 at each end. A jump longer than SWEEP_MAX (160 u, for example an aim flick) falls back to the spike body only. Saw power rules (1.5x damage, 0.7x cooldown, non boss) are unchanged.
- sim:saw: 'game:pause' with the saw sounding emits { on: false } (createGame subscribes for the newest game; pauseGame(w) is also exported). The first step after resume with the aim stick still held and the level above 0 emits { on: true }. If the stick was released, the saw winds down silently.
- Sower roam (enemies/sower.ts): orbits the edge for a hashed 12 to 18 s (hash01 of level seed, spawn index, loop; no PRNG). Then it steers at 2.5 rad/s to within 150 u of the centre, heads back to the nearest wall and resumes its orbit. Inward turns are at least 20 s apart. It keeps sowing throughout. An inward leg blocked for 12 s gives up and heads out. The spawn index is stored in w.a (unused by Sowers before this).

## Files touched
src/game/weapons.ts, src/game/combat.ts, src/game/game.ts, src/game/enemies/sower.ts, tests/game/weaponCombine.test.ts (GW1 stretch tests rewritten for the bar), tests/game/orbitBar.test.ts (new), tests/game/sowerRoam.test.ts (new).

## Tests added
- orbitBar.test.ts, 14 tests: profile shape, slope, tip reach, spike length, unit tangent, ramp, bar follows aim with counter rotation, chain run round the tip, swept capsule (no tunnelling), determinism, pause and resume sim:saw (3).
- sowerRoam.test.ts, 7 tests: edge timing, phase rules, centre reach plus loop length plus smooth steering (rect), return to edge, circle arena, sowing on the way, determinism.

## Test and build
npm test: 3367 passed, 1 failed (the accepted generator perf test "200 levels under 350 ms" in this VM). npm run build: pass. The pixi v7 grep is clean. tests/qa untouched and passing.

## Risks
- The bar sweep is long (up to about 80 u per step at the tip), so the saw now cuts a fan in front of the ship. Check feel and how fast it kills.
- Sowers in rectObstacles arenas may hug an obstacle on the way out and orbit it instead of the wall.

## Contracts for other roles
- Glow: orbit spike vx, vy are now a unit tangent. Please retune src/render/spikeSaw.ts SPIKE_MAX from 60 to weapons SAW_SPIKE_MAX (40), and switch tests/render/spikeSaw.test.ts off SPIKE_STRETCH. I kept SPIKE_STRETCH exported only so that test still passes. The ghost smear rotates round the ship, which may look off on the bar.
- Chorus: sim:saw off on pause, on again on the first held step after resume. Event shape unchanged.

## Device check for Ryan
1. Pick up orbit and hold the aim stick to the right. Within a quarter second the spikes swing out into a long bar pointing right, reaching about three ship lengths. They race out along one edge, round the tip and back along the other.
2. Sweep the aim slowly round. The bar follows, and enemies anywhere along it are cut. Release and it folds back into two rings.
3. Hold the aim and press pause. The saw growl stops. Resume still holding: it growls again. Resume without holding: silence.
4. On a level with Sowers, watch one for about 40 s. It circles the edge, then curves into the middle, turns back to a wall and circles again, dropping mines all the way.
