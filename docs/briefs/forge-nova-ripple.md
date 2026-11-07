# Forge: nova-ripple

Create and check out branch feat/forge-nova-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/game/ (pondRipple.ts, enemies/gravitywell.ts hook, wiring), tests/game/, tests/qa/ pins that move because of this change
Do not touch: src/levelgen/ (Foundry removes the scheduled ripples in parallel), src/render/ (Glow), src/audio/ (Chorus), src/ui/, src/core/ (Fable stubs), docs/ other than your hand off
Read first: src/game/pondRipple.ts, src/game/enemies/gravitywell.ts (nova state, removal, wellInNova), src/core/pondRipple.ts, src/core/events.ts ('sim:ripple', 'sim:wellNova'), src/game/difficulty.ts

## Goal
Ryan's T3 device check on 1f1efb5: the scheduled ripples were "underwhelming and almost not noticeable. I expected the plane (floor) to animate more. With so much going on it's hard to understand the waves are coming." Push rated 1 (no push felt). His direction: attach the ripple to gravity wells. A ripple happens only when a well in super nova is destroyed, right after it is destroyed. No visual warning and no alert sound: just the ripple pushing ship and enemies, with one short wave sound (deep whoomp plus watery whoosh) at the wave start. src/core/pondRipple.ts now has POND_WAVE_WIDTH 160 and POND_WAVE_LIFE 3.2 (Fable); RIPPLE_WARN_SEC is deprecated, stop using it; Fable deletes it and 'sim:rippleWarn' at merge.

## Acceptance
- Stop reading LevelDef.ripples and stop emitting 'sim:rippleWarn'. The pond runs on every mode that has wells (Adventure and Free Play; Endless has none).
- When a Gravity well that is in nova is destroyed (shot down or bombed; not when the level ends or the world resets), emit 'sim:ripple' { x, y, strength } at the well centre on that same step and start a wave there. strength from the well's size at death, 0.6 to 1. A well destroyed before its nova makes no ripple.
- Push the player can feel: at strength 1 a ship idling 300 u from the centre is shoved at least 150 u total outward by the passing band (measure displacement in a test, not just velocity); enemies about double; push ramps in and out smoothly across the band so it reads as a wave, not a teleport. Scale by driftScale. Bosses, boss parts, wells, geoms, pickups, drones, snake bodies, mines immune. Walls and obstacles block. Seam aware on drums (surface.delta for distance).
- Deterministic, no PRNG in the sim. Levels with no nova kill stay bit identical to today; tests/qa/normalDifficulty.test.ts and replay identity tests pass (move pins only where a nova kill now ripples, one line reason each).
- Tests: ripple on nova kill, none on pre nova kill or level end, strength range, ship displacement at least 150 u, enemy push, immunity, drum seam, determinism. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/forge-nova-ripple.md under 15 lines with a seed and level where a nova well appears early. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. Deterministic simulation. No em or en dashes.
