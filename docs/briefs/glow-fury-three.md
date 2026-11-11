# Glow: fury-three

Create and check out branch feat/glow-fury-three before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-two.md and glow-ember-flame.md, src/render/wardenFury.ts, emberFury.ts, bossHitFury.ts, src/game/bosses/view.ts (fury, furyT, frenzy, tide, tideFlipIn), src/core/events.ts ('sim:bossFury'), docs/pixi8-cheatsheet.md

## Goal
Ryan approved the fury table on 2026-11-11. This wave: the looks for Brood, Mirage and Gravitas. Swarm builds the moves in parallel and writes the view fields; build against the stub fields and treat an absent field as off. Warden, Spindle and Ember looks stay exactly as they are.

## Acceptance
1. Brood: no break on the body. At the split the Broodlings flash white once. When view.frenzy is true the Broodlings turn hot green with red cores and a quick pulse.
2. Mirage: break (fury 1): its mirrors shatter inward and the body flickers magenta to white (in place of the generic cross to red). Enraged (fury 2): a constant double image of the body, offset a few units and flickering, with a white hot edge. Ring markers need no new art; fake rings are ordinary markers.
3. Gravitas: break: the lattice lines near it snap inward, the body collapses to a point and swells back over the break. Enraged: violet body with a spinning white ring. Tide: from 0.8 s before a flip (view.tideFlipIn) a ring flashes on the body; while view.tide is -1 the pull ripples run outward instead of inward. After the stage 2 split the same look rides both halves.
4. Low quality setting keeps each look readable at lower cost, as the existing fury looks do.
- Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no image files, no allocation per frame. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-fury-three.md under 8 lines with what to verify on a device. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
