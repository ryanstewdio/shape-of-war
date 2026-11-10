# Forge: trough-tune

Create and check out branch feat/forge-trough-tune before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/game/trough.ts, tests/game/trough.test.ts
Do not touch: everything else (Glow changes the trough look in parallel)
Read first: src/game/trough.ts (TROUGH_PULL 96), src/core/trough.ts (profile)

## Goal
Ryan's device check on the trough (2026-11-10): the ship slides only very slightly on a slope; pull rated 2.5 where 3 is right.

## Acceptance
- TROUGH_PULL raised by 1.5x (about 144), so the rim pull is about 240 u/s at Normal; the rim must stay reachable by thrust on every difficulty (assert it against SHIP_SPEED at Insane; if 1.5x breaks that, take the largest factor that keeps it reachable and say so).
- Tests updated. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/forge-trough-tune.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic. No em or en dashes.
