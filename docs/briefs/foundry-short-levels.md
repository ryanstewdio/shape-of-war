# Foundry: short-levels

Create and check out branch feat/foundry-short-levels before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa/ pins that move because of this change
Do not touch: src/ui/ (Ledger builds the HUD clock in parallel), src/audio/, src/native/, src/game/, src/render/, src/core/, .github/, vite.config.ts, index.html, docs/ other than your hand off
Read first: src/levelgen/leveldef.ts (GENERATOR_VERSION_V10, R3_MEAN_LEVEL_SEC 210, R3_MIN and MAX, PAR_RAMP_SCALE, configs), src/levelgen/pacing.ts, src/levelgen/generator.ts (objective choice, R1 waves, R5 late budget, boss levels)

## Goal
Tester: 3.5 minute levels are too long, especially level 1, and repetitive. Ryan ruled 2026-11-10: level 1 about 90 s, rising to the 2 to 3 minute range after level 4; match time should vary from level to level; some levels are a race to score a target before time runs out; and each minute should bring something new.

## Acceptance
- New GENERATOR_VERSION_V11 and config flag on DEFAULT_GEN_CONFIG; V1 to V10 configs and outputs frozen, bit identical.
- Length: level 1 about 90 s; levels 2 to 4 ramp up; from level 5 every non boss level draws its length in 120 to 180 s (deterministic per level, visibly varied, one named table). Boss levels: the waves before the boss shorten on the same curve (state the boss entrance seconds for levels 5, 10, 15, 20); the boss fight itself is unchanged.
- Score races: scoreInTime levels appear regularly (state the share for levels 1 to 30, at least one in every 4 non boss levels from level 3), with the goal still 0.6 x par and par following the shorter length through the existing formula.
- Minute beats: each full minute of a level brings a new beat drawn from that level's own roster (a new formation, a well arrival where wells are allowed, or a short surge), and the last 20 s are a final rush. Data only, deterministic, no new enemy kinds, no new event types needed by the sim (if one is needed, list it under Requests instead).
- Keep the V10 par ramp and spawn ramp behaviour for levels 1 to 15 (scaled to the new lengths).
- Report for seed 42 and seed 2471588027, levels 1 to 10 and 15 at Normal: length, objective, par, goal, beat list.
- Update moved pins with a one line reason each. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-short-levels.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic generator, no Math.random outside src/core/rng.ts. No em or en dashes.
