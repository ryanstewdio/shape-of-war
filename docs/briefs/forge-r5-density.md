# Forge: r5-density

Create and check out branch feat/forge-r5-density before any edit. Never push main. Start from the current local main (it has an uncommitted to origin stub in src/core/difficulty.ts).

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*, tests/qa/normalDifficulty.test.ts
Do not touch: src/game/bosses/, src/core/ (read only), src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/core/difficulty.ts (spawnRate steps now easy 0.87, normal 1, hard 1.15, insane 1.32; new liveCapScale), src/game/difficulty.ts, where spawnRate is applied (search spawnRate in src/game), tests/game/difficulty.test.ts, tests/qa/normalDifficulty.test.ts

## Goal
Ryan wants each difficulty about 15 percent busier than the one below, and Insane peaks to feel like Free Play Swarm.

## Acceptance
- Apply liveCapScale to the level's maxLiveEnemies (rounded, at least 1, never above the entity cap) alongside the existing spawnRate scaling. Normal must stay identical.
- Update tests/game/difficulty.test.ts for the new spawnRate values and add liveCapScale tests; update tests/qa/normalDifficulty.test.ts for the new field (Normal exactly 1).
- npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 25 lines as your final message.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
