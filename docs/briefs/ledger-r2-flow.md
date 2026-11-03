# Ledger: r2-flow

Create and check out branch feat/ledger-r2-flow before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, src/core/stars.ts, tests/ui/, tests/settings/, tests/qa/storageKeys*.test.ts, tests/qa/normalDifficulty.test.ts, the docs/13 key table
Do not touch: src/game/, src/levelgen/ (call freePlayLevel only), src/render/, src/audio/, src/core/events.ts, src/core/difficulty.ts, src/core/bonus.ts (read only), docs/ other than the key table and your hand off
Read first: src/ui/intro.ts, src/ui/results.ts, src/ui/flow.ts, src/ui/objective.ts, src/ui/settings.ts, src/core/stars.ts, src/main.ts by search (awardStars, game:over, fallbackStatus, setSpaceLevel or spacePhysics, createEndlessGame), src/core/bonus.ts (StartBonus), src/levelgen/freeplay.ts (FreePlayOptions, freePlayLevel)

## Goal
Release gate R2 (build 39d1421, Ryan). P0 first: on Insane level 6 the objective bar was under half full, he ran out of lives, and the game said he succeeded and gave 4 stars.

## Acceptance (in priority order)
1. P0: losing all lives is always a failure with 0 stars on every difficulty and mode; Insane gives 4 stars only on a real success. Find the cause (likely the success flag passed to awardStars or the fallback status on lives) and prove it with a test that runs the real flow: Insane, lives reach 0 before the objective completes, result is failure, 0 stars, nothing saved as a best.
2. Difficulty is chosen at the start of every level and of Endless: the intro card waits (no timer) until the player taps a difficulty and then a Start button; the last choice is preselected. Remove the Difficulty and Space physics rows from Settings. Space physics follows difficulty: Easy off, Normal low, Hard medium, Insane high, applied at level start (existing space physics setter). Keep the old keys readable but unused; update the storage audits and the docs/13 table.
3. Objective bar: it must show progress toward the objective the player must complete, with a clear label ("Survive 4:12", "Destroy 312 / 530", "Score 1.2M / 3.3M"), and a separate thin par marker or score line for stars; never fill on a timer for a destroy or score objective. Tests for each objective kind.
4. Par reward: when the final score reaches par on a successful level, the results screen shows "Par reached" with a success flourish, then a choice of three: extra life, extra bomb, or start with a weapon (four small buttons: spread, rapid, pierce, orbit), each an icon drawn in DOM or canvas with its word below. The choice is stored and passed to the next level start as GameOptions.startBonus (a StartBonus from src/core/bonus.ts; Forge adds the field in parallel, so pass it through a typed options object if it is not on main yet). One reward per level completion.
5. Free Play: a new main menu item "Free Play" opens an options screen: difficulty (four), arena (rectangle, circle, drum), barriers on or off; Start builds the run with freePlayLevel({ arena, barriers, seed }) and createEndlessGame, with space physics from the difficulty. No stars or bests in Free Play; results show score and time.
6. Screens: redesign the level intro, success and failure screens for clarity: a title line (level number and arena), the objective in one sentence, difficulty chips, the three star marks as numbers, then on results: outcome headline, score against par with a bar, stars earned (and the iridescent 4th on Insane), best, the par reward choice when earned, and two big buttons (Next or Retry, Menu). Same neon style, readable on the cover and main screens.
7. Tests for every item, then npm test and npm run build pass on the branch (accepted perf exception aside). Hand off under 45 lines with a device check written in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) is the only neon entry point. No assets beyond PWA icons. No em or en dashes. Read only the files you need; run focused tests while working and the full suite once before the commit.
