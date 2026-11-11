# Swarm: pierce-arms

Create and check out branch feat/swarm-pierce-arms before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/game/enemies/bulwark.ts, src/game/combat.ts (the Bulwark shield check only), src/game/bosses/spindle.ts, src/game/bosses/table.ts (Spindle rows only), tests/game/
Do not touch: src/render/ (Glow checks the Spindle arm drawing in parallel), src/ui/, src/audio/, src/levelgen/, src/core/, src/main.ts, docs/ other than your hand off
Read first: src/game/enemies/bulwark.ts, combat.ts (shieldBlocks), src/game/bosses/spindle.ts (armsFor, SPINDLE_FURY), the sweep hazard code and HAZARD.sweepArmsMax, docs/handoffs/swarm-fury-two.md

## Goal
Ryan's device check on 9c799e2 (2026-11-11): enraged Spindle showed 3 red arms, not the 4 the fury should give; and Bulwark should be easier to damage with Pierce.

## Acceptance
1. Spindle: prove with a test that the sim builds 4 live sweep arms once enraged (fury 2), through every sweep and reversal. If it builds fewer, find and fix the cause (clamp, rebuild path, hazard pool cap). Say in the hand off whether the sim was already right.
2. Bulwark: Pierce shots pass through its frontal shield arc instead of being absorbed (every other weapon unchanged; combos that include Pierce count as Pierce). Bombs and Detonate unchanged.
- Tests for both. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-pierce-arms.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, no Math.random. Touch only. No em or en dashes. Nothing beyond this brief.
