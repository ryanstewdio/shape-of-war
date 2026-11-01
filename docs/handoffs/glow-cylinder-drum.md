# Hand-off Glow: cylinder-drum (D13 phase C1)

Branch: feat/glow-cylinder-drum. Session: https://claude.ai/code/session_018Gwqi5LFgpwvu9Yno47cd5

## What changed
- `src/render/drum.ts` (new, pure): camU follow (tau 0.12 s, short way through wrapDelta), phi = 2 pi (u - camU) / W, screen x = rs sin phi with rs = W / 2 (FACE_FILL, front face fills the width), depth rs (1 - cos phi) fed as negative lift into the tilt projection through an always on camera (perspective at tilt off, the tilt setting leans the drum). Back half: BACK_ALPHA 0.25, mirrored. Also interpWrap, unwrapNear, drumAffineAt, drumProjectNodes (lattice, with front or back texel), ringArcs (rims and rings, camera invariant), fitDrum, drumULines, drumRectSegs.
- `tiltScene.ts`: `projectDrum(drum)` walks the same lists: billboards and particles get position, depth scale, alpha (particles through the packed colour), mirror (x scale sign, rotation negated); free form Graphics get the drum linearised at their centre. Static vertex layers (bullets, trails, dust) are flagged for upload on project and restore. Bit exact restore.
- `latticeView.ts`: `setDrum`. Each frame writes and projects every node through the drum; a 2 texel glass texture plus per node u draws the back half at 25 percent in the same meshes. The rows close into rings (the -W/2 and +W/2 ends coincide).
- `grid.ts`: `drawDrumWalls` (rims as glowing ellipses, back arcs dimmed), `drawDrumGrid` (low tier).
- `renderer.ts`: drum on `def.surface === 'cylinder'` (setArena; tilt changes swap its camera). Fit from the drum bounds. Rims replace the walls. Obstacles drawn as sampled projected outlines per frame. Every x interpolation goes through `ix` (wrap aware on a cylinder, plain interp on flat). Comet ribbon and nova snake body are unwrapped next to their previous point, so no segment crosses the seam the long way. Before render: drum pass, else tilt pass, else plain render. Flat levels take the old path.

## Tests
- tests/render/drum.test.ts: 20 (phi mapping, front centre, edges, back alpha and mirror, continuity round the seam, follow tau and short way across the seam, trail across the seam has no long segment, flat interp bit identical on a recorded frame, nodes and texels, rims, fit, u lines, linearisation, obstacle segments).
- tests/render/drumScene.test.ts: 5 (front and back billboards, particles with packed colour alpha, free form across the seam, recorded frame unchanged by the off pass and by 200 drum frames, scaleColourAlpha).
- npm test: 270 files, 3814 passed, 1 todo, 1 failed: the accepted generator perf test ("200 levels under 350 ms", 466 ms in this VM). npm run build: exit 0. Pixi v7 grep is clean. tests/qa untouched.

## Risks
- FACE_FILL 1 (per the brief) shows the front centre at pi screen units per u horizontally and 1 per u vertically, so horizontal motion reads about 3x faster than vertical. If it feels wrong, lower FACE_FILL in drum.ts.
- Back half objects dim and mirror but keep their layer order. A back enemy can draw over a front bullet, at 25 percent alpha.
- Lattice heat glow and the comet ribbon do not dim on the back half. Large free form layers (shock rings, enemy fx lines) use one linearisation each, so they are approximate far from the front.
- Per frame Graphics rebuilds only on cylinder levels: obstacle outlines (when there are obstacles) and the low tier grid. The Standard tier lattice path allocates nothing per frame. Device fps still needs checking on a cylinder level with obstacles.
- The comet's unwrapped u keeps growing while the ship circles. Float32 precision is fine for hundreds of laps.

## Contracts for other roles
- None changed. Renderer reads `LevelDef.surface` only. Input is untouched (screen right is plus u at the front).

## Device check for Ryan
1. Settings: effects Standard, tilt off. Level select, typed seed 42, level 16 (a cylinder, no obstacles). You should see a glowing drum: an ellipse rim at top and bottom, and the grid wrapping round with vertical lines that squeeze together toward the left and right edges.
2. Fly right and keep going. The ship stays near the middle while the drum turns under it. After a full lap you are back where you started, with no jump or long streak when you cross the seam. Enemies on the far side show faint and small through the glass, and they move the opposite way.
3. Play seed 42 level 17 (obstacles). The obstacle bars bend round the drum and fade when they go behind.
4. Set tilt to high and replay level 16. The drum leans back and everything still lines up.
5. Play any flat level and one boss fight. They should look exactly as before, with the Standard tier boss fight at 58 fps or better. Tell me the lowest fps you see on level 17.
