# Chorus hand off: battle polish

Branch: feat/chorus-battle-polish (from main 8a312ef)
Session: https://claude.ai/code/session_018Gwqi51KevzKtDahLjTxuF

## What changed
- Three keys, three feels, all still 120 BPM (a bar is 2 s, so Prism's 4 s window stays on bar lines). Each key is within a fourth of A, so boss motifs still fit:
  - Iron Verdict: D harmonic minor. Driving four on the floor doubled to eighths, claps on the off beats, dotted rising hook.
  - Black Meridian: A phrygian. Broken dotted kicks, pushed claps, repeated note stab hook.
  - Glass Requiem: E natural minor. Galloping paired kicks, leaping long note hook.
- Drums: 12 kick plus clap hits a bar on every track (6 on the busiest level tune). Bass: an octave jumping line (`bassJump`) on bars 4 and 8. Hook: a fixed one bar line (`hook`) the lead (arp) plays verbatim on bar 0 of every 8 bars.
- Intro hit: each track has a one bar signature of chord stabs (`intro`), played on the cross fade (join) bar as the battle bed comes in.
- Intensity, in battlePolish.ts:
  - Phase changes open the master lowpass (x1, 1.2, 1.45, 1.75) and add a drum layer (off beat hat accents from phase 2, clap ghosts from 3, one more at 4).
  - The open window (`sim:bossWindow`) ducks kick, clap and hats by 6 dB (x0.5) and lifts the hook (x1.4).
  - The defeat chord is now the track's own tonic major (D, A or E; A on a level tune); the level tune returns two bars later as before.
- Cues: `fx:weaponCombine` plays a rising root, third, fifth in the key playing, and `fx:weaponExpire` a falling fifth to third. `fx:droneArm` and `fx:droneExpire` are lighter: an octave up, quicker and softer. They are accent voices, each kind at most once per 0.3 s, subscribed by name, and an absent or odd payload is a no op.

## Files touched
src/audio/music: battlePolish.ts (new), tunes.ts, track.ts, index.ts
tests/audio/music: battlePolish.test.ts (new, 16), tunes.test.ts (key pin updated), bossIndex.test.ts (2 defeat chord expectations updated)

## Changed expectations (old to new)
- tunes.test: battle tracks were pinned to root 69 and tonic A. Now each has its own tonic, a root within 5 semitones of 69 and a minor third over its tonic, and three tonics differ.
- bossIndex.test: the defeat stinger was always [69, 73, 76]. Now it is the battle track's tonic major ([74, 78, 81] on Verdict, [64, 68, 71] on Requiem, [69, 73, 76] on Meridian).

## Tests and build
- Audio: 442 tests pass. npm run build: pass. The v7 API grep is empty and there is no Math.random in src/audio.
- npm test: 3086 passed, 1 skipped, 1 todo, 1 failed. The failure is tests/levelgen/generator.test.ts "200 levels under 350 ms", a wall-clock budget that also fails on unmodified main in this container. The existing tier 4 voice budget test passes with zero bed steals on all three tracks.

## Risks
- Verdict and Requiem moved off A. Boss motifs are refitted per note (within 6 semitones, existing test), but a motif in a far key may sound more bent than before.
- The intro hit plays as a stinger voice, and the cues as accents, so at the cap a cue can lose its voice to a motif (by design: the bed and boss keep theirs).
- The phase layer and window duck apply only while the boss lives on its battle track.

## Requests and dependencies
None. The cue events are already declared in src/core/events.ts.

## Open questions
- Should the defeat chord go back to A major on every track, or follow each track's key as now?

## Device check for Ryan
1. Start any boss fight: on the bar the music switches you should hear a punchy one bar chord hit, then a busier beat. Verdict hammers three stabs, Meridian leans low then climbs, Requiem rings a bell chord.
2. Fight three different bosses: each track should be clearly its own key, hook and beat, and the same hook should come back every 16 seconds.
3. When the boss's weak point opens the drums should drop back and the lead should step forward, then return when it closes.
4. Each boss phase should make the music brighter and busier.
5. Beat the boss: a bright major chord, two more bars, then the level music.
6. Grab a second weapon: a quick rising three notes. Let it expire: two falling notes. Drone pickups give a lighter, higher version.
