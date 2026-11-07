# Chorus: nova-ripple

Create and check out branch feat/chorus-nova-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/ (rippleSfx.ts, rippleSynth.ts), tests/audio/
Do not touch: src/game/, src/render/, src/levelgen/, src/ui/, src/core/ (Fable stubs), docs/ other than your hand off
Read first: src/audio/rippleSfx.ts, src/audio/rippleSynth.ts, src/core/pondRipple.ts, the existing well nova and explosion cues (the ripple now follows a nova well being destroyed, so it must sit after that explosion, not on top of it)

## Goal
Ryan's T3 device check on 1f1efb5: the scheduled ripples were "underwhelming and almost not noticeable. I expected the plane (floor) to animate more. With so much going on it's hard to understand the waves are coming." Push rated 1 (no push felt). His direction: attach the ripple to gravity wells. A ripple happens only when a well in super nova is destroyed, right after it is destroyed. No visual warning and no alert sound: just the ripple pushing ship and enemies, with one short wave sound (deep whoomp plus watery whoosh) at the wave start. src/core/pondRipple.ts now has POND_WAVE_WIDTH 160 and POND_WAVE_LIFE 3.2 (Fable); RIPPLE_WARN_SEC is deprecated, stop using it; Fable deletes it and 'sim:rippleWarn' at merge. Ryan chose the sound: a deep whoomp plus a watery whoosh that sweeps outward for about 1.5 s with the wave.

## Acceptance
- Remove the warn alert and the 'sim:rippleWarn' listener.
- On 'sim:ripple': a low sine or triangle thump (about 50 to 70 Hz, fast drop) followed by a filtered noise whoosh whose band sweeps down and fades over about 1.5 s, a little louder with strength, mixed so it is heard through combat but below a boss cue. Through the sfx master so effects volume and mute apply. Oscillators and noise only.
- Tests with a fake backend: no cue on rippleWarn, thump plus whoosh on ripple, length about 1.5 s, gain rises with strength, dispose. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-nova-ripple.md under 12 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
