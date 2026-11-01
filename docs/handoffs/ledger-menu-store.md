# Hand-off Ledger: menu-store

Branch: feat/ledger-menu-store. Closes Requests 1 to 3 of docs/handoffs/chorus-menu-themes.md.

## What changed
- src/core/settings.ts: `MENU_THEME_KEY` (`sow.settings.menuTheme`), `loadMenuTheme(): string | null`, `saveMenuTheme(raw)`. Same `readRaw` and `writeRaw` try/catch helpers as the other keys. The raw text is stored as is; audio validates it.
- src/main.ts: `wireMusicPort` now passes `menuStore: { load: loadMenuTheme, save: saveMenuTheme }` to `wireMusic`.
- Key registered in tests/qa/storageKeys.test.ts, tests/qa/storageKeysV3.test.ts and the docs/13 key table.

## Files touched
src/core/settings.ts, src/main.ts, tests/settings/menuTheme.test.ts (new), tests/qa/storageKeys.test.ts, tests/qa/storageKeysV3.test.ts, docs/13-v3-spec-addendum.md (key table row only), this file.

## Tests added
tests/settings/menuTheme.test.ts: 4 tests (key spelling and prefix, null when empty or no storage, round trip of "0" to "2", throwing and null storage). Storage audits updated: declared set, run time write set, V3 key list.

## Test and build
npm test: 270 files passed, 2 failed, 3853 passed. npm run build: pass. v7 grep: prints nothing.
- tests/levelgen/generator.test.ts "200 levels under 350 ms": 474 ms in this VM (accepted perf exception).
- tests/ui/musicFlow.test.ts line 295 fails because of my main.ts change (see Requests).

## Risks
Reads happen once when the theme starts; no per frame work. If storage is blocked the rotation restarts on Aurora each boot, as before.

## Contracts for other roles
Stored value is the text "0", "1" or "2". No event or core change. No new key besides menuTheme.

## Requests (outside my ownership)
tests/ui/musicFlow.test.ts line 295 (Proctor or Fable): the regex ends in `wireMusic\(bus, \{ volume \}`. Change it to `wireMusic\(bus, \{ volume, menuStore`. I did not edit it.

## Device check for Ryan
1. Install the new build and open it with music on. Note which theme plays on the title.
2. Start a level, quit back to the menu, and note the new theme. Repeat once so you have heard two different ones.
3. Close the app fully (swipe it away) and reopen it. The title should play the theme that comes after the last one you heard, not always the first (Aurora).

Session: https://claude.ai/code/session_018Gwqi6vkdbCnKnc4qd4QG6
