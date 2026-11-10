# Ledger: scene-guardians

Create and check out branch feat/ledger-scene-guardians before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/story/scenes.ts, tests/story/
Do not touch: everything else (other sessions edit src/ui/freePlay.ts, src/ui/intro.ts and src/levelgen in parallel)
Read first: docs/19-story-bible.md (revised 2026-11-10: guardians 35 to 50 are corrupted servants; Bastion serves Tempest, the Twins serve Prism), src/story/scenes.ts, tests/story/scenes.test.ts

## Goal
Ryan approved new guardian roles for levels 35 to 50. Bring the scene data back to word for word with the bible.

## Acceptance
- boss:bastion P2, freed:bastion P1, boss:tempest P2, freed:tempest P1, boss:twins P2, freed:twins P1 and boss:prism P1 match docs/19 exactly (lines and the visual notes); nothing else changes.
- The existing data test (word for word against docs/19) passes. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-scene-guardians.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
