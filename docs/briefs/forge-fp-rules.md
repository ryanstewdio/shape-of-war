# Forge: fp-rules

Create and check out branch feat/forge-fp-rules before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/ (read only), src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/ (read only), docs/ other than your hand off
Read first: src/core/freeplayConfig.ts, src/game/game.ts (GameOptions, createEndlessGame), lives, weapons, drones, supers, drift code

## Goal
Free Play options (docs/14). The rules side: lives, run length, loadout, pickups, drift.

## Acceptance
- GameOptions.freePlay?: FreePlayConfig (absent changes nothing; tests/qa unchanged). Apply: lives (1, 3, 5, or infinite: never lose, deaths still cost the multiplier and are counted); length (endless, or a score attack that ends the run with success when the timer runs out, exposing the time left for the HUD); weapon (start with that base weapon, and if pickups are off it lasts the whole run); pickups off (no weapon or drone pickups drop); drone and super kind (override the level's); drift (off none, low as today, high 2x, drum only).
- Tests for each rule and for absent config. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/forge-fp-rules.md under 40 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. No em or en dashes.
