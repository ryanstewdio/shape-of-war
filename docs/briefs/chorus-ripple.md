# Chorus: ripple

Create and check out branch feat/chorus-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/ (new src/audio/rippleSfx.ts installed from installAudio in src/audio/synth.ts), tests/audio/
Do not touch: src/game/ (Forge emits the events in parallel), src/render/, src/levelgen/, src/ui/, src/core/ (Fable stubs: 'sim:rippleWarn', 'sim:ripple', src/core/pondRipple.ts), docs/ other than your hand off
Read first: src/core/events.ts (ripple events), src/core/pondRipple.ts, src/audio/synth.ts, src/audio/turboSfx.ts and src/audio/scrollTick.ts (installer patterns), how the drift burst telegraph sounds

## Goal
Tester 3 asked for a sound when an arena ripple happens so the player is alerted. The sim warns RIPPLE_WARN_SEC before the wave.

## Acceptance
- On 'sim:rippleWarn': a short rising alert (retro, distinct from the drift burst and boss cues, about 0.6 to 0.9 s) so the player knows a wave is coming.
- On 'sim:ripple': a low watery "bloop" with a short falling tail, louder with strength, through the sfx master so effects volume and mute apply. Pan by x if the existing cues pan.
- Oscillators and noise only, no sample files, no new dependency. Voice cap respected.
- Tests with a fake backend: warn cue on warn, splash on ripple, gain rises with strength, dispose removes listeners. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-ripple.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
