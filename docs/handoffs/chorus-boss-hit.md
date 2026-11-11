HAND-OFF chorus: boss-hit
Branch: feat/chorus-boss-hit
Added src/audio/bossTick.ts (params, 12/s and 6/s window limiters, 'sim:bossHit' controller), bossTickSynth.ts (sine blip via lowpass into the sfx master), wired in synth.ts.
Landed: 30 ms tick, gain 0.035. Blocked: duller 50 ms thunk, gain 0.02. Tests: tests/audio/bossTick.test.ts.
Known gaps: the existing fx:hit bossHit cue still plays alongside the tick; not changed (brief scope).
