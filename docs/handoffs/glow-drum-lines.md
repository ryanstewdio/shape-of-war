# Hand off: glow drum-lines (G10)

Branch feat/glow-drum-lines. Session: https://claude.ai/code/session_018Gwqi6PBKs3nLd18Xs5PXq

## What changed
- Cause of the orange lane bug, confirmed: the Charger lane, its chevrons and the dash streak were drawn into enemyFx, and the drum pass mapped that whole Graphics with one transform linearised at the centre of its bounds. As the drum turned the bounds centre moved, so the lanes slid off the drum and swung around.
- drumPen.ts gains traces. A line on the surface is sampled every 24 u (DRUM_SAMPLE_U) from its start along its direction, and each sample goes through drumProject as its own owner. A segment between two points uses the short wrapped delta (surface.delta on a cylinder). It is stroked as front runs at full alpha and back runs at BACK_ALPHA. Back runs are skipped when they would show below 5 percent (BACK_CULL_A), and widths follow the depth of each run. Off the drum a trace is just its two end points, so flat and tilted levels draw what they drew before.
- Moved onto the drum: Charger lane band, rails, centre line, end bar, chevrons (3 surface points each) and dash streak (sampled from the Charger). Shock rings: a circle sampled on the surface round its centre, with a multiple of 4 samples so it is symmetric about its owner. Wall flashes: segments and arcs sampled along the wall. Pops, Blink destination rings and Slime drop rings attach to their owner. Drone glyphs and the drone mode ring round the ship attach to their drone or the ship. Tempestling swirl arcs and leading edge attach to each Tempestling. The boss under and over layers (halo, shell, Bulwark white hexagon, cracks, flashes, pieces) take the boss body's billboard transform (penOwnerMatrix).
- Linearised path: no free form layer the renderer draws uses it on the drum now. All 12 free form Graphics are in drumDrawn, and a test enforces that. Deflect arcs, hit flashes and the other pulses are particles, so they already project one by one. drumFree in tiltScene stays only for unmarked layers. The layers that are provably local are the boss layers: they are drawn around one owner, under one exact billboard transform, not a linearisation.
- Perf: obstacle outlines are cached per camera u bucket (DRUM_CAM_BUCKET_U 0.25 u, about 1 px at the front). All obstacles go into one front list and one back list, so each wall pass is one stroke. Faint back passes are culled, and the stroke style is a reused scratch object. The low tier drum grid redraws only when its bucket changes.

## Proxy numbers (vitest, headless, CPU side; tessellation not included)
- Obstacle path: 12 obstacles, 600 frames (4 s flying, then hovering). Before: 0.37 to 0.83 ms per frame, 1824 path commands, 56 strokes. After: 0.12 to 0.23 ms per frame, 716 path commands, 3.1 strokes. It rebuilds on 269 of 600 frames and never while hovering. Path commands are what the GPU side has to tessellate.
- New cost: 6 lanes plus 8 shock rings sampled on the drum add 0.28 ms per frame in the proxy.

## Files
src/render/drumPen.ts, src/render/drum.ts (drumRectSegsInto, drumCamBucket), src/render/renderer.ts, src/render/tiltScene.ts (comment only), tests/render/drumLines.test.ts (new, 20 tests), tests/render/glowCylinder.test.ts (drumDrawn source match widened).

## Tests and build
npm test: 3926 passed, 1 failed. The failure is the accepted levelgen perf test "200 levels under 350 ms" (420 ms in this VM). npm run build: pass. The v7 grep prints nothing. tests/qa is untouched. No events touched.

## Risks
- Sampled lanes and rings add triangles to tessellate on the drum: about 26 samples per lane line, and up to 96 per ring. Device fps still needs checking.
- The boss layers follow body 0, so a far apart Twins survivor's flare uses body 0's depth (only matters if a boss appears on a cylinder).
- Shock rings now look 3 times wider than tall at the front, because the drum stretches u. That is correct for a ring on the surface.

## Contracts for other roles
None changed. New exports in drumPen.ts (trace API, penOwnerMatrix) and drum.ts (drumRectSegsInto, drumCamBucket, DRUM_CAM_BUCKET_U).

## Device check for Ryan
1. Open cylinder level 17 on Standard. Wait for a Charger to show its orange attack path, then steer so the drum turns. The path should stay painted on the drum, bend round it, follow it as it turns and fade on the back. It should never fly off in other directions. Let it charge: it should run along the path.
2. Kill things near the edge of the drum. The white shock rings should stay centred on the kill and wrap round the drum.
3. With a drone mode armed, the glyph should sit above each drone and the ring should stay round the ship as the drum turns.
4. Let the nova go off on level 17 and watch the fps readout. Note the lowest value (target 58 to 59).
5. Play one flat level with tilt off and one with tilt on. Lanes, rings and flashes should look exactly as before.
