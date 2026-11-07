HAND-OFF ledger: scrollbar
Branch: feat/ledger-scrollbar  Head: code 4d6b53d, this hand-off on top (see git log)
Files changed: src/ui/scrollbar.ts (new), src/ui/dom.ts (CSS), src/ui/{settings,intro,results,freePlay,howTo}.ts (one attach line each)
Tests added: tests/ui/scrollbar.test.ts (new, 17: hidden when fits, shown on overflow and on content growth, thumb size and position, colour step at 0, 0.5, 1, hot then settle, MORE hide and return, emit coalescing, drag and page, mouse ignored, detach, CSS). No jsdom in the repo and no new dependency, so it uses a local scroll aware fake DOM.
npm test: 4766 pass, 1 fail (accepted generator perf timing, 525 ms of 500)  npm run build: pass  v7 grep: clean
Look: 6 px square cells at an 8 px pitch in a 10 px touch strip, 3 px inside the right padding; thumb in whole cells, min 24 px, moves in 8 px steps. Hue bands top to bottom: cyan, purple, magenta, yellow, green; brighter with a wider glow for 260 ms after each scroll. Colours from BASE_PALETTE at getNeonState saturation and glow, refreshed by onNeonChanged. How to and Free Play bodies get 14 px right padding so the bar never covers text.
How to verify on device:
1. Open How to: pixel bar at the right, blinking arrow plus MORE at the bottom right. Swipe up: MORE goes, thumb steps and changes colour, flashes brighter, settles.
2. Drag the thumb: content follows. Tap the track above or below it: pages one screen.
3. Turn a How to page: MORE comes back. Repeat on Free Play setup, Settings, level intro and results on the cover screen; on a screen that fits, no bar.
4. Change Neon: bar colours follow.
Dependencies requested: none
Requests (changes outside my ownership): none. 'ui:scroll' used as stubbed; screens import the core bus singleton, so main.ts needs no change.
Known gaps: pause has no scroll container (title and buttons only), so it gets no bar. Programmatic scrolls (a How to page turn resetting to the top) also emit ui:scroll, so audio may tick once there. MORE can sit over the last visible line of text (never over a tap, pointer-events none).
