HAND-OFF Chorus: ripple
Branch: feat/chorus-ripple
Files changed: src/audio/rippleSfx.ts, src/audio/rippleSynth.ts, src/audio/synth.ts (installAudio wiring), tests/audio/rippleSfx.test.ts, this file
Tests added: tests/audio/rippleSfx.test.ts (5): alert length and climb, gain clamp and rise, warn on warn only, splash louder with strength, dispose removes listeners
Test result: tests/audio all pass; full npm test 4778 pass, 1 fail (generator perf, 200 levels 671 ms vs 500 ms, the accepted exception); build ok
Exports for wiring: installRippleSfx(bus, backend), createRippleBackend(deps); already wired in installAudio
New dependencies requested: none
Verify on device: 1. Trigger a pond ripple. 2. A rising six step square alert (about 0.75 s) plays 1 s before the wave. 3. A low watery bloop with a falling noise tail plays at the wave start, louder for stronger ripples. 4. Mute and sfx volume silence both.
Known gaps: no pan, since existing cues do not pan by position; strength is assumed to be 0 to 1 and is clamped; the sim emitting the events is Forge's parallel work.
