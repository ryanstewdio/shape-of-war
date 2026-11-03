# Forge: r3-turbo

Create and check out branch feat/forge-r3-turbo before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*, tests/qa/normalDifficulty.test.ts (drift pin only)
Do not touch: src/game/bosses/, src/core/, src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/game/supers.ts (Turbo), src/game/drift.ts, tests/game/drift.test.ts

## Goal
Release gate R3 (Ryan): drift bursts "occur visually, but the drum does not actually spin faster or create any challenge". Cause: drift moves the ship, enemies and bullets together, so on an open drum with no walls there is no relative motion. Also: "Turbo needs to be longer and more valuable."

## Acceptance
- Drift as a current: the base drift and the bursts push the ship (and player bullets at half strength) along u, while enemies drift at only 25 percent of it, so the player must fight the current and enemies close in from upstream during a burst. Burst 4x base for 1.5 s with the 0.6 s sim:driftBurst warning as today, scaled by driftScale. The lattice and camera keep showing the drum turning with the base flow. Tests: relative displacement between ship and a grunt during a burst at least 3x base, ship at full stick can still make headway against a burst on Easy and Normal, determinism. Update the drift pin in tests/qa/normalDifficulty.test.ts and say why.
- Turbo: duration 5 s to 10 s; fire rate 2.5x (from 2x); speed 1.35x (from 1.25x); shots pierce 2; each kill during Turbo adds 0.25 s, capped at 15 s total. 'fx:turbo' keeps firing on start and end. Tests for each number and the cap.
- npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 40 lines as your final message.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. No em or en dashes.
