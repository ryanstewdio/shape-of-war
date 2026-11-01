# Hand-off chorus: music-v34

Branch: feat/chorus-music-v34. Session: https://claude.ai/code/session_018Gwqi5gboeQuQJsLt3vNVt

## What changed
- New written song form (src/audio/music/compose.ts). Every tune has 4 bar A, B and bridge (C) phrases of lead notes in its own mode. The lead is the arp layer: pulse leads with a duty change in B, plus triangle, saw and two operator FM bell leads, slides, and delayed vibrato on held notes.
- Six level tunes rotate. They are all rewritten and all new compositions: Neon Drive (A aeolian 138), Glass Tide (B dorian 112), Ember Gate (E phrygian 144), Low Orbit (F mixolydian 126), and two new space pieces, Nebula Drift (D lydian 100, bell lead) and Event Horizon (C whole tone 108, augmented chords). Each loop has a 4 bar space breakdown (8 bars in the space pieces): no drums, held pads and bass, long echo and filtered noise wind. The space pieces have wind on every bar.
- The three battle tracks are rewritten too, as an A B A C form of 16 bars, minor modes (D harmonic, A phrygian, E dorian) at 120, 128 and 136 BPM. Intro hit, jump bass and the boss entry, phase and death stingers are unchanged.
- Chip pads: on chip tunes one pulse voice steps through the chord every half sixteenth, so a chord costs 1 voice instead of 3.
- Engine (engine.ts): pulse periodic waves, the FM bell, slides, vibrato, chip arpeggio, noise wind, and a slap echo plus a long dotted eighth echo with feedback, returning into the master lowpass. Echo adds no voices, and the music volume still governs everything.
- Kill notes (kills.ts): `killVariation(index, source)` is a stateless hash01 lane with no PRNG. It picks the length (staccato, a sixteenth or half a beat), one of 3 loudness levels and the echo (none, slap or long). About 1 kill in 4 plays a 3 or 4 note arpeggio of the bar's chord on one voice, and combo kills start it higher. Notes are always cut to the gate's room, and the gate, budget and ducking are unchanged.
- Variation by pass: a varied pass swaps the B lead for the hashed arp figure. On level tunes, passes 2 and 3 of every 4 move the A phrase an octave.

## Files touched
src/audio/music/{compose (new), tunes, track, engine, kills, scheduler, index}.ts. Tests in tests/audio/music were updated where they hard coded the old 120 BPM Am F C G default or the four tune layout; plainTune.ts is a new formless fixture.

## Tests added
variety.test.ts (9: no two tunes share a phrase contour, a phrase rhythm, an opening rhythm cell or a progression; own tempo, lead, mode), compose.test.ts (9), killVariation.test.ts (6: variation table, arpeggio builder, room), engineFx.test.ts (10), tunes.test.ts (+1 space breakdown), killsIndex.test.ts (+1 varied loudness in the loop).

## Test and build
npm run build: pass. npm test: 3412 pass, 1 fail, 1 todo. The failure is the accepted generator perf test ("200 levels under 350 ms", 396 ms in this VM). The audio suite has 524 tests, all passing. tests/qa level snapshots are untouched.

## Risks
- Battle tracks are no longer all 120 BPM, so Prism's 4 s cycle only sits on bar lines on Iron Verdict. Motifs are step based, so they still fit.
- A higher default tempo (138) moves the phase of integration tests. Two tests needed timing derived from the tune (not the code).
- The written lead holds notes, so resolutions find a free voice slightly less often (stress test bound 4 lowered to 2).

## Contracts for other roles
None changed. Music still only reads bus events; core events are untouched. TUNE_IDS gains 'nebula' and 'horizon' (select.ts handles 6 tunes as is).

## Device check for Ryan
1. Settings: music volume 50. Play Adventure levels 1 to 6 in a row. Each level should have a clearly different tune, tempo and lead sound.
2. In any level, wait about 30 to 40 seconds: the drums drop out for 4 bars into an echoing pad with wind, then come back.
3. Reach a level with the bell lead (Nebula Drift) or the eerie whole tone one (Event Horizon). They should feel slow and spacey.
4. Kill a stream of enemies: kill notes should vary in length, loudness and echo, and some should ripple as quick 3 or 4 note arpeggios. Fast combos climb higher.
5. Fight two bosses: each battle track should sound different, stay intense, and keep its entry hit and death stinger.
6. Set music volume to 0: no music or kill notes. Watch fps in a boss fight on Standard: the lowest should stay at 58 to 59.
