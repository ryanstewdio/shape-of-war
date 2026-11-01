# Hand-off Chorus: menu-themes

Branch: feat/chorus-menu-themes. Gate G6 (Ryan): 2 to 4 menu themes so the title music does not wear out.

## What changed
- Three original title and menu themes in the same calm spacey register, each with its own hook, mode, tempo and lead:
  - 0 Aurora: E lydian, 100 BPM, 25 percent pulse lead (the existing theme, now with a new B section).
  - 1 Tide: D dorian, 88 BPM, triangle lead with deep vibrato, sine bass, triangle pads.
  - 2 Orbit: A mixolydian, 112 BPM, filtered saw lead in eighths, wide detuned saw pads.
- Every theme loops A (hook, kick and hat), B (answer on a second lead colour, one kick a bar) and C (calm, wind, long echo, no drums), 8 bars each. The hook comes back every 24 bars, not every 8.
- Rotation: fixed order 0, 1, 2, 0. A new theme is picked at boot and on the first menu start after a level (screen play or results, game:start, or a level's music). Title to menu, settings, a hidden tab and volume changes keep the current theme. Never the same theme twice in a row. The pick happens only when the theme really starts (after the audio unlock), and is saved then.
- Persistence goes through an injected `MenuThemeStore` ({ load(): string | null; save(raw) }). The tests/qa storage audit allows localStorage and `sow.` keys only in src/core/settings.ts, so audio names no key. Until main.ts wires a store (see Requests), the default store is memory for one page load: the rotation works per session but restarts at Aurora on each boot.
- Score tables are built once per theme at load; nothing is allocated per step while a theme plays.

## Files touched
src/audio/music/menuTheme.ts, src/audio/music/index.ts (MusicOptions.menuStore; menuThemeState() gains `theme`), tests/audio/music/menuTheme.test.ts, this file.

## Tests added
menuTheme.test.ts now has 26 tests (was 13). New tests: three themes at 85 to 115 BPM; the A B C form with no hook repeat at bars 8 or 16; section textures; key and chord fit for all three; variety signatures (mode, tempo, tonic, lead, hook contour and rhythm all distinct); no hook contour shared with any level or battle tune; rotation order and no immediate repeat; stored index parsing; the stored index carried across boots through a store; rotation only after a level; locked audio; a store that throws or is null; the session default store; each theme at its own tempo. The lifecycle tests are unchanged and pass.

## Test and build
npm test: 268 files, 3802 passed, 1 todo, 0 failed. npm run build: pass. tests/qa snapshots are untouched.

## Requests (outside my ownership)
1. src/core/settings.ts (Ledger): add `MENU_THEME_KEY = ${SETTINGS_PREFIX}menuTheme` with `loadMenuTheme(): string | null` and `saveMenuTheme(raw: string)`, the raw value "0" to "2" (audio's parseMenuTheme validates it).
2. src/main.ts: pass `menuStore: { load: loadMenuTheme, save: saveMenuTheme }` to initMusic.
3. tests/qa storageKeys and storageKeysV3 (Proctor): register sow.settings.menuTheme.

## Contracts
menuThemeState().theme is -1 before the first start, otherwise the theme index. No event or core change.

## Risks
Orbit's saw lead is the brightest; it goes through the lead low pass and the 2600 Hz master low pass, but check it on the phone speaker. Until Request 2 lands, every boot starts on Aurora.

## Device check for Ryan
1. Open the app with music on. The title plays a theme: Aurora floats on a thin buzzy pulse, Tide is slower and soft with a wavering flute-like lead, Orbit is quicker with circling eighth notes.
2. Stay on the menu for about a minute. The drums lighten after the opening tune, then drop out under wind and slow tones, then the opening tune returns. It should not restart every few seconds.
3. Open Settings and come back: the same theme keeps playing.
4. Start a level, then quit or finish back to the menu: a different theme plays. Do this twice more: you hear all three, never the same one twice in a row.
5. After Request 2 lands: close the app fully and reopen it. The title plays the theme after the last one you heard.

Session: https://claude.ai/code/session_018Gwqi51Q7zjnaS7NE2GpMv
