HAND-OFF Ledger: fp-setup
Branch: feat/ledger-fp-setup  Head: 0687114 (code; this file is the next commit)
Files changed: src/core/settings.ts, src/main.ts, src/ui/{freePlay,freePlayRun,results,hud,flow,dom}.ts, docs/13 key table row, tests/qa/storageKeys.test.ts, tests/qa/storageKeysV3.test.ts, tests/ui/r2Flow.test.ts
Tests added: tests/settings/freePlay.test.ts (11: round trip of every value, per field validation, bad JSON, throwing storage), tests/ui/freePlaySetup.test.ts (15: every control writes only its field, drift row drum only, enemy grid All/None/toggles, Start passes the config to freePlayLevel and GameOptions.freePlay, "Score attack 5:00" results, HUD infinity sign). Storage audits register sow.settings.freePlay.
npm test: 4443 pass, 1 fail (generator "200 levels under 500 ms", the accepted perf exception, levelgen untouched)  npm run build: pass
v7 grep: empty.

What changed
- Setup screen sections: Difficulty; Arena (type, size, barriers); Enemies (12 toggles with neon icon and name, All, None, density); Rules (lives 1, 3, 5, infinity; length Endless, 3, 5, 10 min); Loadout (weapon None or four, pickups, drone, super); Hazards (bosses Off, Every 3 min or one of ten; wells; drum drift shown only for the drum). Sections scroll in a body; Start and Back sit in a fixed footer.
- None picked stores enemies [] (normal Endless mix, a note says so); All stores all 12 kinds explicitly.
- sow.settings.freePlay holds { arena, barriers, config }, validated field by field; difficulty stays in sow.progress.difficulty. Saved on Start, loaded at boot.
- buildFreePlayRun passes freePlayLevel({ arena, barriers, seed, config }) and GameOptions.freePlay = config through typed shapes (FreePlayLevelOptions, FreePlayGameOptions) until Foundry and Forge land.
- Results: a timed run reads "Free Play  Score attack 5:00  <arena> arena" with the score; title "Time up" when the sim outcome is won, else "Game over". HUD lives show "▲ ∞" for infinite lives; the HUD line counts down "m:ss left" in a score attack.

How to verify on device
1. Menu, Free Play. On the folded cover screen, swipe the options up and down: they scroll, Start and Back stay visible at the bottom.
2. Pick Circle, then Drum: the Drum drift row appears only on Drum.
3. Tap None: every enemy dims and the note shows. Tap Grunt and Dart: only those light up.
4. Pick lives infinity, length 3 min, start. The HUD lives read a triangle and infinity sign, the top line counts down to 0:00 left.
5. When the clock runs out, results read "Score attack 3:00" with the score.
6. Back to Free Play: the last choices are still marked. Close and reopen the app: still marked.

Dependencies requested: none
Requests (changes outside my ownership): Forge: GameOptions.freePlay (lives Infinity in hud:score or my setInfiniteLives covers it; outcome 'won' on time up). Foundry: FreePlayOptions.config. Until both merge the config is carried but has no effect in play.
Known gaps: the HUD countdown uses world.time, not Forge's exposed time left; switch once Forge lands. Bosses row is 12 wrapping buttons, could become a picker.
