# Glow: trough

Create and check out branch feat/glow-trough before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/core/ (stub, read only), src/game/ (Forge), src/levelgen/ (Foundry), src/ui/ (Ledger), docs/ other than your hand off
Read first: src/core/trough.ts and src/core/surface.ts (stub), src/render/drum.ts and src/render/drumPen.ts (the drum projection), src/render/tilt.ts, docs/pixi8-cheatsheet.md

## Goal
Tester 3 asked for a "half drum": a curved surface that does not connect like the cylinder, where gravity increases the steeper you go, as a later level arena so players learn normal physics first. Ryan ruled 2026-11-10: from level 24; gravity pulls the ship only (not enemies, not bullets); a valley across the width with steep left and right edges; gentle at the bottom and strong at the rim; also a Free Play option. Morpheus committed the contract stub before launch: SurfaceKind 'trough' and troughSurface in src/core/surface.ts (flat delta and wrap, no wrap at the seam), and src/core/trough.ts with the shared profile (height and slope as functions of u across the width, TROUGH constants), and FreePlayConfig.surface ('flat' | 'trough', default 'flat'). Use the stub; never redefine the profile.

## Acceptance
- A trough level draws the arena as a valley: the grid curves up toward the left and right edges following the shared profile exactly (no wrap, no seam), with shading or line density that makes steep ground read as steep. Ship, enemies, bullets, effects and the pond ripple project onto the surface the way they do on drums.
- Works with tilt off, low and high, on the Fold 7 cover and inner screens and on every effects tier; colours through the palette and applyNeon only.
- Perf: frame budget kept on the Fold 7 (report measured cost); flat and drum levels render as today.
- Tests: projection matches the profile at bottom, slope and rim; flat and drum unchanged. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-trough.md under 12 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 API only. applyNeon(n) only. No asset files. No em or en dashes.
