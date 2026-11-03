# Foundry: fp-level

Create and check out branch feat/foundry-fp-level before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, tests/levelgen/
Do not touch: src/core/ (read only), src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/core/freeplayConfig.ts, src/levelgen/freeplay.ts (freePlayLevel, freePlaySegment), src/levelgen/generator.ts (endless segments, rosters, wells, boss specs, arena sizes)

## Goal
Free Play options (docs/14). The level side: enemies, density, bosses, wells, arena size.

## Acceptance
- FreePlayOptions gains config?: FreePlayConfig (absent means DEFAULT_FREE_PLAY behaviour, identical to today's Free Play). freePlayLevel and freePlaySegment honour it: enemies (only the chosen kinds appear in segments; empty means the normal roster), density (Low 0.6x, Normal 1x, Swarm 1.8x spawn counts within maxLiveEnemies raised for Swarm up to the entity cap), bosses (off; every3: a boss from the tier ladder every 180 s on a flat arena, drums keep no boss; a chosen BossId every 180 s), wells (off none, normal as today, many: 2 to 4 and arrivals more often), size (small 0.75x, medium 1x, large 1.3x of the arena dimensions, drum widths still multiples of 64).
- Deterministic from seed and config, validates, JSON safe. Tests for each option and for absent config equals today. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/foundry-fp-level.md under 40 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
