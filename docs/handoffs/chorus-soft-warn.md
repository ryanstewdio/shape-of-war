HAND-OFF chorus: soft-warn
Branch: feat/chorus-soft-warn
Files: src/audio/timeWarnSfx.ts, src/audio/timeWarnSynth.ts, tests/audio/timeWarnSfx.test.ts
60 and 30: one sine or triangle chime (330 and 440 Hz, gain 0.04). Countdown 5 to 1 only: sine tick 220 to 330 Hz, gain 0.025, 3 to 1 at 0.032. Nothing for 10 to 6 or 0.
Synth: soft attack ramp, exponential decay, through the sfx master as before.
Tests: 6 in timeWarnSfx.test.ts. npm test pass (713), npm run build pass.
Requests: none. Dependencies: none. Known gaps: not heard on device.
