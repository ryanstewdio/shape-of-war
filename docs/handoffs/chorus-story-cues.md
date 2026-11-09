HAND-OFF chorus: story-cues
Branch: feat/chorus-story-cues  Head: see git log
Files changed: src/audio/storySfx.ts, src/audio/storySfxSynth.ts, src/audio/synth.ts, tests/audio/storySfx.test.ts
Tests added: tests/audio/storySfx.test.ts (7)
npm test: pass except the accepted generator perf test (851 ms vs 500 ms)  npm run build: pass
Verify: play a scene, hear the rising reveal, guardian drone, freed chord, panel shimmer; Skip fades within 0.25 s.
Dependencies requested: none
Requests: none
Known gaps: guardian uses a minor drone (root by scene id), not the boss motif, which lives in the music scheduler. Music is not ducked: the engine has no external duck hook, so it plays on under scenes.
