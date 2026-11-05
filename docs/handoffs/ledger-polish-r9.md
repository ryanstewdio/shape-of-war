HAND-OFF Ledger: polish-r9
Branch: feat/ledger-polish-r9  Head: see git log
Files changed: src/ui/howTo.ts, src/ui/menu.ts, src/ui/freePlay.ts, src/ui/intro.ts, src/ui/vectorFont.ts, tests/ui/{howTo,menu,intro,freePlaySetup}.test.ts, this file
Tests added: 5 in howTo (colours, tones, screen paint, leadWord), 1 intro, 1 menu, 1 freePlaySetup; menu tests updated for six rows
npm test: pass except tests/levelgen/generator.test.ts timing (accepted perf exception)  npm run build: pass
How to verify on device:
1. How to page 2: Survive, Destroy, Score, Boss each glow a different colour.
2. Pages 3 to 5, 7 and 9: super kinds, weapons, drones, drone modes, hazards and difficulties each show distinct colours.
3. Start Endless: the intro card has no New enemies block (Adventure cards keep it).
4. Main menu: all labels in the pixel font, How to directly above Settings; check the cover screen fits.
5. Free Play setup: Back is pixel font like Start.
Dependencies requested: none
Requests (changes outside my ownership): none
Known gaps: weapon combo lines and enemy names are not colour coded (not in the brief's list). Cover screen footer moved into the title column and a compact tier added so six rows fit.
