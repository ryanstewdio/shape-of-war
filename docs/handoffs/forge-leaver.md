# HAND-OFF forge: leaver
Branch: feat/forge-leaver  Head: see the commit that adds this file
Files changed: src/levelgen/ (leaver.ts new, leveldef.ts, generator.ts, v2enemies.ts, validate.ts); src/game/ (enemies/leaver.ts new, world.ts, defs.ts, state.ts, combat.ts, scoring.ts, presence.ts, membrane.ts, game.ts, wellArrival.ts, bosses/kit.ts, bosses/core.ts); src/render/ (leaverLook.ts new, shapeSpecs.ts, renderer.ts); src/audio/music/ (kills.ts, layers.ts); src/ui/enemyIntro.ts; tests (below)
Tests added: tests/game/leaver.test.ts 14 (tables, Weaver movement, 2 hp, split count and colours, 40 u fling and 0.5 s hold, hashed angles, 1.06 speed ratio, live cap, determinism, shard score, enrage, drum seam chase); tests/game/leaverRequests.test.ts 7 (Free Play arrivals, 'many' gap scale, wells off; lane, ring, sweep, tether across the seam; flat bit identical); tests/levelgen/leaver.test.ts 10 (gates, no Leaver before 21 or segment 6, unchanged hash when none gained, legacy configs, device level); tests/render/leaverLook.test.ts 6; tests/audio/music/leaverSound.test.ts 3; tests/ui/enemyIntro.test.ts +1 ("Leaver, splitter")
npm test: 4570+ pass, 1 fail: generator.test.ts "200 levels under 500 ms" (the accepted perf exception, fails on main too: 792 ms there)  npm run build: pass

## What it does
- Leaver: Kind.Leaver and Kind.LeaverShard appended after DroneTwin. Moves with weaver.step, 2 hp, scores 100. A scored kill releases up to 6 shards (yellow, green, red twice) flung 40 u at hashed angles (hash01 of id and tick), still until 0.5 s, then seekShip (decoy aware, seam aware) at 1.06 x 190 u/s. Shards: 1 hp, 25 points, no geoms, no destroy count, count against maxLiveEnemies; extras are dropped. Bomb or well removal does not split.
- Generator: own stage on stream "LEAV" after the v2 stage. Adventure from level 21, Endless from segment 6 (3 min). Join chance 0.6. Each group then swaps with chance weight / (roster sum + weight), using the Weaver's weight (20 band 3, 18 band 4), and keeps its head count, so the dead air rules hold. A level that gains no Leaver is byte identical. New GenConfig.enableLeaver: on in the default, off in V1 to V6. The roster may hold 7 kinds with the Leaver (R1 allows that). Free Play toggle: FREE_PLAY_ENEMY_KINDS now has 13 entries, because the Leaver is in V2_ENEMY_KINDS. The v2 stage now draws from V2_STAGE_KINDS, unchanged from before.
- Look: three baked outline layers (yellow square, green frame at 40 degrees, red core). The view spins slowly and the frame counter rotates via 24 baked frame slots. Shards are solid squares, tinted per colour, with a hue shimmer toward a nearby palette key plus an alpha and glow flicker. Checked in a browser on flat, tilt and drum.
- Sound: new 'shatter' timbre. The kill is always a 3 note arpeggio at full loudness. Layer entry: motif, phrase, register 4. Shards are sfx only.
- Requests: Free Play wells arrive (gs.arrivalGapScale from applyFreePlay; 'many' x0.5 gaps). Plain Endless still has none. Boss hazards use kit.hazardHitsOn(surface, ...), which is bit identical on flat.

## Pins that moved
Adventure: gcTriage seed 42 L31 (gains Leavers, now DDB938BA). Endless: r2bosses segment pin (now 35194387; leaver off still 4833a515). Free Play fpLevel goldens: the catalogue lists the Leaver and segments from 6 move; with the Leaver off they match main. levelSnapshots: no pin moved.

How to verify on device:
1. Open the app with ?dev=1&seed=42&level=22. Expect a flat, survive level with Leavers from the first wave (about 2.5 s): yellow square, turning green frame, red core.
2. Shoot one twice. Expect a bright three note break and six small shimmering squares (two each colour) to pop out, hold half a second, then chase a touch faster than a Weaver.
3. Start a new level: the intro card lists "Leaver, splitter".
4. Free Play, wells normal: a new well telegraphs in at 20 to 30 s.

Dependencies requested: none
Requests (changes outside my ownership): Ledger/Glow: src/ui/preview.ts (settings preview) does not show the Leaver. mirage.ts has a lane test that is not seam aware (Mirage never runs on a drum).
Known gaps: Leaver share is about Weaver's, which is many Leavers on band 3 and 4 levels (150 to 250 entries each); tune LEAVER_JOIN_CHANCE if it plays too dense. Lanes or arms longer than half a drum test only the nearest image. add_repo is not available in this cloud session.
