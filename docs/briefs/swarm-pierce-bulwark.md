# Swarm: pierce-bulwark

Create and check out branch feat/swarm-pierce-bulwark before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/game/combat.ts (the Bulwark branch of bulletHits only), src/game/enemies/bulwark.ts, tests/game/
Do not touch: src/render/, src/ui/, src/audio/, src/levelgen/, src/core/, src/main.ts, src/game/bosses/, docs/ other than your hand off
Read first: src/game/combat.ts (bulletHits), src/game/enemies/bulwark.ts, tests/game/pierceArms.test.ts, docs/handoffs/swarm-pierce-arms.md

## Goal
Ryan's ruling 2026-11-11: Pierce causes extra damage against Bulwarks, even through the shield, so they die faster. Pierce must be a clear advantage against Bulwark.

## Acceptance
1. Pierce still passes through the front shield arc (merged in PR 43, keep it).
2. A Pierce bullet (style pierce, so combos with Pierce too) does PIERCE_BULWARK_DAMAGE to a Bulwark, from any side. Export that named constant from src/game/enemies/bulwark.ts with the value 2 (Bulwark has 3 hit points, so two Pierce hits kill; Ryan will tune it on a device). Every other enemy and every other weapon unchanged. Guardian damage (bossDamageForStyle) unchanged.
3. Tests: Pierce on the front and on the back each take 2 hit points; two Pierce hits kill; spread still absorbed on the front and 1 on the back. Update tests/game/pierceArms.test.ts expectations that this changes.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-pierce-bulwark.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, no Math.random outside src/core/rng.ts. Touch only. No new dependency. No em or en dashes. Nothing beyond this brief.
