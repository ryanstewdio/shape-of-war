# Chorus: soft-warn

Create and check out branch feat/chorus-soft-warn before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/timeWarnSfx.ts, src/audio/timeWarnSynth.ts, tests/audio/timeWarnSfx.test.ts
Do not touch: everything else
Read first: src/audio/timeWarnSfx.ts and timeWarnSynth.ts, src/core/events.ts ('ui:timeWarn', still emitted at 60, 30 and 10 to 1)

## Goal
Ryan: the countdown noise is too much. Start the countdown at 5 seconds; less high pitched, less alarm like, more subtle and quieter. All warnings softer.

## Acceptance
- 60 and 30: one gentle low chime each (soft sine or triangle, around 330 to 440 Hz, short decay), not beeps.
- Countdown only from 5 to 1 (ignore 10 to 6): a soft, low tick per second (about 220 to 330 Hz, very short, rounded attack), 3, 2, 1 barely louder; nothing at 0.
- Peak gain about half of today's, well below the effects mix; through the sfx master so volume and mute apply. Oscillators only.
- Tests: nothing from 10 to 6, cues from 5 to 1, gains and pitches in the new ranges. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-soft-warn.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
