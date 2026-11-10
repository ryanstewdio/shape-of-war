# Ledger: trough-option

Create and check out branch feat/ledger-trough-option before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/ui/freePlay.ts, src/ui/intro.ts (arena name line only), src/core/settings.ts or the Free Play setup storage (the new field only), tests/ui/
Do not touch: src/core/surface.ts, src/core/trough.ts, src/core/freeplayConfig.ts (stub, read only), src/game/, src/levelgen/, src/render/, src/ui/menu.ts, docs/ other than your hand off
Read first: src/core/freeplayConfig.ts (surface field), src/ui/freePlay.ts (setup rows), src/ui/intro.ts (arena name)

## Goal
Tester 3 asked for a "half drum": a curved surface that does not connect like the cylinder, where gravity increases the steeper you go, as a later level arena so players learn normal physics first. Ryan ruled 2026-11-10: from level 24; gravity pulls the ship only (not enemies, not bullets); a valley across the width with steep left and right edges; gentle at the bottom and strong at the rim; also a Free Play option. Morpheus committed the contract stub before launch: SurfaceKind 'trough' and troughSurface in src/core/surface.ts (flat delta and wrap, no wrap at the seam), and src/core/trough.ts with the shared profile (height and slope as functions of u across the width, TROUGH constants), and FreePlayConfig.surface ('flat' | 'trough', default 'flat'). Use the stub; never redefine the profile.

## Acceptance
- Free Play setup gets an "Arena surface" row with Flat and Trough, saved with the rest of the setup (old saves default to Flat).
- The intro card names the arena "Trough" on trough levels in Adventure and Free Play, with one plain hint line: "The ground slopes. Your ship slides toward the valley."
- Tests: row, persistence and default, intro label. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-trough-option.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes.
