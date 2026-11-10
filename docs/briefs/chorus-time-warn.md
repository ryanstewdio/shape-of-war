# Chorus: time-warn

Create and check out branch feat/chorus-time-warn before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/ (new src/audio/timeWarnSfx.ts installed from installAudio in src/audio/synth.ts), tests/audio/
Do not touch: everything else (Ledger emits the event in parallel; 'ui:timeWarn' is stubbed by Morpheus in src/core/events.ts)
Read first: src/core/events.ts ('ui:timeWarn'), src/audio/synth.ts, src/audio/scrollTick.ts (installer pattern)

## Goal
Retro 8 bit warning sounds for the new HUD clock: Ryan wants players warned at 1 minute, 30 seconds and 10 seconds left.

## Acceptance
- secondsLeft 60: two short square wave beeps. 30: three quicker, slightly higher beeps. 10 down to 1: one short tick per second, rising in pitch, with 3, 2, 1 a little louder; a short descending chime is not needed at 0 (the level end has its own cue).
- Clear over gameplay but below boss cues; through the sfx master so volume and mute apply. Oscillators only.
- Tests with a fake backend: cue per threshold, pitch rises over the last 10, dispose. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-time-warn.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
