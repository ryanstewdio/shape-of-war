HAND-OFF ledger: polish-r10
Branch: feat/ledger-polish-r10  Head: see git log
Files changed: src/input/buttonLook.ts, src/ui/hud.ts, hudFrame.ts, howTo.ts, pause.ts; tests in tests/input, tests/ui
Tests added: buttonLook (pulse, charge and full paint), hudButtons (charge colour, READY, glow), howTo (page 3 to 5 tones), cueFlow (pause pixel title)
npm test: pass except generator 200 levels perf (accepted exception)  npm run build: pass
How to verify on device:
1. Start a level; the super button fills from the bottom in cyan over a dim yellow disc.
2. At full charge the button pulses at 1 Hz, brighter glow, label reads READY.
3. How to pages 3, 4, 5: each section title has its own neon colour.
4. Pause: title is in the pixel font.
Dependencies requested: none
Requests (changes outside my ownership): none
Known gaps: pulse repaints on a 50 ms timer in the HUD while full; the timer stops when not full or on hide.
