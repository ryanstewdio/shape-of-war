# Chorus: boss-hit

Create and check out branch feat/chorus-boss-hit before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/audio/, tests/audio/
Do not touch: src/game/, src/core/, src/render/, src/ui/, src/main.ts (if wiring is needed, reuse the existing cue wiring pattern inside src/audio), docs/ other than your hand off
Read first: src/core/events.ts ('sim:bossHit'), src/audio/cues.ts, src/audio/scrollTickSynth.ts and rippleSynth.ts (small synth pattern), src/audio/synth.ts

## Goal
Ryan 2026-11-11: hit feedback on every guardian includes a short soft tick when a shot lands.

## Acceptance
- On 'sim:bossHit' landed true: a short soft synthesised tick (under 40 ms), well under the boss music and never louder than the ripple cue; at most about 12 per second (rate limited, extra hits dropped). landed false: a duller, quieter thunk at most 6 per second. Respects the master and effects volume settings and mute. Synthesised only (WebAudio), no audio files.
- Tests for the rate limiter and the cue parameters. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-boss-hit.md under 6 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
