# Ledger hand-off: r3-screens

Branch: feat/ledger-r3-screens (from main b62140e)

## What changed
- Free Play: the run build, the end check snapshot and the result moved to src/ui/freePlayRun.ts, which main.ts now calls. The sim runs the Free Play EndlessDef; the UI reads the Endless style level from the same segments (survive 1e9 s), so only losing every life ends the run. Fable's glue was right: the old `world.level` objective was survive 0, which ended the run on the first step.
- Intro card (src/ui/intro.ts): title and arena; Goal in one sentence plus a Victory line; chips and Start; Star targets as three labelled columns with the cap ("Normal: max 2 stars"); New enemies with a neon icon drawn from the render shape specs, name and one word type (src/ui/enemyIntro.ts); Loadout ("Drone: Attack", "Super: Turbo (...)", "Reward: ..."); "Seed: N" last and small. Card padding 20 px, 16 px between blocks.
- New enemies: roster kinds plus placed wells and spawners not in any earlier level of the run (earlier levels come through pickLevel, cached per run seed in main.ts). Endless lists its first segment roster.
- Turbo text is built from TURBO_SCALE, TURBO_SPEED_SCALE, TURBO_PIERCE and SUPER_DURATION in supers.ts, so Forge's r3-turbo numbers flow in once merged.
- Results (src/ui/results.ts): headline Victory or Defeated (Game over in Endless and Free Play), title line, a labelled Score block (score, "Par: N", a bar against the three star targets with marks, the targets as lit columns, "Stars earned", the difficulty cap), "Best: N", "Boss bonus: N (Warden defeated)", labelled details (Time, Seed, Level code, Space physics), the par reward, then the buttons. LevelResult gains starTargets and bossName.
- No storage keys changed, so the docs/13 key table is untouched.

## Tests
- tests/ui/freePlayRun.test.ts (3): per arena, the real flow runs past 60 s with the ship alive and no game over, then ends only on lives 0 with no stars, score and time on results.
- tests/ui/enemyIntro.test.ts (6): new enemy list from rosters and hazards, a generated run, names and types, icons from shape specs.
- tests/ui/intro.test.ts (rewritten, 21): goal and victory wording, star targets and cap, Turbo text from the numbers, block order and labels, padding CSS.
- tests/ui/results.test.ts (updated, 23): labels on every line, bar marks, order of blocks. boss.test.ts and release.test.ts pins updated.
- npm test: 4346 pass, 1 fail: generator "200 levels under 500 ms", which fails the same on main (accepted perf exception). npm run build: pass.

## Device check
1. Start Adventure level 1 on the cover screen: the card shows Goal, Victory, chips and Start, three star target boxes, Grunt, Wanderer and Pinwheel with icons and types, Loadout, then Seed. No text clips; the card scrolls if it is taller than the screen.
2. Unfold and open a later level: New enemies lists only kinds not seen earlier, or hides the block when there are none.
3. On a Turbo level, the Super line reads its numbers (today "doubles fire rate, 25% faster ship, shots pierce 1 enemy, 5 s").
4. Finish a level either way: Victory or Defeated, then Score, Par, the bar with two marks, lit star boxes, Stars earned, the cap line, Best, Level code, then reward and buttons.
5. Free Play, any arena: play past one minute; the run continues until the last life, then Game over with score and Time only.

## Requests
- Fable: after forge-r3-turbo merges, if the duration moves off SUPER_DURATION (for example a TURBO_DURATION const), point TURBO_NUMBERS.durationSec at it in src/ui/intro.ts.

## Known gaps
- No enemy kind uses the "shooter" type yet; Sower is listed as hazard (it lays mines).
- The results layout was checked by tests and the intro card by screenshot at 412 and 884 px; the results card was not screenshotted.
