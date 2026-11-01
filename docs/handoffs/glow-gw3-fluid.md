# Glow hand off: gw3-fluid

Branch: feat/glow-gw3-fluid. Session: https://claude.ai/code/session_018Gwqi2Jxy7sDwggiPG1vuG

## What changed
- Fluid whirlpool (wellNova.ts, renderer drawNova): 3 gas layers of filled spiral sectors trail each band (white, alpha 0.10, 0.13, 0.17; inner layers reach less far, so gas is densest at the core). One shear field per well (flowNoise, low frequency, hash01 keyed by well id and draw clock) bends the bands: 0 at the rim, up to 0.35 rad at the core. Bands also wobble in radius (up to 5 percent, 0 at the rim and core). 8 wisps peel off band edges, get dragged inward and stretch. Motes ride the sheared streamlines with slight turbulence. Angular speed still rises toward the core; everything is still clockwise and inward. Budget: 72 motes, 16 sparks, 8 wisps = 96. Calm swirl uses the same shear.
- Chainsaw (spikeSaw.ts): teeth lie along vx, vy with length spikeLen. SPIKE_MAX now tracks weapons SPIKE_LEN x SPIKE_STRETCH, so the white edge follows Forge's new 24 to 40 range. The ghost smear (the white backdrop) is gone. While the saw level is above 0, a faint bright chain line joins each ring's teeth in phase order (BulletPool.phase, falling back to the angle round the ship). The chain closes for an even ring and stays open for a bunched bar (sawChain).
- Tempestling (bossShapes PART_TEMPESTLING = 8, partLooks): its own baked spec, the Tempest kite, streamers, inner kite and Slime sac in the Tempest colour at 0.6x size. Overlay (renderer drawTempestlings, one Graphics): 3 storm arcs swirling at 1.6 rev/s and a white hot leading edge facing the move direction (velocity, else heading). No pod pulse.
- Nova snakes (new novaSnake.ts): a snake head claimed by the emergence tracker is kept for its whole life. It is dropped when it dies, changes kind, or its w.t goes backwards (index reused). It draws a faint white shimmer band, a white core line through head and segments, and 3 bright dots running down the body, all on the shared well layer.

## Files touched
src/render/wellNova.ts, spikeSaw.ts, bossShapes.ts, partLooks.ts, novaSnake.ts (new), renderer.ts; tests/render/wellNova, spikeSaw, partLooks, novaSnake (new), bossShapes, shapes, tier3Contract tests.

## Tests
wellNova 29 (+9: noise bounds and determinism, shear and wobble bounds, sheared bands clockwise inward over many ids and times, differential rotation, turbulent motes clockwise incl. calm, gas sectors and alphas, wisps, no per frame allocation). spikeSaw 11 (+5 chain order, alpha, no ghosts). partLooks +3 Tempestling. novaSnake 6 (new). Slot count pins in bossShapes, shapes, tier3Contract moved by one part type (4 slots).
npm test: 3369 passed, 1 failed (accepted levelgen perf "200 levels under 350 ms"), 1 todo. npm run build: pass. v7 shim grep empty. tests/qa snapshots untouched.

## Risks
- Graphics cost per nova rises by 3 gas fills (12 polygons of 20 points) and 8 wisp strokes. Watch Standard tier boss fight fps; if it dips, drop WHIRL_GAS_LAYERS to 2.
- A new part type shifts EXPOSED_SLOT_BASE and MAX_SLOT by 4 (caches are sized from MAX_SLOT).
- The chain line relies on BulletPool.phase ordering the bar. If Forge's bar phase is not monotonic along the bar, the chain may zigzag.
- The renderer now reads gs(w).snakeSegs (read only) to order the nova snake segments.

## Contracts for other roles
- Read only: BulletPool.phase and spikeLen, WeaponState.saw, w.vx/vy/rot of Tempestling parts, GameState.snakeSegs. No event changes. Listening: sim:wellSpawn (unchanged).

## Device check for Ryan
1. Let a gravity well erupt. The pull area should read as a soft white disc of gas between the swirling bands, thicker near the core. Bands should bend, sway and shear over time instead of turning like a rigid wheel. White wisps should peel off the bands and stretch as they are pulled in. Everything still turns clockwise and inward, with coloured sparks.
2. Watch the snakes that crawl out of the well. For their whole life they should have a white line down the body with bright dots running along it. Normal snakes do not.
3. Take Orbit and hold the aim stick. Each tooth should point along the bar, and a faint bright line should join the teeth. There should be no white blob behind the ship. Release: the line goes away.
4. Crack Tempest at stage 2. The two Tempests should look like small Tempests (red kite, streamers, slime sac), not pods, with fast swirling arcs and a bright white front edge toward where each one moves.
