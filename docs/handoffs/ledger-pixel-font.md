# Ledger hand-off: pixel font

Branch: feat/ledger-pixel-font (base 36a33cf)

- src/ui/vectorFont.ts: the line glyphs are replaced by an original 5 x 7 pixel arcade font drawn in code (A to Z, 0 to 9, . , : ! ? - + / % # x space, hollow box fallback). Each line is one SVG path of square cells, shape-rendering crispEdges, plus the same path 1 cell down and right as the drop shadow (same hue, 24% lightness, alpha 0.5, never black). Glow and colours still come from syncVectorFontStyle on onNeonChanged; nothing new in main.ts.
- Whole px cells: cell = round(font px / 10), at least 1 (cellPx). dom.ts sizes the SVG with CSS round() to match, with an em fallback where round() is missing. PIXEL_SITES lists every call site size range; tests check each integer size.
- Call sites unchanged: title (splash, boot, menu), intro and results headlines, results score, Par reached, Start, Next or Retry, Menu, Details.
- menu.ts: TITLE_EMS 8.4 to 8.9 so the pixel title fits after rounding (worst case 25 px).
- hud.ts: the HUD score is plain text again: font size round(box size x 1.15) capped at the box height (cover 23 px, main 32 px), weight 800, tabular-nums. hudScoreFits checks 99,999,999 fits both screens.
- Accessibility unchanged: aria-hidden SVG, host aria-label and hidden span.

Tests: tests/ui/vectorFont.test.ts rewritten (26): grid coverage, full height letters and digits, unique bitmaps, integer cells per site, title fit, shadow colour, headlines expose text, HUD plain font, size and fit.
npm test: 4649 pass, 1 fail (levelgen speed check, accepted perf exception, also fails on main). npm run build: pass. Banned API grep: empty.

Verify on device:
1. Cover screen: menu title, then a level intro and results. Letters are square cells with a soft shadow, no blur.
2. Unfold: same screens on main, cells still sharp.
3. Mid fight on both screens: the HUD score is plain, heavy and steady as it climbs.

Known gaps: the CSS round() path needs Chrome 125 or later (older falls back to em sizes, cells may blur).
