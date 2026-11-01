# Hand-off Glow: tilt (V3-G, G0 and G1 in one session)

Branch `feat/glow-tilt`. Session: https://claude.ai/code/session_018Gwqi5vZgTAzmtKExuVCCL

## Route (G0)
Route A, CPU projection. `PerspectiveMesh` (8.22.0) is a `Mesh<PerspectivePlaneGeometry>` with `setCorners(x0..y3)` over a subdivided plane, so it could show a `RenderTexture` of the arena layers. That costs one extra full screen pass per frame, and the bilinear resample blurs the 1 device px lattice lines and loses MSAA on the walls. Route A keeps every shape crisp and adds no pass.

## What changed
- `project.ts` (new): pure `makeCamera`, `cameraFor`, `project(x, y, z, cam, out)`, `projectNodes`, `affineAt`, `projectedBounds`, `fitProjected`, `parseTiltKnob`. D = 2.5 x arena height, denominator floored at 0.1 D. The docs/12 formula is in y up axes, so I flipped the depth sign to keep the far wall at the top, smaller and higher.
- `lattice/sim.ts`: z channel (`zOn`, `uz`, `pz`, `maxZ` = 1.5 x the in plane clamp, `setZEnabled`, `writeLift`, `maxLift`, `zForceProfile`). Kills and ring fronts kick it up, wells pull a funnel down (deepest at the centre), pushing forces lift it. It uses the same springs, anchor, damping and sleep. While off it is never touched, and the in plane field is bit identical to main.
- `latticeView.ts`: `setCamera(cam | null)`. Each frame of written nodes is projected in place before the one upload. No Graphics, no clear, no allocation.
- `tiltGeom.ts` (new) and `grid.ts`: walls, obstacles and the low tier grid are redrawn projected, only on a tilt, arena, resize or neon change.
- `tiltScene.ts` (new): project before `app.render()`, restore right after. Billboards (entities, floor, glow sprites, Prism layer, whirlpool quads) are moved and scaled by depth, not rotated. Particle layers (bullets, trails, sparks, pulses, dust, boss hazards, enemy bullets, cue) are moved, and scaled where vertex data is dynamic. Free form Graphics (rings, enemy fx, wall flashes, saw, nova, storm, drone glyphs, boss under and over) are linearised at their bounds centre. Saves go into one Float64Array that only grows.
- `renderer.ts`: polls `getTilt()` each draw. Off calls plain `app.render()`, the v3 path. On, the fit comes from the projected bounds, the comet ribbon is projected in place, then the scene pass runs. A `?tilt=low|high` URL knob calls `setTilt` at boot.

## Tests added (all pass)
project.test.ts 21 (identity, known points at 12 and 22 deg, far and near, monotonic depth, no NaN at extremes, fit for 1600 x 1000 and 1800 x 1100 on cover and main at low and high, timing proxy). lattice/tiltZ.test.ts 10 (rest, kill decay, funnel, ripple, bounded over 20 s of fuzzed impulses, off equals a frame recorded from main's sim). tiltScene.test.ts 5. tiltGeom.test.ts 3.

## Results
- npm test: 3593 pass, 1 fail. The fail is the accepted "200 levels under 350 ms" perf test (358 ms in this VM). npm run build: pass. The v7 grep prints nothing.
- Timing proxy: projectNodes on 8192 nodes takes 0.035 ms per frame (node). Headless Chromium stress(400, 2000) at 4x CPU throttle: 3.2 to 3.3 fps at off, low and high, no errors. That browser renders GL in software, so the fps only says tilt adds no measurable cost.

## Risks and known gaps
- Free form Graphics are exact at their bounds centre. When one Graphics holds effects far apart (two charger lanes, wall flashes on opposite walls), each piece can be off by up to tens of units at high.
- Bullets, trails and dust are moved but not depth scaled (static vertex upload). The low tier grid loses its ripple bend while tilted.
- Lattice line alpha is not scaled by depth (allowed, not needed). applyNeon is untouched.
- The cloud session had no `add_repo` tool, so the push may fail.

## Contracts for other roles
- Ledger: call `setTilt(level)` from `sow.settings.tilt` at boot and on change. The renderer picks it up on the next draw. A boot `setTilt('off')` overrides the `?tilt` knob. hudFrame's `fitArena` safe rect still holds: the projected fit stays inside the same rect.
- Fable: the cheatsheet section 16 text is in the session hand-off message.

## Device check for Ryan
1. Open the game with `?tilt=high` added to the address, start Endless. The far (top) wall is narrower than the near wall and the grid meets the walls.
2. Kill enemies: the grid bumps up and ripples. Near a gravity well it sinks into a funnel. A bomb sends a wave out through the grid.
3. Fold and unfold: the whole arena stays on screen on both screens, and the sticks and buttons are not tilted.
4. Repeat with `?tilt=low`, then with no knob, which must look exactly as before.
5. In a boss fight at high, the lowest fps should stay at 58 to 59.
