# Hand-off: glow-membrane

Branch: feat/glow-membrane. Role: Glow. Session: https://claude.ai/code/session_018Gwqi32ey1sCEeHcFtwYDe

## What changed
- New pure module `src/render/membrane.ts`: style pick (membrane vs solid), solid and membrane lists, wall colour lift (20 percent), ripple, dash pattern, circle overlap, flash decay.
- `grid.ts`: flat and tilt wall passes skip membrane obstacles.
- `renderer.ts`: drum obstacle outlines skip membrane obstacles; one new `membrane` Graphics redrawn per frame draws each bar through the same map as the walls (flat, tilt camera, or drum projection so it bends).
- Bar look: fill alpha 0.12, dashed outline in the arena wall colour lifted 20 percent, slow ripple along the bar. An enemy overlapping it brightens that stretch of the bar for about 0.35 s.

## Files touched
src/render/membrane.ts, src/render/grid.ts, src/render/renderer.ts, tests/render/membrane.test.ts, docs/handoffs/glow-membrane.md

## Tests added
tests/render/membrane.test.ts, 9 tests (style split, colour lift, ripple bounds, dash, samples, overlap, flash).

## Test and build
See the final status in the session message. Perf test "200 levels under 350 ms" may fail in this VM.

## Risks
- Renderer is not exercised headlessly: the membrane draw is verified by typecheck and build only.
- Per frame loop over entity slots per membrane bar (cheap, no allocation). Scratch buffers are fixed size (up to 48 samples).
- Back half of the drum draws at BACK_ALPHA by each sample, not split like solid walls.
- The v1 grid still clips around membrane bars (gridGeom untouched, out of ownership).

## Contracts for other roles
- Reads `Obstacle.membrane` only. Enemies are detected with `isHostile` from game/state (read only). No event changes.

## Device check for Ryan
Load a barrier ring drum level that has membrane bars. Each bar should look like a faint see-through strip with a dashed lighter outline and a slow wave moving along it, clearly unlike the solid walls. Turn the drum and check the bar bends round it. Let an enemy drift into a bar: that stretch should flash brighter for a moment and then settle. Try tilt on and off on a flat level with a membrane bar too.
