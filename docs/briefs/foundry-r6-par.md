# Foundry: r6-par

Create and check out branch feat/foundry-r6-par before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, src/core/difficulty.ts (the parScale values only), a new test file under tests/game/ for the calibration sim (read src/game only)
Do not touch: src/game/ (read only), src/render/, src/audio/, src/ui/, src/main.ts, other fields of src/core/difficulty.ts, docs/ other than your hand off
Read first: src/core/difficulty.ts, src/levelgen/generator.ts (par, the R1 whole level formula), src/levelgen/freeplay.ts (Free Play rosters and snakes), tests/levelgen/r5fp.test.ts

## Goal
Gate R5 (Ryan): "par is not lining up for Easy levels, near impossible to get par: level 1 on Easy hit 129k with par 751k." "Snakes" in Free Play with wells off: still do not appear on device, though the R5 test passes.

## Acceptance
- Calibrate par per difficulty: run the scripted strong player through the real sim (createGame with GameOptions.difficulty) on 40 levels (levels 1 to 40, two seeds) at each difficulty, measure the mean score ratio to the Normal score, and set parScale for easy, hard and insane to those ratios rounded to 0.05 (Normal stays exactly 1). Also check level 1 to 4 Normal par against the scripted run (it should sit at 1 to 1.5 x par); if early level par is off, fix the formula for band 1. Report the measured ratios and Ryan's data point (level 1 Easy 129k) against the new Easy par in the hand off.
- Snakes: find why Free Play with wells off still shows no Snakes on device. Check the real path: the Free Play setup passes enemies (toggles) and the segment roster, density and wells settings; the R5 test may not use the same config the setup screen saves (for example an explicit enemies list that omits snake, or the snake kind gated behind wells somewhere). Fix it and test with the exact config the setup screen builds by default and with wells off.
- Determinism, flat invariants for V1 to V6 configs. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/foundry-r6-par.md under 35 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
