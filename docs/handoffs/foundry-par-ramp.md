# Hand-off foundry: par-ramp

- Version 10 (`GENERATOR_VERSION_V10`, `enableParRamp` on `DEFAULT_GEN_CONFIG`; `V9_GEN_CONFIG` builds 9). V1 to V9 frozen: the V9_GEN_CONFIG 4 seeds x 50 levels hash `37b1b7ea` equals the main default at b76e135, and the older hash pins pass unchanged.
- Par: `V10_COLLECT_RATE = 0.25` in pacing.ts, down from 0.5 (non boss and boss). Par grows almost linearly with this rate, so halving it roughly halves the multiplier. Tom's clean aggressive L6 Normal runs fell short of the old par, and Ryan's L1 Easy run scored about 0.21 of it. Levels 1 to 10 par is now 0.35 to 0.5 of the old value. Stars stay at 1, 1.25 and 1.5 x par, parScale is unchanged, and the goal stays 0.6 x par.
- Ramp: `PAR_RAMP_SCALE` in leveldef.ts runs 0.75 at L1 linearly to 1.0 at L15. It scales each R1 wave budget (floor R1_MIN_WAVE, so L1 spawns land near 0.85x) and maxLiveEnemies (exactly 0.75x at L1). Boss entrance and every wave time are unchanged, and fight waves are not ramped. `PAR_RAMP_LATE_BUDGET = 1.5` replaces R5's 1.4 on ramped band 1 levels, so the final third still spawns more than 1.2x the middle third.
- Normal, old to new (par; goal; enemies before objective or boss; no objective changed kind on levels 1 to 60 of either seed):
  - 2471588027: L1 735.5K to 311K, survive 205, 422 to 363. L4 960.5K to 402.5K, score 576.5K to 241.5K, 475 to 416. L6 3.44M to 1.27M, destroy 460 to 395, 657 to 564. L10 boss 14.41M to 6.64M, survive 330, 266 to 247. L15 boss 13.26M to 6.66M, score 7.96M to 4.00M, 240 to 240.
  - 42: L1 898K to 338K, survive 205, 443 to 382. L4 826.5K to 391K, destroy 320 to 285, 457 to 407. L6 3.34M to 1.39M, destroy 425 to 360, 607 to 514. L10 boss 12.29M to 6.04M, destroy 650 to 610, 254 to 232. L15 boss 7.50M to 3.77M, destroy 600, 229 to 229.
- Moved pins: t3, durations, drum, v2enemies, boss (V9 tests now run on V9_GEN_CONFIG, so 11 is the first unknown version); gcTriage hashes (version 10 content); scoreTarget L4 goal is 241.5K (lower par); qa/seedOverlap now runs on V9_GEN_CONFIG (ramp is by level index). normalDifficulty.test.ts needed no change.
- Tests added: tests/levelgen/parRamp.test.ts (12).
- npm test: 2 fail. The generator perf test fails on main too (accepted exception). tests/ui/scoreTarget.test.ts:18 is outside my ownership. npm run build passes.
- Request: tests/ui/scoreTarget.test.ts:18, change `576_500` to `241_500` (version 10 par).
- Device check: start seed 2471588027 on Normal. L1 should feel calmer with at most 45 live enemies. L4 goal should read 241.5K. A clean L6 run should reach 1 star.
- Known gaps: the R1_MIN_WAVE floor holds the L1 spawn cut near 0.85x, not 0.75x. On L11 to L14 the ramp can vanish on a single level. The live cap is also lower during boss fights on L5 and L10.
