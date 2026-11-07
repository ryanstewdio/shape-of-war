# Hand-off forge: ripple
Branch: feat/forge-ripple. New src/game/pondRipple.ts; World.pond (createWorld); stepGame calls stepPond right after stepWorld.
Schedule: LevelDef.ripples (sorted) on the wave clock; 'sim:rippleWarn' at atSec minus RIPPLE_WARN_SEC (inSec RIPPLE_WARN_SEC), 'sim:ripple' at atSec. Wave age runs on w.time.
Push: outward, SHIP_PUSH (SHIP_SPEED / 4) for the ship, ENEMY_PUSH (double) for moving enemies, x strength x triangular band falloff (POND_WAVE_WIDTH) x linear age fade x driftScale. Waves stack, up to 8 live.
Immune: bosses, boss parts and hazards, wells, spawners, geoms, pickups, drones, snake bodies, mines, slime, telegraphing spawns. Every push goes through confineOn or membraneMove, so walls block.
Off: no ripples, Free Play and Endless (pond inactive, stepPond never runs), so those stay bit identical.
Tests: tests/game/pondRipple.test.ts (17): profile, warn and start timing, direction, falloff, strength and difficulty scale, boss immunity, walls, stacking, absent, Free Play and Endless off, determinism.
npm test: 4790 pass, 1 fail (generator perf budget, accepted exception). npm run build: pass. Grep: clean.
Device: play an Adventure level whose LevelDef has ripples (after Foundry lands), idle near a ripple centre and watch the ship drift outward as the ring passes.
Dependencies requested: none. Requests: none.
Known gaps: no 'sfx' cue is emitted from the sim (Chorus keys the sound off sim:rippleWarn and sim:ripple). Waves freeze nothing during a respawn pause, but new ripples wait for the wave clock.
