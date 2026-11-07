# Forge: ripple

Create and check out branch feat/forge-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/game/ (new src/game/pondRipple.ts plus wiring in the sim step), tests/game/
Do not touch: src/levelgen/ (Foundry fills LevelDef.ripples in parallel), src/render/ (Glow), src/audio/ (Chorus), src/ui/ (Ledger), src/core/ (Fable stubs: events 'sim:rippleWarn' and 'sim:ripple', src/core/pondRipple.ts constants; use as is), docs/ other than your hand off
Read first: src/core/pondRipple.ts, src/core/events.ts (the two ripple events), src/levelgen/leveldef.ts (RippleEvent, LevelDef.ripples), how drift bursts are telegraphed and applied (sim:driftBurst), src/game/difficulty.ts

## Goal
Tester 3 asked for arena planes that suddenly ripple like a stone thrown into a still pond, with a sound so the player is alerted. Ryan chose: the wave pushes the ship and enemies.

## Acceptance
- From level.ripples (absent means no ripples): at atSec minus RIPPLE_WARN_SEC emit 'sim:rippleWarn'; at atSec emit 'sim:ripple' and start a ring wave whose front radius is POND_WAVE_SPEED x age, living POND_WAVE_LIFE seconds.
- As the front passes, the ship and enemies inside the band (POND_WAVE_WIDTH) get a radial outward push, scaled by strength and fading with age; the ship push is noticeable but recoverable (about a quarter of the ship's top speed at strength 1), enemies about double. Bosses and their parts are immune. Walls and obstacles still block as usual. Push scales with the difficulty's driftScale (physics follows difficulty).
- Deterministic: no PRNG in the sim; only the level data and the wave clock. Several live waves stack additively.
- Free Play, Endless and levels without ripples are bit identical to today (tests/qa/normalDifficulty.test.ts and the replay identity tests keep passing).
- Tests: warn and start timing, push direction and falloff, boss immunity, no effect when ripples absent, determinism across two runs. Use a hand built LevelDef with ripples since Foundry's generator lands in parallel. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/forge-ripple.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. Deterministic simulation. No em or en dashes.
