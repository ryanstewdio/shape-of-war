# HAND-OFF Foundry: fp-level

Branch: feat/foundry-fp-level
Files changed: src/levelgen/freeplay.ts, generator.ts, validate.ts, boss.ts, leveldef.ts; tests/levelgen/fpLevel.test.ts (new); this hand-off.
Tests added: tests/levelgen/fpLevel.test.ts, 32 tests. Absent config hashes as on main (12 def and segment goldens taken from 64a20eb). Each option checked against its rule: enemies, density ratios and maxLive, bosses off/every3/chosen/drum, wells off/normal/many 2 to 4, sizes and multiple of 64 drums. Also determinism, JSON safety, freezing, no Math.random, and FP2/FP4/FP5/B1 negative cases.
Test result: npm test 4448 passed, 1 failed (the accepted perf exception "200 levels under 500 ms": it also fails on main, 1149 ms here). npm run build ok. The v7 grep and the dash check are clean.

Exports for wiring:
- FreePlayOptions.config?: FreePlayConfig. Ledger passes freePlayLevel({ arena, barriers, seed, config }). freePlaySegment(def, s) reads def.freePlay.options and needs no new argument.
- FreePlayInfo.options?: FreePlayLevelOptions { enemies, density, bosses, wells, size } is set only when a config was passed. Absent config gives today's Free Play, byte for byte.
- validate.ts: freePlayArenaSize(kind, size), freePlayMaxLive, FREE_PLAY_SIZE_SCALE, FREE_PLAY_DENSITY_SCALE, FREE_PLAY_MANY_WELLS, FREE_PLAY_ENTITY_CAP (512).
- boss.ts: freePlayBossFor(bosses, segment, cylinder). freeplay.ts: levelOptionsOf, placeFreePlayWells, segmentTweaks, FREE_PLAY_ARRIVAL_GAP_SCALE (0.5).
- generator.ts: endlessSegmentOn takes an optional SegmentTweaks (roster, budgetScale, maxLiveEnemies, boss). It is opt in; every existing golden holds.

How the rules apply:
- Enemies: the segment roster is exactly the chosen kinds, with catalogue weights, and the v2 swap is skipped. Kinds the GenConfig cuts are dropped. If nothing is left, the normal roster is used. A roster without grunt still spawns: a group that cannot afford any kind gets the cheapest one, and a full snake cap falls back to the cheapest other kind.
- Density: each wave's budget is scaled 0.6, 1 or 1.8. Swarm raises maxLiveEnemies to min(512, round(band x 1.8)).
- Size: rect 1200x750, 1600x1000 or 2080x1300. Circle 830, 1100 or 1430. Drum 1216x750, 1600x1000 or 2112x1300. For Free Play, the A1 bounds and the F1 ship floor scale with size.

Verify on device: needs Ledger's setup screen.
1. Choose Free Play, rect, Enemies weaver only. Only weavers should spawn.
2. Choose Swarm. The arena should be visibly denser than Normal.
3. Choose Bosses Prism. Prism should arrive at 3:00, but not on a drum.
4. Choose Wells Many. You should see 2 to 4 wells at start.
5. Choose Large. The arena should be larger, with the ship smaller on the cover screen.

New dependencies requested: none.
Requests (outside my ownership):
- Forge (src/game): with def.freePlay.options.wells === 'many', allow well arrivals in Endless at arrival gaps x FREE_PLAY_ARRIVAL_GAP_SCALE. Arrivals are off in Endless today. Also confirm that createEndlessGame spawns def.hazards.wells.
- Fable: DEFAULT_FREE_PLAY.bosses is 'off', but today's Free Play has a boss every 180 s on every arena, drums included. Absent config keeps today's behaviour, so an explicit default config does not match an absent one. Should the default become 'every3'?

Known gaps:
- On the 21:9 cover screen, a large flat arena shows the ship at 14.8 px, under MIN_SHIP_PX 16. F1 is relaxed by the size factor.
- The drum keeps no boss for a chosen boss either. Wells 'many' plus a boss segment can hold up to 4 wells, because rule 12 is level only.
