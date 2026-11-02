# Hand off: foundry drum-maps

Branch `feat/foundry-drum-maps` from main 8d5c989. Session: https://claude.ai/code/session_018Gwqi6dN7CFqqa7nDn8uoy

## What changed
- Cylinder levels now pick one of four drum layouts from the surface stream (the draw after the cylinder chance): open 30, rings 25, pillars 25, narrow 20. Only existing axis aligned bars are used. There is no new entity, no sim change and no LevelDef field change.
- open: the C0 drum, byte identical to main. narrow: rect, width the least multiple of 64 at aspect 1 (for example 768 by 760, 960 by 960), no bars. rings: 2 or 3 bars across u (a third only when one side has a 130 u corridor), each with 1 or 2 gaps 160 to 240 u wide, later rings turned a quarter to three quarters round from the last. pillars: 6 to 10 bars 24 by up to 120 on even slots round the drum, rows cycling +a, 0, -a, 0, with middle row pillars inside the spawn clearance left out.
- A bar that would cross the seam is cut at u = W/2 into two pieces (each stays in the canonical range); the sim's wrapped push already treats them as one wall.
- Validator, cylinder levels only: A3 wrapped spawn clearance; A4 up to 10 bars, edge gap from the rims only, every corner inside [-W/2, W/2]; A5 wrapped gap, with seam cut halves exempt; A6 a wrapped flood fill on a 16 u grid (every walkable cell reached plus both rims reached). Flat levels run the old checks unchanged.

## Files touched
src/levelgen/drum.ts (new), src/levelgen/cylinder.ts, src/levelgen/generator.ts, src/levelgen/validate.ts, tests/levelgen/drum.test.ts (new), tests/levelgen/cylinder.test.ts, tests/levelgen/gcTriage.test.ts, this file.

## Tests added
tests/levelgen/drum.test.ts, 15 tests: helpers (seam cut, ring pieces, ring rows, pillar rows, narrow width, wrapped gap, flood fill through a seam gap); validator cases (more than 3 bars, seam crossing bar, rim bar, sealed ring, seam cut pair, close pair across the seam); pattern weights within 1 point over 4000 seeds; every cylinder level 11 to 60 for 500 seeds valid with 0 retries, rims reachable on a 64 u wrapped grid, width a multiple of 64, wells, spawners and bars at legal wrapped distances; flat levels (flag on) and open drums match digests recorded on main; enableCylinder false is all flat and identical; one seed 42 level per pattern pinned.
Pins moved: seed 42 L16 712BC1C1 to F383CDC7 and L17 BCC2F1B8 to F9779FC2 (both now pillars). tests/qa is untouched and passes.

## Test and build
npm test: 3921 passed, 1 failed, which is the accepted "200 levels under 350 ms" perf test (449 ms here; main measures 497 to 513 ms in this VM, so no slowdown). npm run build: pass. The v7 API grep prints nothing.

## Risks
- Cylinder levels that are not open drums get new hashes under the same GENERATOR_VERSION_V4. Any saved best or HUD hash for those levels from wave 10 no longer matches. Fable may want a version bump.
- The renderer draws a short end cap where a seam cut bar meets the seam (two outlines touching). This is visual only.
- Narrow corridors: a 3 ring layout can leave about 96 u between two rings on one side.

## Contracts for other roles
- New exports: `drumPatternFor(seed, levelIndex, cfg)` (generator.ts), `DrumPattern`, `DRUM_PATTERNS` (drum.ts), `cylObstacleGap`, `seamJoined`, `drumFlood`, `drumConnected`, `CYLINDER_MAX_OBSTACLES` (cylinder.ts).
- Glow and Swarm: on cylinder levels, expect up to 10 obstacles and a bar edge exactly on x = +W/2 or -W/2. No events change.

## Device check for Ryan
1. In a browser tab open the game URL with `?seed=42&level=12`. The HUD hash should end `#8FCFD3FB`. Expect two rings of bars round the drum. Fly from the middle to a rim and you have to go sideways to find a gap.
2. Open `?seed=42&level=16`, hash `#F383CDC7`. Expect staggered short pillars all round. Flying straight round the drum, you keep weaving.
3. Open `?seed=42&level=27`, hash `#0D7137CC`. Expect a narrow, empty drum. Enemies wrap round and reach you from both sides quickly.
4. Open `?seed=42&level=18`, hash `#FD31D371`. This is the open drum, as it plays today.
5. In each one, confirm you can reach both rims and the frame rate in a busy wave holds the Standard budget.
