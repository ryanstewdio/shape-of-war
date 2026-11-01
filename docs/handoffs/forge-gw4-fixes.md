# Hand-off forge: gw4-fixes

Branch: feat/forge-gw4-fixes. Session: https://claude.ai/code/session_018Gwqi5MLB2Q3MTnvfcarhw

## What changed
- Sower roam, root cause: in real play the roam did run, but the GW3 gate (20 s since spawn, `LOOP_MIN_SEC`) put the first dive at 20.6 s every time, long after the player kills a Sower. Secondary causes found on real levels: the attack drone shoots a Sower once it dives within 450 u, wells pull a diving Sower off course or trap it on the way out, and in obstacle arenas a dive could jam on an obstacle corner and give up.
- New schedule (hashed with `hash01`, no PRNG): first dive 6 to 10 s after the first live step, then 14 to 20 s after the previous dive, with at least 2 s back on the edge (`diveGapSeconds`, `FIRST_DIVE_*`, `DIVE_GAP_*`, `EDGE_MIN_SEC`). The first dive no longer needs wall contact.
- Inward leg runs at 1.35x speed (`DIVE_SPEED_MUL`). When it presses into an obstacle it slides along it toward the shorter way round (`slideSide` look-ahead), and holds that side until clear (`inwardHeading`).
- Wells do not pull a Sower while it is off the edge (in or out): `isRoaming` added to `pullExempt`, the same rule as a dashing Charger. Feeding on core contact is unchanged.
- Reset: `resetWellState(w)` in wellArrival.ts removes every well (telegraphs too) and nova snake and resets wellIds, wellCount, wellAge, wellNova, wellOrd, wellSnakeT, snakeWell, wellArrivals, wellArriveAt and wellArriving. `createGame` calls it before `spawnWells`. Start, Restart, Retry and Next all build a fresh world (main.ts `startLevel`), so the wave clock, and with it the arrival clock, starts from 0.
- Saw: a new game sends `pauseSaw` to the previous game, so a saw left sounding (for example a Retry from results, which has no pause first) emits `sim:saw` { on: false }.

## Files touched
src/game/enemies/sower.ts, src/game/enemies/gravitywell.ts, src/game/wellArrival.ts, src/game/game.ts, tests/game/sowerRoam.test.ts, tests/game/sowerRoamReal.test.ts (new), tests/game/wellReset.test.ts (new).

## Tests
- sowerRoamReal.test.ts (13 tests): 12 real V2 levels with Sowers (rect, roundRect, circle, hexagon, rectObstacles), using the real `stepGame`, an idle invulnerable ship and a collect drone that never fires. Every Sower that lives 20 s reaches within 150 u of the centre within 20 s of spawning, and every Sower that lives 15 s after that returns to the edge. Sowers eaten by a well first are skipped, because that is real play.
- sowerRoam.test.ts (9): dive gap ranges, phase rules, slide side, first dive timing, loop gaps, pull exemption.
- wellReset.test.ts (4): runs a real level until an arrived well and a nova exist, then restarts. Afterwards only the spec wells remain, nothing is pending, wave clock is 0, and the first arrival comes again at the same wave time. Also: `resetWellState` on a running world, on a telegraphing arrival, and the saw silence.
- npm test: 249 files, 3514 passed, 1 todo. One unidentified test failed on the first full run and passed on the rerun (likely the known VM perf flake). npm run build: pass. The pixi grep prints nothing. No changes under tests/qa.

## Risks
- Gameplay: Sowers now rush the centre (where the ship often is) 6 to 10 s in, at 1.35x speed, and wells no longer pull them during a dive.
- In a 40-level sweep, 1 Sower missed the 20 s bar: it reached at 21.6 s after a late dive hidden behind a 480 u wall. The committed 12-level sample passes.
- Before its first step, `roamPhase` of a reused id reports the old Sower's phase. Render does not read it.

## Contracts for other roles (Requests)
- Glow (render): "old wells remain" on device is very likely render state. In renderer.ts, `setArena` never calls `resetNovaState(nova)`. A restart rebuilds the same spec wells at the same entity ids, so `novaSlotFor` matches the old nova slot and the supernova whirlpool snaps back onto the fresh well. Please call `resetNovaState(nova)` in `setArena`, next to `resetArriveState`. Restart, Retry and Next emit no bus event (only the menu emits `game:start`). The signal is main.ts `startLevel`, which calls `renderer.setArena(level)` on every start, restart, retry and next.
- Chorus: no change needed. A carried-over saw now gets `sim:saw` { on: false } when the next game is created.

## Device check for Ryan
1. Play a level from 31 up with Sowers. Do not shoot the first Sower you see: between about 6 and 10 seconds after it appears it should turn off the wall, rush toward the middle, then go back to the wall and orbit. It should rush in again roughly every 14 to 20 seconds.
2. In a level with a gravity well, wait until a second well arrives and a well has gone supernova (whirlpool). Pause and tap Restart. Only the level's starting wells should show, calm and small. No whirlpool and no extra well, and no new well should arrive for at least 20 seconds. Do the same with Retry from the results screen. If a whirlpool still shows after restart, that is the Glow request above.
