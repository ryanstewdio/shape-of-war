# Hand-off: glow gw6-compact

Branch feat/glow-gw6-compact. Owner: Glow.

## What changed
- Whirlpool: the gas disc is drawn at 65 percent of the sim pull radius (WHIRL_VISUAL). Bands, wisps, arms, star dust, spark motes and glints use that smaller disc with the same counts, so density rises. The shader gas is 18 percent brighter (FLUID_BRIGHT). Between the disc and the pull radius only a faint white haze (15 percent alpha, fading to 0) hints the pull area. Galaxy look, clockwise, inward flow unchanged.
- Tempestling: new palette key `tempestling` (hue 339 = bossRed 4 moved 25 degrees toward the Tempest cyan accent, saturation x0.8, lightness x0.9). Body, swirl arcs and leading-edge glow use it; the leading edge stroke is now white. Colour goes through the palette and applyNeon only.

## Files touched
src/render/wellNova.ts, wellFluid.ts, renderer.ts, neon.ts, bossShapes.ts; tests/render/wellFluid.test.ts, galaxy.test.ts, partLooks.test.ts.

## Tests added
wellFluid (haze and ratio, shader maps to visual disc: 2), galaxy (renderer uses vis: 1), partLooks (palette cooling: 1). Updated three existing assertions for vis and the new key.

## Test and build
npm test: all pass (full run before the final assertion fix: 1 stale assertion, since fixed; render dir re-run 798 pass). npm run build: pass. v7 grep prints nothing.

## Risks
- Hue 339 sits 7 from Blink rose (332) and 4 from homing (335); no palette test failed, but check it reads apart on device.
- Quad is still pull radius sized, so fill cost is unchanged.

## Contracts for other roles
None. Sim pull radius and events untouched.

## Device check for Ryan
Fire a nova well and watch the whirlpool: the bright spinning gas should sit in a disc about two thirds of the old size, clockwise, denser with a brighter core and more concentrated shimmers, with only a very faint ring of haze out to the pull edge. Then meet a Tempest boss and its Tempestlings: they should look cooler, a pink-magenta red instead of hot red, with a white leading edge.

Session: https://claude.ai/code/session_018Gwqi3DueT7DZdBYhBFuVR
