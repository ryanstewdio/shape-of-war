# Hand-off Ledger: r6-layout

Branch: feat/ledger-r6-layout. Gate R5 feedback on results 3.75 and intro 3.75, plus par on Easy.

## What changed
- Details toggle (intro and results) is now `sow-big` like Next and Menu: same size, 2 px border and glow. It is still collapsed by default; open or closed shows only as the "+" or "-" suffix.
- Difficulty: the results headline shows a chip with the setting alone ("Easy"; Insane glows magenta). On the intro, the "Difficulty" label above the chips is gone.
- Intro: Goal and Victory sit in a two column grid, labels on the left and statements on the right, baseline aligned. The title is "Level 12" (Endless: "Endless"). Arena type and size ("Circle 900 x 860") are the first Details row.
- Par and stars follow difficulty: `targetsFor(level, d)` in src/core/stars.ts multiplies par and the three targets by `DIFFICULTY[d].parScale`. main.ts uses it for the HUD level line, the HUD star line, the intro targets, the results par, bar and scored stars, and so the saved best stars. Game over rescores stars from `p.score` against the scaled targets, because the sim's `p.stars` reads the level's own. The boss bonus stays on `level.par`, the amount the sim actually paid.

## Tests
- New: tests/ui/r6Layout.test.ts (14 tests, stubbed parScale table).
- Updated: intro, results and stars tests for the new title and chip text.
- npm test: 4584 passed, 1 failed. The failure is the levelgen "200 levels under 500 ms" timing test, the accepted perf exception (levelgen untouched). npm run build passes. The v7 grep prints nothing.

## Device check
1. Start level 1 on Easy. The title reads "Level 1" only. Goal and Victory labels sit left of their sentences, lined up. The chips have no "Difficulty" word above them.
2. Tap Details on the card. Arena with type and size is the first row. The button matches Start in height, border and glow.
3. Play to the end. The results show an "Easy" chip under the level line, no "Difficulty" word. Details looks like Next and Menu and opens on tap.
4. With every parScale still 1, par is unchanged. Once Foundry lands values, Easy par and ticks shrink on the intro, HUD and results.

## Known gaps
- The results level line still reads "Level 2  Circle arena". The brief only moved the arena on the intro.
- The intro's `difficulty` field ("Difficulty: Normal") is still the chips' accessible label, never shown.
- Push needs repo access. No add_repo tool exists in this session.
