# Ledger: r3-screens

Create and check out branch feat/ledger-r3-screens before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, src/core/stars.ts, tests/ui/, tests/settings/, tests/qa/storageKeys*.test.ts, the docs/13 key table
Do not touch: src/game/, src/levelgen/, src/render/ (import shape specs read only), src/audio/, src/core/events.ts, docs/ other than the key table and your hand off
Read first: src/ui/intro.ts, src/ui/results.ts, src/ui/flow.ts, src/main.ts by search (startLevel freeplay branch, endCheck), src/render/shapeSpecs.ts (read only, for enemy icons), src/game/supers.ts (Turbo numbers, read only)

## Goal
Release gate R3 (build a4d6be6, Ryan): screens 3.5 of 5: "Par needs to be organised and clarified better. The details after par are unlabelled and confusing (on level 2: 'Attack drone Turbo super Seed ...'). More padding and margin is needed." "The intro screen must clearly display the goal of the level and the victory conditions, introduce new enemies by icon, name and type, and define what Turbo does for this level." Free Play ended as soon as it started (Fable glued main.ts so Free Play uses the UI Endless level; verify it).

## Acceptance
- Free Play: a test on the real flow proves a Free Play run starts, keeps running past 60 s with the ship alive, and ends only when lives run out (no stars, score and time on results). Fix anything left.
- Intro card layout, top to bottom with generous padding (at least 16 px between blocks, 20 px card padding, safe on both screens): level title and arena; a Goal block in one plain sentence ("Destroy 530 enemies before your lives run out", "Survive 3:30", "Score 2.1M in 3:30", boss: "Clear the waves, then defeat <Boss>") and a Victory line; difficulty chips with Start; Star targets as a labelled three column row ("1 star 2.1M, 2 stars 2.6M, 3 stars 3.2M", with the difficulty cap shown: "Normal: max 2 stars"); New enemies: for each enemy kind not seen in any earlier level of this run, its icon (draw its neon shape on a small canvas from the shape specs), name and one word type (chaser, shooter, splitter, hazard, swarm, tank); Loadout row with labelled items: "Drone: Attack", "Super: Turbo (doubles fire rate, faster ship, shots pierce, 10 s)" using the real Turbo numbers from supers.ts; the run seed last, small and labelled "Seed".
- Results: headline (Victory or Defeated), then a labelled Score block (score, par, a bar against the three star targets, stars earned and the difficulty cap), then Best, then the par reward choice when earned, then the buttons; every value has a label; no unlabelled run of words.
- Tests for the layout content (labels present, new enemy list from the roster, Turbo text from the numbers, Free Play run). npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-r3-screens.md under 40 lines with a device check written in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) is the only neon entry point. No assets beyond PWA icons. No em or en dashes.
