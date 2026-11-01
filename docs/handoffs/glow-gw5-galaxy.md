# Glow hand-off: gw5-galaxy

Branch: feat/glow-gw5-galaxy. Session: https://claude.ai/code/session_018Gwqi6KX4epV1n8HHSnvpX

## What changed
- Galaxy whirlpool, every tier: the nova flow runs at GALAXY_SPEED 1.3x (angular speed at core and rim, and the inward drift). Shader tiers bake FLUID_SPEED into the omega and the drift. Low passes rate 1.3 to the bands, gas sectors, dashes, wisps, motes, sparks and glints. Still clockwise on screen, still drifting inward.
- Shader (Standard, High): brighter, denser white gas (higher base, gas and filament alpha). A soft additive glow pass: a low frequency noise sample advected with the gas that adds light at half its cover. A broad core bulge under the tight core. GALAXY_ARMS = 3 log spiral arms of brighter gas, with dark dust lanes just off each crest. The arms use the motes' own spiral and turn with uniform uArm (galaxyArmUniform, wrapped to 0 to 2 pi in TS so the GPU trig stays small).
- Star dust: WHIRL_MOTES 64 to 128 (NOVA_ADDED_PARTICLES_MAX 96 to 192; a nova now adds 160). 75 percent of motes start on an arm crest (whirlMote with arms and armBase) and stream along it as they fall in. Each mote has a tiny twinkle (galaxyTwinkle). Low keeps 64 motes.
- Nova snake glints: the 4 body glints are replaced by a ribbon of NOVA_SNAKE_GLINTS = 8 glints. They orbit the head and body in a loose helix (novaRibbonAt: 14 u radius tapering to the tail, 1.1 turns a second, 2.5 helix turns along the body), sit brighter in front and dimmer behind, and drift tailward. While the head is within 250 u of its well (state snakeWell), NOVA_STREAM_GLINTS = 6 glints flow from the whirlpool centre to the head on a path bent clockwise (novaStreamAt). They fade out from 200 to 250 u. The glint helper is unchanged (glintAt, drawGlint).

## Files touched
src/render/wellNova.ts, wellFluid.ts, wellFluidView.ts, novaSnake.ts, renderer.ts; tests/render/galaxy.test.ts (new, 11 tests), novaRibbon.test.ts (new, 8 tests), and updated wellNova, wellFluid, novaSnake and gemGlint tests (new budgets and speeds).

## Tests and build
- tests/render: 66 files, 794 tests pass.
- npm test: 3702 pass, 1 fails: the generator perf test "200 levels under 350 ms" (accepted VM exception). tests/qa unchanged.
- npm run build: pass. The v7 grep and the dash check print nothing.
- The new fragment shader compiles under WebGL2 in headless Chromium (SwiftShader). An offline render shows the bulge, the arms and the denser gas.

## GPU cost estimate
Per covered fluid pixel: 10 to 12 value noise samples (one glow sample per advection layer) plus atan, log, 2 cos and 1 exp. About 25 to 30 percent more fragment ALU than GW4. Quad coverage, draw count (one per nova) and blend are unchanged. CPU: 64 more mote circles per nova (bucketed into the same 4 fills) and up to 14 glints per nova snake (2 small fills each). Nothing is allocated per frame. With two novas I expect the low point to hold at 58 to 59, but that is not measured. Checking it on the device is the main risk.

## Risks
- Fill rate on two large novas, see above. Easy knobs: FLUID_GLOW_A to 0, or WHIRL_MOTES back toward 96.
- The glow pass writes premultiplied rgb above alpha (additive look). This assumes the mesh keeps pixi's normal premultiplied blend.
- Tilt: only uniforms changed. The quads are still the same billboards, so tilt is untouched.

## Contracts for other roles
None changed. Glow now reads `gs(w).snakeWell` (read only). No event changes.

## Device check for Ryan
1. Play a level with gravity wells and let one go nova. The whirlpool should turn visibly faster than build 5966c36 at both the rim and the centre, still clockwise, with gas drifting inward.
2. Look for a bright white core bulge, three curved spiral arms of brighter gas with darker lanes beside them, and about twice as many white dust specks streaming along the arms and twinkling.
3. Wait for a snake to crawl out. About eight prismatic star glints should circle its head and body in a loose corkscrew and trail back along it.
4. While that snake is near its well (within about a quarter of the screen width), a thin stream of glints should flow out of the whirlpool and curve onto the snake. Lead it away and the stream should fade.
5. Check the dev panel fps in a two nova fight on Standard. The low point should stay at 58 to 59.
6. Switch to Low effects. You should see the old geometry whirlpool, faster, with no arms shader.
7. Tilt the phone. The whirlpool stays a flat facing disc as before.
