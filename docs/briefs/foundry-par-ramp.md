# Foundry: par-ramp

Create and check out branch feat/foundry-par-ramp before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, src/core/difficulty.ts (only if the ramp needs a field there), tests/levelgen/, tests/qa/ pins that move because of this change (including tests/qa/normalDifficulty.test.ts, see ruling below)
Do not touch: src/ui/ (Scribe renames strings), src/economy/ (Ledger), native files (Shipwright), src/game/, src/render/, src/audio/, docs/ other than your hand off
Read first: src/levelgen/pacing.ts (wholeLevelPar, R1 pacing, R3 collect rate), src/levelgen/generator.ts and leveldef.ts (GENERATOR_VERSION_V9, configs, enableT3 pattern), docs/DECISIONS.md rows on par and parScale

## Goal
Tester Tom: level 6 on Normal took several attempts and still never reached par (1 star) with no lives lost while aggressively collecting geoms; the early swarm on Normal felt too aggressive for an average player. Ryan's own data point earlier: level 1 on Easy scored about 0.21 of par. Ryan ruled 2026-11-09: (1) recalibrate par so it assumes realistic geom pickup; (2) a gentler ramp for levels 1 to 10 on every difficulty, rising to today's pace by level 15. Normal is no longer required to stay bit identical to the old game for these levels (Ryan's ruling); everything else stays.

## Acceptance
- New GENERATOR_VERSION_V10 and config flag on DEFAULT_GEN_CONFIG; V1 to V9 configs and outputs frozen, bit identical.
- Par: change the expected geom pickup assumption from about half to about a quarter (choose and justify the value; expose it as one named constant), so a clean, aggressive run on Normal reaches 1 star on levels 1 to 10. Stars stay 1, 1.25, 1.5 x par; parScale per difficulty unchanged; the scoreInTime goal stays 0.6 x par (it drops with par; state the new values).
- Ramp: levels 1 to 10 get fewer and slower spawns on every difficulty (for example spawn rate and live cap at about 0.75 of today at level 1, rising linearly to 1.0 by level 15; choose values, one named table). Boss levels keep their boss timing.
- Report, for run seed 2471588027 and for seed 42, levels 1, 4, 6, 10 and 15 at Normal: old and new par, goal, and enemy count. Report any objective that changed kind.
- Update moved pins with a one line reason each; tests/qa/normalDifficulty.test.ts may change only for V10 levels 1 to 14, citing this ruling.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-par-ramp.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic generator, no Math.random outside src/core/rng.ts. No em or en dashes.
