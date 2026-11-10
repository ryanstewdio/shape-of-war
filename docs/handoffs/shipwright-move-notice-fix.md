# Hand-off: shipwright move-notice-fix

Branch: fix/shipwright-move-notice-fix

## What changed
- The move banner is now a compact strip at the top of the menu screen (top inset respected), not the bottom, so it no longer sits on Settings.
- The strip has two parts: the text button (taps open https://play.shapelegend.com/) and a close X (MIN_HIT_PX square, "X" glyph). Tapping X removes the strip for the rest of this page load (module memory only, no storage, no network).
- Font stays 12px, padding is smaller than before (6px 10px). Below 1100 px viewport width the visible text is a shorter wording so it fits one line on the cover screen and at most two on phones. The full text stays in the aria-label.
- menu.ts is untouched; its one addMoveNotice call is unchanged.

## Files touched
src/ui/moveNotice.ts, tests/ui/moveNotice.test.ts, this file.

## Tests added
tests/ui/moveNotice.test.ts: 14 tests in total. The 2 hostname tests are kept. New: moveNoticeText width choice (1), add one banner at top with a close control of at least MIN_HIT_PX (1), tap text opens the URL and keeps the banner (1), tap close removes it and a later call adds nothing (1), second call adds nothing (1), non github.io host adds nothing (1), and 6 clearance cases against the real menuLayout.
The repo has no jsdom and no new dependency is allowed, so the DOM tests use a small FakeEl subclass (tests/ui/fakeDom.ts) instead of jsdom.

## Test and build
- npm run build: pass. The Pixi v7 grep prints nothing. No em or en dashes in the files I wrote.
- npm test: 5017 passed, 1 failed. The failure is tests/levelgen/generator.test.ts "generation is fast: 200 levels under 500 ms (flag on)" (829 ms on this machine), a wall-clock check unrelated to this change (also failed in the previous hand-off).

## How the strip avoids the title row and controls, per aspect class
The title is not a control. The controls are the six menu rows. The tests compute real layouts with menuLayout.
- Main class (stack, aspect under 1.8; Fold inner, phone portrait): the rows sit in the centred panel with at least 44 px free above the first row at 790x820 and 412x915 (top inset 24). The whole strip, X included, ends above the first row.
- Cover class (side, aspect 1.8 or more; Fold folded, phone landscape): the first row starts at about y=37 at 960x412, so a 44 px strip would clip it. The text part is therefore one compact line (about 29 px) and ends above the first row. The X is 44 px tall and hangs in the right margin, which lies outside the rows column (tested at 960x412, 742x412, 844x390). It only touches the panel's decorative outline.

## Risks
- Not seen on a device. The 29 px line height assumes the short text fits on one line at 960 wide; if a font renders wider it wraps to two lines (44 px) and its bottom would reach 7 px into the first row on 960x412.
- 780x360 phones in landscape have the first row at about y=40, below the 29 px line but under 44 px, which only matters if the text wraps.
- At portrait widths under about 360 px the short text may need three lines; maxHeight clips it to two.
- The panel's outline glow can sit under the strip on the cover screen. It is decorative only.

## Open questions
- The short wording ("New home: play.shapelegend.com. Tap to open it there. Progress here does not carry over.") is mine; swap it if you prefer other copy. It drops the add-to-home-screen sentence on narrow viewports.

Session: https://claude.ai/code/session_018Gwqi5a2uRtpJQqsMwTw6i
