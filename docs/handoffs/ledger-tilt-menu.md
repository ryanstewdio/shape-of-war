# Hand-off: ledger tilt-menu

Branch feat/ledger-tilt-menu. Session: https://claude.ai/code/session_018Gwqi45fZeLw3iwjM8ih4Q

## What changed
- New setting sow.settings.tilt (off, low, high, default off) in src/core/settings.ts: TiltSetting, TILT_SETTINGS, TILT_KEY, parseTilt, loadTilt, saveTilt. Kept out of Settings and DEFAULT_SETTINGS like effects.
- Settings screen row "3D tilt" with Off, Low, High, same choice-row style as Effects. The model calls the new setTilt effect at boot and once per changed level. It works while paused because the settings screen already opens from pause.
- main.ts maps the effect to setTilt from src/render/tilt.ts.
- New src/ui/screenEvent.ts: pure uiScreenOf and createScreenAnnouncer. main.ts emits 'ui:screen' after boot paint and after every dispatch, once per change.
- Mapping: boot is title; menu and level select are menu; playing and paused are play; settings; results. Pause and resume therefore emit nothing (still play). Settings opened from pause emits settings, then play on return.

## Files touched
src/core/settings.ts, src/ui/settings.ts, src/ui/screenEvent.ts, src/main.ts, tests/settings/tilt.test.ts, tests/ui/screenEvent.test.ts, tests/ui/settings.test.ts

## Tests added
- tests/settings/tilt.test.ts (4): key, default, round trip, junk, boot and change effect calls, labels.
- tests/ui/screenEvent.test.ts (7): sequences for boot, menu, start, pause, resume, results, retry, back to menu, level select, settings from menu and pause, quit, plus a main.ts wiring check.
- tests/ui/settings.test.ts: existing assertions updated for the new row and field (4 row count and order checks, 5 state shapes, boot push order).
- tests/qa/storageKeysV3 already allowed the tilt key and passes unchanged.

## Test and build
npm test: 3565 passed, 1 failed (the known generator perf test "200 levels under 350 ms", VM timing). npm run build: pass. V7 grep: empty.

## Risks
- Paused maps to play, so Chorus gets no event on pause. Chorus should use game:pause and game:resume for that.
- The add_repo call named in the brief is not available in this session; no remote was configured.
- setTilt in src/render/tilt.ts is Glow's; this branch only calls it.

## Contracts for other roles
- Chorus: listen to bus 'ui:screen' { screen }. title and menu play the menu theme. First event is title at boot.
- Glow: setTilt(level) is called at boot with the stored level, then on each change.

## Device check for Ryan
Open the app and tap through to Settings from the menu. Find the row "3D tilt" under Effects and confirm Off is lit. Tap High, then Low, and confirm the lit button follows your tap. Close the app fully and reopen it, go to Settings again and confirm your last choice is still lit. Start a level, pause, open Settings from the pause screen, change the tilt and go back: the change applies live once Glow's projection is merged.
