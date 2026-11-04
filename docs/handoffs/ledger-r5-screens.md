HAND-OFF ledger: r5-screens
Branch: feat/ledger-r5-screens  Head: a878b0b (code; this hand off is the next commit)
Files changed: src/ui/results.ts, src/ui/intro.ts, src/ui/details.ts (new), src/ui/dom.ts, src/ui/flow.ts, src/main.ts; tests/ui/results.test.ts, intro.test.ts, freePlayWells.test.ts (new), boss.test.ts, stars.test.ts, freePlayRun.test.ts
Tests added: results.test.ts rewritten (21: labels, tick bar, Details collapsed by default, no dev values outside Details, 24 px CSS); intro.test.ts (+4: R5 order, Details collapsed with loadout and seed, no seed outside Details, CSS); freePlayWells.test.ts (2 + 1 todo for Foundry)
npm test: 4508 pass, 3 fail: tests/game/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (excepted, Forge), tests/levelgen/generator.test.ts "200 levels under 500 ms" (timing; fails on unmodified main in this container too)  npm run build: pass
How to verify on device:
1. Play any Adventure level to the end. Results read top to bottom: Victory or Defeated, the level line, "Difficulty Normal"; then Score, the big score, "Par 3.3M", a bar with 1, 2 and 3 star ticks labelled with their targets and a white marker at your score, "Stars earned" and "Normal: up to 2 stars"; then "Best" with its stars; the par reward if earned; Next and Menu.
2. Check there is clear space between every block and nothing sits on the card border, folded and unfolded.
3. "Details +" sits at the bottom and is closed. Tap it: Time, Kills, Geoms, Best multiplier, Space physics, Seed, Level code, Build, each a label then a value. Retry and finish again: Details is closed again.
4. Start a level: the card shows the title, Goal and Victory, Star targets, New enemies, Difficulty chips and Start, then a closed "Details +" holding Drone, Super, Reward (if any) and Seed. Check on the cover screen that nothing touches the card edges.
5. Endless and Free Play results: score and Best (Endless only), rest in Details.
Dependencies requested: none
Requests (changes outside my ownership):
- Foundry (level side), Free Play wells: the UI and sow.settings.freePlay round trip Off then Normal correctly (test proves the run's config and def.freePlay.options carry wells normal). The cause is freePlayLevel: it places wells only for 'many'; 'normal' and 'off' both give hazards.wells = [], and Endless segments carry none. Also src/game/wellArrival.ts skips arrivals when mode is endless (Forge), so Normal can never gain wells in play. Normal needs its own placement (or arrivals enabled for Free Play Normal). Flip the it.todo in tests/ui/freePlayWells.test.ts when done.
Known gaps:
- starCapLine now reads "up to" on the intro too (was "max").
- Boss bonus and Space physics moved into Details per "everything else".
- Endless and Free Play results now also show Kills, Geoms, Best multiplier and Build in Details; Free Play shows its seed.
- Best multiplier is sampled after every sim step in main.ts (scoring keeps no peak).
