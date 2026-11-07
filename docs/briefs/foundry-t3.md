# Foundry: t3

Create and check out branch feat/foundry-t3 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, src/core/difficulty.ts (the easy bossScale value only), tests/levelgen/, tests/qa/ pins that move because of this change
Do not touch: src/game/ (Forge), src/render/ (Glow), src/audio/ (Chorus), src/ui/ (Ledger), src/core/events.ts and src/core/pondRipple.ts (Fable stubs, use as is), docs/ other than your hand off
Read first: src/levelgen/boss.ts (BOSS_SCHEDULE, bossOfNumber, hpMul), src/levelgen/cylinder.ts (CYLINDER_MIN_LEVEL, cylinderEligible), src/levelgen/generator.ts (surface choice, drum maps), src/levelgen/leveldef.ts (GENERATOR_VERSION_V8, configs, the new LevelDef.ripples and RippleEvent stub), src/core/pondRipple.ts

## Goal
Tester 3 feedback, Ryan's calls: Warden too hard at level 5 even on Easy (swap the first boss to Brood, soften the first fight, weaker bosses on Easy); drums start too late (give a taste earlier); add pond ripples on flat arenas (sudden ring waves like a stone in a still pond).

## Acceptance
- New GENERATOR_VERSION_V9 and a config flag (for example enableT3) on DEFAULT_GEN_CONFIG; every earlier config and its outputs stay frozen and bit identical (add the flag false to them as earlier waves did).
- Boss order under V9: level 5 Brood, level 10 Warden, rest unchanged. The first boss fight of a run (level 5, pass 1) gets hpMul 0.75 times its usual value.
- Easy bossScale in src/core/difficulty.ts goes from 0.65 to 0.55. Normal, Hard and Insane untouched; tests/qa/normalDifficulty.test.ts keeps passing.
- Drum taste: under V9 level 8 is always a cylinder with the open map, no drift, at most one well, no spawners, gentle roster. Levels 11 and up keep the current random share.
- Pond ripples under V9: on flat, non boss levels from level 12 (not drums, not circle arenas), generate LevelDef.ripples sorted by atSec: first at 40 to 70 s, then every 25 to 45 s until the level ends, epicentre inside the arena at least 150 units from walls and obstacles, strength 0.3 at level 12 rising to 1 by level 40, deterministic from the level seed (rng.ts only). About half of eligible levels carry ripples. validateLevel checks the field (sorted, inside arena, strength in range, absent on boss and drum levels).
- Par: if ripples change expected score, keep the R1 par formula unchanged (they are a hazard, not a score source).
- Tests: boss order and first fight hpMul under V9 and frozen under V8, level 8 drum for 20 seeds, ripple rules for 200 seeds, earlier versions identical. Update the moved pins with a one line reason each. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-t3.md under 20 lines with a seed and level that has ripples. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic: no Math.random outside src/core/rng.ts; generator output JSON serialisable. No em or en dashes.
