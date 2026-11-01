# Hand-off chorus: mix-v35

Branch: feat/chorus-mix-v35. Session: https://claude.ai/code/session_018Gwqi6GQ3k29rpuMAq1WJj

## What changed
- Highs: new master tone stage after the synth master (high shelf -6 dB at 5 kHz, 9 kHz low pass, +1.5 dB makeup), so sfx and music both pass it. Square, saw and pulse voices (bed lead, chip pad, motifs, stingers, kill accents, sfx cues) get a low pass that tracks the note: 6x the pitch, capped at 5 kHz, floored at 700 Hz so low sfx sweeps keep their body. Every attack is at least 4 ms. Noise is band limited below 7 kHz (the hat moved from a 7 kHz high pass to a 4.5 to 7 kHz band; sfx and GW2 noise get a 7 kHz low pass).
- Why the breakdown was not heard: it sat at loop bars 8 to 11, about 14 to 19 s in. At that point threat is low, so the kick and hat were not playing and there was nothing to drop. The held bass kept going, and the pad and echo stayed at normal level behind the 450 to 900 Hz threat low pass. The next one was a whole loop later, and a runtime fill could turn its bars back into full bars.
- Breakdown now: placed by play time (breakdown.ts). The first starts 30 to 45 s in, then every 90 to 120 s, 4 bars each on a phrase line. Drums and bass fully drop, the pad rises (vel 1.8), the long echo swells (return 0.35 to 0.7, feedback 0.42 to 0.55) and the master low pass is held at 2.2 kHz or more. It beats any fill. Battle tracks never break down.
- Arpeggio: the loop's old S block is now a drive section with a 16th note lead run over the chord (up, down, up and down; the direction changes per 4 bar block and per pass). Held pad tunes arpeggiate the pad in the C section in sixteenths. Chip pads cycle in the same per block direction. Space pieces keep their wind.
- Second loop: every odd pass of a level tune changes the lead timbre (pulse to triangle, triangle or saw to a 25 percent pulse, bell to triangle). The A section's notes stay as written.

## Files touched
src/audio/tone.ts (new), src/audio/synth.ts, src/audio/gw2Synth.ts, src/audio/music/breakdown.ts (new), compose.ts, track.ts, engine.ts, index.ts (breakdown cutoff floor and echo swell only). Tests: tests/audio/tone.test.ts (new, 8), tests/audio/music/breakdown.test.ts (new, 11), tests/audio/music/arpeggio.test.ts (new, 7), plus updates to fakeAudio.ts (filter gain param), tunes.test.ts (old in-loop breakdown rule replaced) and tunesIndex.test.ts (pulse and triangle allowed in the bed waves).

## Tests and build
- tests/audio: 550 passed. Full npm test: 3494 passed, 1 failed. The failure is the accepted perf exception "generation is fast: 200 levels under 350 ms" (568 ms in this VM). npm run build: pass. Dash grep and v7 shim grep: clean. The variety signature test passes unchanged. tests/qa snapshots are untouched.
- The routing test drives the real synth and a real music session for all six tunes on a fake AudioContext. It walks the graph to check that every sfx and music source reaches the speaker only through the high shelf, and that every bright lead has its own tracking filter.

## Risks
- Loudness: about -1 to -2 dB in the presence band on bright leads; makeup is +1.5 dB. Triangle second loop leads are a touch softer than the pulse they replace.
- The breakdown restarts its timeline per tune span: an Endless rotation or a return from a boss bed starts a new 30 to 45 s count.
- The old in-loop S phrase now plays only inside timed breakdowns.

## Contracts for other roles
- None changed. Events untouched. New engine method setSpace(on, t) is internal to src/audio. BREAK_CUTOFF_HZ is exported from music/index.ts for tests.

## Device check for Ryan
1. Put earbuds in, set sfx and music to 50, and start any Adventure level. Fire and kill for a minute. Highs should sound softer, with no hiss or click on the hats or the lead. Explosions should keep their thump.
2. Keep a timer running. Between 30 and 45 seconds in, the drums and bass should stop for 4 bars. You should hear a louder pad with wind and a long echo on the lead, then the beat returns. Expect the next one 90 to 120 seconds later.
3. After the first loop (about 35 to 50 seconds), listen for a section where the lead plays fast 16th note runs over the chords. On a later pass the run's direction should change.
4. On the second loop the main melody should come back in a different lead sound (for example the square lead turning into a soft triangle).
5. Fight a boss: the boss track should have no breakdown.
