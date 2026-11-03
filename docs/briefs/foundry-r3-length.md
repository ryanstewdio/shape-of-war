# Foundry: r3-length

Create and check out branch feat/foundry-r3-length before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/levelgen/, tests/levelgen/, tests/qa level pins (update only, list each), tests/game/boss* only where a boss timing pin moves (list each)
Do not touch: src/core/, src/game/, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/levelgen/generator.ts (long objectives, v6 and v7 pacing, boss atSec), src/levelgen/leveldef.ts (par, stars), tests/levelgen/r1pacing.test.ts, tests/levelgen/r2bosses.test.ts

## Goal
Release gate R3 (Ryan): "5 minute required play on the same level is too long. Average level play should be 3.5 minutes." "Par needs to be adequately adjusted for all levels." Boss fights now last about 3 minutes, which he accepted.

## Acceptance
- Non boss levels: objectives sized for an average of 3.5 minutes (survive 200 to 230 s; scoreInTime limits 200 to 230 s; destroy counts for about 210 s at the scripted kill rate), keeping the v6 pacing rules (no dead air over 3 s, surges, swarms, lulls). Boss levels: boss at 120 s after dense v7 waves (fight about 3 minutes, total about 5 minutes).
- Par for every level including boss levels and Free Play is none: par is the expected whole level score with the R1 formula; boss levels include the waves before the boss, the boss bonus and the waves during the fight. Stars at 1, 1.25, 1.5 x par. Test: the scripted strong run lands between 1 and 1.5 x par on non boss and boss levels over 200 seeds.
- Version bump, flat invariants for V1 to V5 configs, determinism. npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 40 lines as your final message with a device check in words.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
