# Chorus: scroll-tick

Create and check out branch feat/chorus-scroll-tick before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/ (new src/audio/scrollTick.ts, installed from installAudio in src/audio/synth.ts next to installTurboSfx), tests/audio/
Do not touch: src/ui/ (Ledger works there in parallel and emits the event), src/core/events.ts (the 'ui:scroll' event is already stubbed by Fable), src/game/, src/render/, docs/ other than your hand off
Read first: src/core/events.ts ('ui:scroll'), src/audio/synth.ts (installAudio, master gain, setVolume), src/audio/turboSfx.ts (installer and backend pattern to copy)

## Goal
Tester 2 asked for "some kind of cool retro scrolling noise" when info screens scroll. Ledger emits 'ui:scroll' { delta, progress } at most once per frame.

## Acceptance
- installScrollTick(bus, backend) returns { dispose }. Accumulates |delta|; one tick per 48 CSS px scrolled, at most 8 ticks per second (extra distance is dropped, not queued).
- Tick: a 20 to 30 ms square or pulse blip, 8 bit style, pitch steps up with progress (about one octave from top to bottom, quantised to a pentatonic scale), quiet: peak well below the existing ui or geom cue. Goes through the same master gain as other effects so the effects volume and mute apply; silent when the audio context is not running.
- No sample files. Oscillators only. No new dependency.
- Tests with a fake backend: tick count for a given scroll distance, rate cap, pitch rises with progress, dispose removes the listener. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/chorus-scroll-tick.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic sim untouched. No em or en dashes.
