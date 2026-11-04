HAND-OFF foundry: r6-par
Branch: feat/foundry-r6-par  Head: see git log (pushed to origin)
Files changed: src/core/difficulty.ts (parScale only), src/levelgen/validate.ts (snake floor constants), tests/levelgen/fpLevel.test.ts, tests/levelgen/r5fp.test.ts, tests/levelgen/r6snakes.test.ts (new), tests/game/parCalibration.test.ts (new), docs/handoffs/foundry-r6-par.md
Tests added: r6snakes 4 (setup screen default and wells off, real sim), parCalibration 3 (1 gated by PAR_CALIBRATE=1); fpLevel and r5fp updated to the new floor
npm test: 4576 pass, 1 fail (generator "200 levels under 500 ms", fails on main too: the accepted perf exception)  npm run build: pass

Par calibration. Bot: real sim (createGame with GameOptions.difficulty, main.ts scoring port, 1/60 s steps), aims at the nearest target (boss first), chases geoms within 600, shielded so deaths do not add noise. Levels 1 to 40, seeds 1 and 1000, 4 difficulties. Mean score ratio to Normal: easy 0.808, hard 1.165, insane 1.317. parScale set to 0.8, 1.15, 1.3 (Normal 1). A mortal bot (reach 400) lost 61 of 80 Normal levels, so its ratios were noise and were not used.
Levels 1 to 4 Normal, bot score / par: 3.55 1.88 3.89 2.05 (seed 1), 3.62 3.40 3.78 1.90 (seed 1000). Every band sits above 1.5 (mean 2.46 over all 80), so band 1 is not out of line with the rest and I did not change the band 1 formula: raising par would go against Ryan's report.
Ryan's data point: level 1 Easy 129k against par 751k. New Easy par is 0.8 x 751k = about 600k, so 129k is still 0.21 x par. parScale does not close this gap. Score depends heavily on how many geoms are collected: the same bot with geom reach 200, 300 or 600 scores 0.03, 1.0 and 3.5 x par on level 1. The par model assumes 0.5 of the geoms dropped are collected; Ryan collects far fewer, and deaths reset the multiplier.

Snakes. Cause: the real path did spawn snakes (checked with buildFreePlayRun and the setup screen's DEFAULT_FREE_PLAY, wells off), but only 1 per 30 s segment, from 0:30, at a corner, and the attack drone killed each within about 5 s. In the first 3 minutes a snake was live about 28 percent of the time and never before 0:45. Config was fine: enemies [] allows the snake, and wells play no part. Fix: FREE_PLAY_SNAKES_PER_SEGMENT 3, FREE_PLAY_SNAKE_FROM_SEGMENT 0. Real sim, wells off: first snake before 15 s, live over 40 percent of the first 2 minutes on 3 seeds.
Determinism and flat invariants: generateLevel is untouched (V1 to V6 suites pass); Free Play hashes are deterministic (r6snakes, r5fp).

How to verify on device:
1. Free Play, defaults, wells off: a snake shows within the first 15 s, then about one every 10 s.
2. Settings Easy, level 1: the results bar shows par at 0.8 x the Normal par (when Ledger applies parScale).
3. Optional: PAR_CALIBRATE=1 npx vitest run tests/game/parCalibration.test.ts --silent=false prints the ratios.
Dependencies requested: none
Requests (changes outside my ownership): 1) Ledger: apply parScale to par and the stars, if not done yet. 2) Fable: decide whether par should follow a human collect rate (decision below).
Known gaps: Ryan's 129k vs about 600k Easy par stays unresolved. A lower collect rate in par (for example 0.3 instead of 0.5) would lower par on every level; that is a decision for Fable, not a band 1 tweak. Destroy levels score lower than survive levels for a player who kills everything, because the count is met sooner.
