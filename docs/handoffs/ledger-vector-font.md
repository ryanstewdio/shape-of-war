# Hand-off Ledger: vector-font

Branch: feat/ledger-vector-font. An original vector stroke font drawn in code for headlines only. No font files.

## What changed
- src/ui/vectorFont.ts: a 4 x 6 grid stroke font with chamfered corners, one stroke width and arcs in 0, 2 and ?. It covers A to Z, 0 to 9, `. , : ! ? - + / % # x` and space. Unknown characters draw as an open box. Lower case draws as capitals. A lower case x with no letter beside it ("x3") draws as a small multiply sign. `layoutVector(text, size, letterSpacing)` is pure and returns the path data and width. `setVectorText(host, text)` draws an aria-hidden inline SVG and adds an aria-label plus a visually hidden span.
- Neon: `syncVectorFontStyle(saturation, glowAlpha)` builds the stroke colours from BASE_PALETTE and a drop shadow glow from the neon state. main.ts calls it from onNeonChanged, the same way it handles the 4th star. Nothing sets a neon value.
- In use: splash, boot and menu title (SHAPES OF WAR), intro title (LEVEL 12, Ready), results headline (Victory in green, Defeated in red, others in cyan), the big results score, Par reached (yellow), Free Play title, and the Start, Next, Retry, Menu and Details buttons (Details draws its + or -). The HUD score is vector too: at 20 px on the cover screen the cap height is 14.4 px and 99,999,999 fits the 136 px box (tested).
- tests/ui/fakeDom.ts: createElementNS, and replaceChildren now sets textContent the way the real DOM does.

## Tests
- New: tests/ui/vectorFont.test.ts (21 tests). Covers glyph coverage, paths and positive advances, the grid bounds, the fallback box, monotonic width, the x rule, the neon CSS, text exposed by every headline, and HUD fit and readability.
- npm test: 4640 passed and 1 failed. The failure is the levelgen "200 levels under 500 ms" timing test, the accepted perf exception. npm run build passes. The v7 grep prints nothing.

## Device check
1. Cold open: SHAPES OF WAR pulses in cyan line lettering on black, and the same lettering shows on Tap to start and in the menu panel. On the cover screen the title should fit its left column.
2. Start level 1. The card title reads LEVEL 1 in line lettering and Start is drawn the same way. Chips and body text keep the old font.
3. Play a level. The top left score uses the line digits and stays sharp and readable on the cover screen.
4. Win: VICTORY in green, the big score in cyan, PAR REACHED in yellow, then NEXT, MENU and DETAILS +. Tap Details: it changes to DETAILS -. Lose a level: DEFEATED in red, then RETRY.
5. Settings, Neon to 0 and then 100: the lettering glow follows, faint at 0 and strong at 100.

## Known gaps
- Back (Free Play), Paused, Settings, Level select and the menu rows keep the old font, as the brief scoped.
- The boot screen title also uses the vector font, because it is the same SHAPES OF WAR title.
