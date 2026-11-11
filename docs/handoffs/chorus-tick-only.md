HAND-OFF chorus: chorus-tick-only. Branch: feat/chorus-tick-only.
Removed the fx:hit handler in synth.ts, cueForHit, BOSS_KIND and RATE_LIMITS.bossHit; a guardian hit now plays only the music tick.
Kept the CUES.bossHit definition (and CueName 'bossHit'): tests/audio/bossTick.test.ts reads its gain and must stay untouched.
Tests: bossCues.test.ts now asserts no cue for fx:hit (damaging, blocked, 60 Hz); tick tests untouched.
npm test: pass except the accepted generator perf test; npm run build: pass.
