# Forge: trough

Create and check out branch feat/forge-trough before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/ (ship physics and wiring), tests/game/
Do not touch: src/core/ (stub, read only), src/levelgen/ (Foundry), src/render/ (Glow), src/ui/ (Ledger), docs/ other than your hand off
Read first: src/core/trough.ts and src/core/surface.ts (stub), src/game/drift.ts (how drift pushes the ship on drums), src/game/difficulty.ts (driftScale), the ship movement code

## Goal
Tester 3 asked for a "half drum": a curved surface that does not connect like the cylinder, where gravity increases the steeper you go, as a later level arena so players learn normal physics first. Ryan ruled 2026-11-10: from level 24; gravity pulls the ship only (not enemies, not bullets); a valley across the width with steep left and right edges; gentle at the bottom and strong at the rim; also a Free Play option. Morpheus committed the contract stub before launch: SurfaceKind 'trough' and troughSurface in src/core/surface.ts (flat delta and wrap, no wrap at the seam), and src/core/trough.ts with the shared profile (height and slope as functions of u across the width, TROUGH constants), and FreePlayConfig.surface ('flat' | 'trough', default 'flat'). Use the stub; never redefine the profile.

## Acceptance
- On a level whose surface is 'trough', the ship feels a pull toward the valley floor along u, proportional to the profile slope at its position: near zero at the bottom, strong at the rim (the ship can still climb to the rim and fight there, but must keep thrusting). Scale by the difficulty's driftScale. Enemies, bullets, geoms and pickups are unaffected.
- The arena edges stay solid walls at the rim; nothing wraps.
- Deterministic, no PRNG. Flat and cylinder levels, Free Play without trough and Endless stay bit identical (tests/qa/normalDifficulty.test.ts and replay identity tests pass).
- Tests: pull direction and magnitude at bottom, mid slope and rim; no pull on enemies or bullets; difficulty scale; flat levels unchanged; determinism. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/forge-trough.md under 12 lines with a dev URL to try a trough level. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. Deterministic simulation. No em or en dashes.
