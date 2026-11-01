# Hand off: forge gw2-wells

Branch feat/forge-gw2-wells. Session https://claude.ai/code/session_018Gwqi4zjgDWKLH3GDGT7Pz

## What changed
- Nova snakes. Diagnosis: in real generated levels (V2 and default config, idle and scripted firing ships, 200 levels) every due emergence spawned: 879 of 879, none blocked by snake slots, maxLiveEnemies or the pool, so no slot reservation was added. Fixed the real quirk: when a well died, wellAge and wellNova stayed in their slots while wellIds compacted. A novaing well that moved down a slot lost its nova and stopped releasing snakes (multi well levels where one well is shot or explodes first), or a young well inherited a nova. All per slot arrays now compact together, and the nova time is keyed by a new per slot ordinal (wellOrd), not the slot index. Other likely device causes are in Risks.
- Wells over time (src/game/wellArrival.ts, stepWellArrivals before stepWells). Levels whose spec has a well get arrivals: first at 20 to 30 s, then every 25 to 35 s on the wave clock, hashed with hash01 from the level seed and arrival index. Position is hashed: at least 300 u from the ship, 250 u from other wells, inside a 120 u arena margin. Caps: spec plus 2, at most 4 (MAX_WELLS 3 to 4); wells plus boss hazards plus hazard spawners under 8. A due arrival at a cap or with no spot is skipped. Held (waits) while a boss is alive, during respawn, after the level ends; never in Endless. The well entity is created at telegraph start with tele 1.5 (harmless, untargetable, skipped by stepWells) and goes live 1.5 s later. If the ship is within core radius plus 70 u then, the spot is re-hashed (same rules) and the well moves, or the arrival is cancelled.
- Orbit feel. 'sim:saw' { on: true } when the saw level leaves 0, { on: false } when it returns to 0 (also on weapon loss). Saw level above 0.5: every spike hit deals 1 then 2 alternately (1.5x mean, HP is Int16) and rests 0.7x the shield cooldown. Boss body hits are unchanged (boss rule 8 cooldown, BOSS_DAMAGE.orbit).

## Files touched
src/game/state.ts, remove.ts, enemies/gravitywell.ts (addWell, ordinal nova, telegraph skip), wellArrival.ts (new), game.ts, weapons.ts, combat.ts; tests/game/weaponCombine.test.ts (saw damage expectation now 1.5x).

## Tests added
wellSnakesReal.test.ts 15 (12 real generated levels: snake live at nova plus 4 s; 2 compaction tests that fail on main). wellArrival.test.ts 12 (schedule, caps, spacing, hazard cap, real boss level, respawn, Endless, ship on the telegraph, determinism with Math.random throwing). orbitSaw.test.ts 6.

## Results
npm test: 3290 pass, 1 fail (accepted: generator "200 levels under 350 ms" in this VM). tests/qa snapshots unchanged (no generator change). npm run build: exit 0. v7 grep: empty.

## Risks
- Snakes may still be missed on device for reasons outside the sim: a player aiming at a well kills it in about 3.5 s (bullets near it are pulled into the core), before its 5 to 7 s nova; a ship death clears live snakes; the snake emerges under the nova visual and looks like a normal cyan snake. Glow may want a distinct nova snake look or draw order.
- Arrivals add sim entities over time on long levels (up to 4 wells, up to 8 nova snakes); no per frame allocation added.
- An arriving well can be bombed during its telegraph (resetWell, harmless).

## Contracts for other roles
- sim:wellArrive { id, x, y, inSec: 1.5 } at telegraph start; id is the real well entity, telegraphing (isTelegraphing true) until live. Glow: draw it as a telegraph, lattice dimple already skips telegraphs. Chorus: arrival cue.
- sim:saw { on } edges as above; payload object reused.
- MAX_WELLS in src/game/state.ts is now 4. src/render/lattice/kicks.ts has its own MAX_WELLS 3: Glow should raise it to 4 or the fourth well gets no dimple.

## Device check for Ryan
1. Play a level that starts with a well; do not shoot the well. About 3 to 4 s after it erupts a cyan snake should crawl out of its centre.
2. Keep playing past 20 to 30 s: a new well should flash in (telegraph) away from you and turn solid 1.5 s later, then roughly every 30 s more, never more than 4 at once, none during a boss.
3. Pick up orbit, hold the aim stick: the spikes stretch and should now chew through enemies clearly faster; release and they return to normal.
