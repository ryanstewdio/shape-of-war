# Glow: fury-tune

Create and check out branch feat/glow-fury-tune before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-fixes.md, src/render/hazardFx.ts (hazardForm, planLane), furyFixes.ts, renderer.ts (bullet drawing, the ship view, planHazardAt), src/game/bosses/types.ts (the Lane w.vy telegraph contract), src/game/bullets.ts (straight), src/game/bosses/view.ts (shipInPool), docs/pixi8-cheatsheet.md

## Goal
Ryan's rulings on 2026-11-12 after his 5e6fe77 check. Mirage's aimed lane gets a longer warning (1.2 s) than the other lanes; Gravitas bends player shots unless they are fired from inside a shelter pool, and the ship drifts in a pool. Swarm builds the sim in parallel; build against the stub fields and treat absent as off. Warden, Spindle, Ember and Brood looks stay exactly as they are.

## Acceptance
1. Lane telegraph: a Lane hazard with w.vy above 0 uses w.vy as its telegraph seconds for its thin telegraph form, its alpha ramp and the moment it turns lethal and flashes; w.vy 0 keeps the tier telegraph as today. The aimed lane reads a little brighter than the other lanes while it telegraphs, so the eye finds it.
2. Straight shots: a player bullet with straight 1 is drawn with a violet white tint so the player learns that pool shots fly true. Every other bullet looks as today.
3. Ship in a pool: while view.shipInPool is true the ship carries a faint violet halo (the drift cue). Off otherwise.
4. The Low quality setting keeps each look readable at lower cost.
- Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no image files, no allocation per frame. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-fury-tune.md under 8 lines with what to verify on a device. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
