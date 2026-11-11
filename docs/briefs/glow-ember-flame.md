# Glow: ember-flame

Create and check out branch feat/glow-ember-flame before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/render/, tests/render/
Do not touch: src/game/ (Swarm checks the Spindle arm count in parallel), src/ui/, src/audio/, src/levelgen/, src/core/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-two.md, docs/handoffs/glow-hit-feel.md, src/render/bossHitFury.ts, wardenFury.ts, bossDamage.ts, the sweep arm drawing (hazardFx.ts), docs/pixi8-cheatsheet.md

## Goal
Ryan's device check on 9c799e2 (2026-11-11): enraged Ember does not look different; it should become a bluish flame that pulses blue, purple and white. Some cracks are too thick and look unnatural. Enraged Spindle showed 3 red arms instead of 4.

## Acceptance
1. Ember enraged (fury 2): body and glow become a blue flame that pulses through blue, purple and white (about 1.5 Hz), with a flickering flame edge (deterministic from time, no PRNG) and its dash spark trail in the same colours. The break (fury 1) crosses from orange to that blue flame instead of to red. Other guardians keep the generic red fury look; Warden unchanged.
2. Cracks: cap the crack line width so no crack reads as a thick slab; keep the brighten with damage and the pulse per hit, but grow brightness more than width (width at most about 1.6x the full health width).
3. Spindle arms: make sure the renderer draws every live sweep arm, at least 4 (check any cap of 3 in the sweep or arm drawing) and tints all of them in fury.
- Colours through the palette and applyNeon only, Pixi v8 only, no allocation per frame. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-ember-flame.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
