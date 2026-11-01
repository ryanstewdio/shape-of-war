# Glow hand-off: tilt-depth

Branch feat/glow-tilt-depth. Session https://claude.ai/code/session_018Gwqi46vUgc5Wm8afH5R5f

## What changed
- Lower angles: TILT_DEG low 7, high 13 (from 12 and 22); setting names unchanged. The fit already used the projected bounds, so the whole arena still fits (tests at both levels, every arena shape, wall lip included).
- 3D rounding (tilt on, flat levels): every entity view (ship, enemies, boss bodies and parts, pickups, drones, the well's white core, snake segments) gets a volume from its slot outline: an extruded copy 0.25 of the drawn radius down the screen at high (sin T scaled, so about 0.54 of that at low), side faces in two bands (upper alpha 0.16, base 0.07), vertex edges at 0.4 above and 0.22 below, base outline at 0.22, and a lighter thin stroke on the edges facing up. Round shapes (circles, the well core, Splime and other near round outlines) get tangent edges, a rim ellipse and a top highlight arc. Colours are the body colour lifted to at least 30 percent HSL lightness; darker means lower alpha, never black. Two Graphics in `lines` (volumeUnder below the entities, volumeOver above), drawn already projected, not in the tilt scene pass. Bullets and particles stay flat. Off and the drum never draw a volume: both layers are cleared once and hidden.
- Walls and obstacles under tilt: a raised lip (14 u toward the viewer) with a top edge at 0.8 of the wall alpha and posts at the corners at 0.4 (eight posts on smooth outlines). Built on tilt, arena or neon change only.
- Lattice: farther lines fade to 0.7 alpha at the far wall at high (less at low) through a two texel fade texture and a per node u, written once per camera change, never per frame. The z lift gains rise 1 to 1.3 (kick), 0.5 to 0.65 (force), and the clamp 1.5 to 1.8 of the in plane clamp.
- Nova snake glints (G6 item j): I could not reproduce the miss in node. The pure tracking matched every nova snake on 12 real levels. The live path was still fragile: a snake only counted as a nova snake if the renderer matched its head to the spawn event within 90 u and 0.25 s, and a miss lasted the snake's whole life. Now novaSnakeSync rebuilds the tracked set every frame from the sim's ownership table (snakeHead plus snakeWell, read only). The body and the glint draw list are pure functions (novaSnakeLive.ts), and the glints paint on their own Graphics just above the entity views, so a body view created later cannot cover them. The emergence burst and trail still use the event.

## Files
src/render/project.ts, tilt.ts, renderer.ts, grid.ts, tiltGeom.ts, latticeView.ts, lattice/sim.ts; new src/render/volume.ts, volumeView.ts, novaSnakeLive.ts, lattice/depthFade.ts.

## Tests
New: tests/render/volume.test.ts (13), tiltDepth.test.ts (12), novaSnakeLive.test.ts (8, real game step on 6 generated well levels, glint list non empty on every frame of every nova snake, with resets between frames and no bus subscription), lattice/depthFade.test.ts (5). Updated: project.test.ts (angles), novaSnake.test.ts and novaRibbon.test.ts (wiring now points at the live module).
npm test: 3888 passed, 1 failed (the accepted VM perf test "200 levels under 350 ms" in tests/levelgen/generator.test.ts), 1 todo. npm run build: pass. v7 shim grep: empty. tests/qa snapshots unchanged.

## Risks
- Frame cost, not measured on device. Each volume adds about 8 Graphics instructions (4 fills, 3 strokes under, 1 over), rebuilt every tilted frame. A boss fight with 40 to 60 shapes is about 400 instructions to tessellate. My estimate is 1.5 to 3 ms CPU on the Fold at high, enough to put the 58 to 59 floor at risk. Knobs if it dips: VOLUME_MAX (120) in volume.ts, or drop the face fills in volumeView.ts (about half the cost).
- The glint fix is not confirmed on device. If glints are still missing with the tracked set fixed, the next suspect is size and contrast (7 u stars, no bloom).
- Snake segments each get a volume (13 per snake), so busy snake waves are the heaviest case after bosses.

## Contracts
No event, store or setting changes. Glow reads gs(w).snakeHead, snakeWell and snakeSegs, read only. TILT_DEG values changed; ledger's labels for the setting are unaffected.

## Device check for Ryan
1. Settings, Tilt High. Start any level. The far wall should still be narrower, but the angle is gentler than before. The whole arena should be visible with a thin raised lip on the walls and obstacles.
2. Look at the ship and the enemies. Each should look like a short glowing solid: a faint side and base below the bright outline, a lighter edge on top, rims on round ones. Bullets and sparks stay flat.
3. The grid lines near the top should be a little fainter than near the bottom, and kills should lift the grid a bit more than before.
4. Tilt Low: the same effect, softer. Tilt Off: the game must look exactly like it did before tilt.
5. Play a level with a gravity well until it erupts and a snake crawls out. Prismatic star glints should circle the snake and trail back along it for its whole life, with a stream from the whirlpool while it is near.
6. Boss fight at High: watch the fps readout. The lowest should stay at 58 to 59. Report the lowest you see.
