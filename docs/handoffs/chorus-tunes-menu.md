# Chorus hand-off: tunes-menu

Branch: feat/chorus-tunes-menu. Session: https://claude.ai/code/session_018Gwqi6aCccNBABZjxSNp9k

## What changed
- Four new level tunes, ten in rotation, all original, each with A, B, bridge, the S arpeggio section and the timed space breakdown:
  - Starfall Charge (heroic): G major, 148 BPM, brassy saw fanfare, octave bass, march kick.
  - Rust Foundry (dark industrial): F# phrygian dominant, 118 BPM, thin 12.5 percent pulse hammering low notes, locomotive sixteenth bass.
  - Aurora Veil (dreamy space): Bb lydian dominant, 104 BPM, soft FM bell in wide leaps, sine bass, wind on every bar, 8 bar breakdown.
  - Pixel Hop (bouncy chiptune): C# six note major, 132 BPM, hopping 25 percent pulse (square in B), oom pah bass, chip pad.
- Four new modes in compose.ts: ionian, phrygdom, lydiandom, hexmajor. Selection (select.ts) already scales to any tune count: any three consecutive levels still differ.
- Title and menu theme (menuTheme.ts): E lydian, 100 BPM. An 8 bar hook on a filtered 25 percent pulse over echoing pads, triangle bass and a soft kick, then a calm 8 bar loop on an FM bell with wind and the long echo. Fades in over 1.2 s, out over 0.6 s. One engine at a time; a return to the menu mid fade drops the fading one at once.
- Engine: new `fade(gain, sec)` linear master ramp. Every theme voice goes through the engine, so the tracking lead low pass, noise band limit, a 2.6 kHz master low pass, limiter and the synth tone stage all apply.
- index.ts: subscribes 'ui:screen' (title or menu start, settings keeps, play or results fade), 'game:start' and startMusic fade it, setMusicVolume forwards (0 stops at once), hidden tab stops it, uninstall stops it. New `menuThemeState()` for tests and the overlay.

## Files touched
src/audio/music/compose.ts, tunes.ts, engine.ts, index.ts, menuTheme.ts (new); tests/audio/music/menuTheme.test.ts (new), variety.test.ts, tunes.test.ts, tuneWiring.test.ts; this file.

## Tests
- menuTheme.test.ts: 14 tests (score form and tempo, hook vs calm voicing, lead in key and on beat chord tones, hook contour differs from every tune phrase, lifecycle reducer, player: start on title, settings keeps, 0.6 s fade on play, resume on menu, no double start incl. mid fade return, game:start and level start fade, settings from play stays silent, volume 0 silence and restart, audio unlock retry, hidden tab, uninstall leaves no timers).
- variety.test.ts: covers all 13 tracks (10 level, 3 battle) plus a v3.6 character test. tunes.test.ts and tuneWiring.test.ts updated for ten tunes and three space pieces.
- npm test: 3633 passed, 1 failed: the accepted generator perf test (200 levels in 386 ms vs 350 ms in this VM). Audio suite 629 of 629. npm run build: pass. v7 grep: clean. tests/qa untouched.

## Risks
- The theme only plays once Ledger emits 'ui:screen'. If title is emitted before wireMusic runs, the first title is missed until the next screen event.
- Before the first touch the audio is locked: the player retries every 250 ms while title or menu is up, then starts.
- Not heard on device yet: the hook gain and the 2.6 kHz cutoff are a first pass.

## Contracts for other roles
- Ledger: emit 'ui:screen' on every screen change, including the first title after wireMusic. No other glue change; 'game:start' and levelStart already fade the theme.
- No change to src/core/events.ts.

## Device check for Ryan
1. Set music volume to about 50. Open the app and tap once on the title. Within a second the theme fades in: a bright rising hook over soft pads and a gentle kick.
2. Stay on the menu for about 20 seconds. After 8 bars the drums drop out and a softer bell melody with wind takes over and keeps looping.
3. Open Settings. The theme keeps playing. Drag music volume to 0: it goes silent at once. Raise it again: it fades back in from the hook.
4. Back on the menu, start a game. The theme fades out in about half a second and the level tune starts. Nothing from the theme lingers.
5. Quit to the menu. The theme comes back once, not doubled.
6. Play several levels in a row: you should now hear new tunes, a fast heroic one, a dark grinding one, a slow dreamy bell one and a bouncy chip one, and no tune twice within three levels.
