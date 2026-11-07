HAND-OFF foundry: t3
Branch: feat/foundry-t3  Head: 9d66a60 (code; this hand-off is the next commit)  Session: https://claude.ai/code/session_018Gwqi2TrVt6J5tQSR4nj11
Files changed: src/levelgen/{leveldef,boss,cylinder,generator,validate}.ts, new src/levelgen/ripples.ts, src/core/difficulty.ts (easy bossScale only), tests/levelgen/{boss,drum,durations,gcTriage,r3length,v2enemies}.test.ts, tests/qa/{bossHarness.ts,bossScheduleGolden.test.ts}
Tests added: tests/levelgen/t3.test.ts (21): config and V8 freeze (hash fold pinned from main a5216c7), boss order and 0.75 first fight under V9 and V8, level 8 drum on 20 seeds, ripple rules on 200 seeds x 45 levels (share 0.45 to 0.55), par unchanged, T1 and K1 rejections
Moved pins: gcTriage hashes (version field 8 to 9 only); boss harness and schedule golden pinned to V8_GEN_CONFIG (fights and table are version 8); J3 first unknown is now 10; r3length and drum tests name V8_GEN_CONFIG; durations config identity adds enableT3
npm test: 4794 pass, 1 fail (accepted generator perf exception, 588 ms vs 500, was 557 on main)  npm run build: pass
Version 9: GenConfig.enableT3, runsT3, V8_GEN_CONFIG, GENERATOR_VERSION_V9 (isLongVersion, hasR1Stars, new isR3Version). Boss: t3BossForLevel, FIRST_FIGHT_HP_MUL. Level 8: open rect drum, band 1 roster, no v2 stage, at most one well, no spawners, LevelDef.noDrift true
Ripples: own stream RIPPLE_SALT after every other draw; first 40 to 70 s, then 25 to 45 s until the objective clear second; epicentre 150 from walls and obstacles; strength 0.3 (L12) to 1 (L40); par untouched
Ripple example: run seed 1, level 17 (5 ripples at 55.1, 84.9, 115.4, 153.5, 184.5 s, strength 0.43)
How to verify on device: 1. New run, level 5 shows Brood, level 10 Warden. 2. Level 8 is a drum with no drift once Forge lands the request below. 3. Seed 1 level 17 ripples once forge-ripple lands.
Dependencies requested: none
Requests (changes outside my ownership): Forge: src/game/drift.ts isOpenDrum must return false when level.noDrift === true (until then level 8 drifts like any open drum).
Known gaps: validator K1 checks only the gap floor (a ripple with no clear epicentre is left out, widening a gap); Endless and Free Play keep the old boss ladder by design.
