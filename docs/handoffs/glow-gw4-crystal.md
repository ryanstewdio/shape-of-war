# Hand off: glow gw4-crystal

Branch: feat/glow-gw4-crystal. Session: https://claude.ai/code/session_018Gwqi67taXykpMaDutQiuQ

## What changed
- Fluid whirlpool (wellFluid.ts, wellFluidView.ts): on Standard and High each nova well (at most 4) is one quad sized to its pull radius with a custom GlProgram fragment shader (same pattern as latticeView's heat shader, GL only like the rest of the app). The shader uses 3 octaves of domain warped value noise, sampled where the gas came from. That source point is the pixel turned back against a clockwise angular speed that rises toward the core (1 rad/s at the rim, about 4.7 near the core) and pushed outward by an inward drift. Two staggered 1.6 s advection cycles cross fade so the shear never winds up. The white gas (hsl 0 0 95) is densest at the core, fades to nothing at the pull radius, has a bright core and thin prismatic refraction fringes on the band edges. Uniforms: uTime (draw clock), uRadius, uSpin, uSeed, uAlpha, uCore, uGlow (mapFxNeonGain of applyNeon's glow), uWhite, and four palette hues. Low keeps the GW3 geometry path unchanged. The white dust motes and coloured spark motes still draw on top on every tier.
- Crystal shimmer (gemGlint.ts): gem glints are sharp 4 point stars that pop in and out. Each lives 0.15 to 0.4 s, deterministic from the id and the draw clock (hash01). The hue sweeps the palette ring and the centre stays white hot. Each nova has 8 glints riding the flow. Nova snakes get 4 glints travelling down the body in place of the old dots; the white line stays.
- Level reset (wellReset.ts): setArena (called by main.ts on every start, restart and retry) now clears nova slots too, which were never reset before. A retry world reusing a well's entity index inherited the old whirlpool; that was the bug. It also hides the shader quads and clears arrivals, emergences and nova snakes in one call. The lattice and its dimples are already rebuilt by setArena.
- Chainsaw (spikeSaw.ts, renderer): I could not reproduce a backdrop as one shape in a headless Chromium harness. The prime suspect, now removed, is the near white chain line (70 percent white) that closed round the back of the ship. The bar is now a glowing outline in the weapon hue along the chain (a wide soft pass and a thin line). Teeth are metallic triangles in the hue with a white tip (toothTip). Two ghosts slide back along the track (sawTrackGhost), not round the ship. Saw hits (fx:hit near a tooth while sawing) throw 2 to 4 sparks. I also fixed the outer ring: it was drawn as crescent sprites because only mask 1 counted as teeth. Both rings are teeth now, so the long outer bar reads as saw.

## Files
New: src/render/gemGlint.ts, wellFluid.ts, wellFluidView.ts, wellReset.ts, tests/render/gemGlint.test.ts, wellFluid.test.ts, wellReset.test.ts. Changed: src/render/renderer.ts, spikeSaw.ts, wellNova.ts (WHIRL_MOTES 72 to 64 to fit 8 glints in the 96 budget), novaSnake.ts, tests/render/spikeSaw.test.ts, wellNova.test.ts, novaSnake.test.ts.

## Tests
gemGlint 6, wellFluid 9 (speed profile, clockwise with y down, inward drift, edge fade, cross fade weights, tier, shader string has every uniform and balanced syntax, one quad per nova with no per frame allocation), wellReset 3 (a reset leaves no well visuals, no stale slot match on index reuse, renderer wiring). spikeSaw: the old ghost test was replaced by 4 GW4 tests. novaSnake +2, wellNova +2. tests/render: 736 pass. npm test: 3519 pass, 1 fail (the known generator perf test "200 levels under 350 ms": 366 ms in this VM). npm run build: pass. The v7 grep is clean.
Checked in headless Chromium (SwiftShader): the shader compiles and draws a spiralling gas disc with glints; Low is unchanged; after setArena the whirlpool is gone; the saw shows hue outlines and white tipped teeth.

## Risks
- GPU cost: about 10 value noise lookups (40 hashes) plus 2 exp, sin and cos per covered pixel. A nova at NOVA_RADIUS covers roughly the pull disc. On the Fold 7 at DPR about 2.6 that is up to about 0.5 to 1 Mpx per nova. Expect roughly 0.5 to 1.5 ms per nova on the Adreno. Four novas at once is the worst case. CPU cost drops, because the per frame gas, band and wisp Graphics build is gone on Standard. If fps dips below 58, lower FLUID_OCTAVES to 2 or drop the warp.
- The backdrop fix is inferred, not reproduced. If it remains, report what it looks like (colour, size, when it appears).
- Glint sizes and the fringe strength (FLUID_FRINGE_A) may need device tuning.

## Contracts
No event or contract changes. sim:saw, sim:wellArrive and sim:bossShield are untouched. The renderer still reads BulletPool.spikeLen and phase.

## Device check for Ryan
1. Play to a gravity well nova on Standard. The disc should look like white liquid spiralling clockwise down a drain: streaks shear and curl, faster near the bright core, fading out at the edge. Small coloured star glints should pop in and out like a gem catching light, with faint rainbow edges on the gas bands. Rate fluid look and shimmer 1 to 5.
2. With a nova on screen, die or retry, or quit and restart. The new level must show no old whirlpool, ring, swirl or snake trail.
3. Watch a snake crawl out of a well: white line plus about 4 glints travelling down its body.
4. Take Orbit and hold aim. There should be no white fill or halo behind the ship. The bar is a green outline with sharp green teeth with white tips and a short smear along the bar. Sparks fly where teeth cut enemies. Rate the visual 1 to 5.
5. Boss fight on Standard with a nova if possible: the lowest fps should be 58 to 59.
