# Glow: trough-depth

Create and check out branch feat/glow-trough-depth before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/ (Forge tunes the pull in parallel), src/core/, everything else
Read first: src/render/troughGeom.ts, src/render/drum.ts and drumPen.ts (trough projection), src/core/trough.ts (troughHeight), docs/pixi8-cheatsheet.md

## Goal
Ryan's device check on the trough (2026-11-10): the floor reads as a valley, but the rims are not visibly brighter, and climbing the slope needs more of a 3D feel. His idea: the ship gets bigger as it goes up the ramp.

## Acceptance
- Depth scale: on a trough, every drawn object (ship, enemies, bullets, geoms, pickups, effects) scales with the ground height under it, from 1.0 on the floor to about 1.35 at the rim (one named constant), as if the slope rises toward the camera. Hit areas in the sim do not change (render only).
- Rims clearly brighter: grid lines and the outline brighten and thicken toward the rims in proportion to height, so the bowl reads at a glance; a soft shade gradient on the slopes.
- Works with tilt off, low and high and on every effects tier; flat and drum levels unchanged; colours through applyNeon only.
- Perf: no visible cost on the Fold 7 (report the measured cost).
- Tests: scale at floor, mid slope and rim; flat and drum unchanged; rim brightness rises with height. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-trough-depth.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 API only. applyNeon(n) only. No asset files. No em or en dashes.
