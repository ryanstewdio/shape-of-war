# Foundry: guardian-order

Create and check out branch feat/foundry-guardian-order before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/levelgen/boss.ts, src/levelgen/freeplay.ts (boss order only), tests/levelgen/, tests/qa/ and tests/game/ pins that move because of this change
Do not touch: src/ui/ (Ledger), src/game/ source, src/render/, src/audio/, docs/ other than your hand off
Read first: src/levelgen/boss.ts (BOSS_SCHEDULE, t3BossForLevel, bossForSegment, the Free Play ladder near lines 136 to 143), docs/handoffs/scribe-guide-rewrite-96dcc2a.md (item on guardian order)

## Goal
Ryan ruled 2026-11-10: Endless and Free Play must meet the guardians in the same order as Adventure, which opens with Brood then Warden (generator V9 order). Today Endless and Free Play start with Warden.

## Acceptance
- Endless (bossForSegment) and Free Play's guardian ladder use the Adventure pass 1 order (Brood, Warden, Spindle, Ember, ...) and then loop as today. Adventure output is unchanged and every frozen generator version stays bit identical.
- The first Endless and Free Play guardian does not take the Adventure first fight hit point discount unless that is already shared; state which.
- Update moved pins with a one line reason each (Endless boss tests, Free Play boss tests). npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-guardian-order.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic. No em or en dashes.
