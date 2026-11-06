# Foundry: score-target

Create and check out branch feat/foundry-score-target before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: this is a cross cutting fix and nothing else runs in parallel: src/levelgen/ (the scoreInTime target), src/game/ (applying difficulty to the objective target, next to the existing liveCap scaling in createGame), src/ui/ (where the goal, the HUD objective bar and the star line read the target), and their tests, tests/qa level pins (update only, list each)
Do not touch: src/render/, src/audio/, docs/ other than your hand off
Read first: src/levelgen/generator.ts (scaledTarget and where par and the scoreInTime target are set, around wholeLevelPar), src/core/difficulty.ts (parScale), src/game/difficulty.ts (levelWithLiveCap pattern), src/ui/intro.ts and src/ui/objective.ts

## Goal
First tester report on tester-1 (build d9bfb54): "Game is fun! Some level victory requirements and par are very far apart. Victory on level 4 is 11K, and 1 star on Hard is 1 million." Cause: on long levels the scoreInTime target still comes from the legacy score model (scaledTarget over computePar, no multiplier), while par uses the whole level model, so the goal is about 1 percent of par.

## Acceptance
- On every level whose par comes from the whole level model (R1 and later configs), the scoreInTime target is 60 percent of par at Normal, rounded to the PAR_STEP grid, at least PAR_MIN: a player who finishes the goal is close to the 1 star line, so the goal and the stars tell one story. Legacy configs (V1 to V5) keep their old targets.
- Difficulty: the target scales with DIFFICULTY[d].parScale exactly like par and the star lines, applied once when the world is built (a scaled copy of the level, as liveCap does), so the sim's success check, the HUD objective bar, the intro goal text and the results all show the same number. Normal stays bit identical to the new generator output.
- Tests: for 500 seeds of levels 1 to 60, every scoreInTime target is 0.6 x par within one PAR_STEP; the target never exceeds the 1 star line at any difficulty; the intro goal text, the HUD bar label and the sim's success check agree on the target on Easy and Insane; level 4 of the tester's seed style shows a goal near 600K at Normal. Update moved pins and list them.
- npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/foundry-score-target.md under 25 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
