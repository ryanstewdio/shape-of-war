# Chorus: story-cues

Create and check out branch feat/chorus-story-cues before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/audio/ (new src/audio/storySfx.ts installed from installAudio in src/audio/synth.ts), tests/audio/
Do not touch: src/ui/ (Ledger builds the scene player in parallel), src/core/events.ts ('ui:story' is stubbed by Morpheus), everything else
Read first: docs/19-story-bible.md section "Panel spec for the builder" (Sound), src/core/events.ts ('ui:story'), src/audio/synth.ts, src/audio/rippleSfx.ts and src/audio/scrollTick.ts (installer patterns), the boss motif code in src/audio/music (read only)

## Goal
Synthesised sound for the story scenes: mythic, calm, family safe.

## Acceptance
- On 'ui:story' phase start: type opening and briefing get a soft rising reveal tone; type guardian gets a low, slow version of that guardian's boss motif or a minor key drone if the motif cannot be reused cleanly; type freed gets a warm major chord that blooms as colour returns.
- On phase panel: a quiet soft tick or shimmer (not on every typewriter character).
- On phase end: everything fades out within 0.3 s; skip never leaves a hanging note.
- No sudden loud cues; peak below the boss death cue; through the sfx master so volume and mute apply; music ducks while a scene plays if the engine supports ducking, otherwise leave music alone and say so.
- Oscillators and noise only, no files, no new dependency.
- Tests with a fake backend: cue per type, panel tick, fade on end and skip, dispose removes listeners. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/chorus-story-cues.md under 12 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
