# Chorus hand off: time warn

Branch: feat/chorus-time-warn
- New src/audio/timeWarnSfx.ts (pure beep patterns plus installer for 'ui:timeWarn') and src/audio/timeWarnSynth.ts (square oscillators through the sfx master). Installed from installAudio in synth.ts.
- 60 s: two beeps at 880 Hz. 30 s: three quicker beeps at about 1047 Hz. 10 to 1 s: one tick, rising 2 semitones per second from 440 Hz; 3, 2, 1 louder (0.11 vs 0.08). Nothing at 0. All below boss cues (about 0.2).
- Tests: tests/audio/timeWarnSfx.test.ts (5 pass). npm test: all pass except the accepted generator perf test (719 ms vs 500). npm run build passes.
- Known gap: the event is emitted by Ledger; not verified on device.
