# Chorus: tick-only

Create and check out branch feat/chorus-tick-only before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/audio/cues.ts, src/audio/synth.ts, tests/audio/
Do not touch: src/audio/music/ (the boss hit tick in bossCue.ts and hits.ts stays exactly as it is), src/game/, src/render/, src/ui/, src/levelgen/, src/core/, src/main.ts, docs/ other than your hand off
Read first: src/audio/cues.ts (cueForHit, BOSS_KIND), src/audio/synth.ts (the fx:hit handler), src/audio/music/bossCue.ts, tests/audio/cues.test.ts

## Goal
Ryan's ruling 2026-11-11: remove the old boss hit cue. Today a guardian hit plays both the old 'bossHit' cue (synth.ts on fx:hit through cueForHit) and the new tick from the music engine. Only the tick should remain.

## Acceptance
1. A damaging hit on a guardian no longer plays the 'bossHit' cue. The music engine tick, shield deflect sounds and every other cue are unchanged.
2. Remove what becomes dead code (the fx:hit handler in synth.ts, cueForHit, the 'bossHit' cue definition and BOSS_KIND if nothing else reads them); keep anything another module or test still needs and say so in the hand off.
3. Tests updated: no cue is played for fx:hit; the tick tests still pass untouched.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-tick-only.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any, no Math.random outside src/core/rng.ts. Touch only. No new dependency. No em or en dashes. Nothing beyond this brief.
