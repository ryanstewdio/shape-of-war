HAND-OFF foundry: short-levels
Branch: feat/foundry-short-levels  Head: c3ba09a (code; this hand-off is the next commit)
Files changed: src/levelgen/short.ts (new), generator.ts, leveldef.ts, validate.ts; tests/levelgen/shortLevels.test.ts (new); moved pins in boss, drum, gcTriage, leaver, parRamp, scoreTarget, t3, v2enemies tests
Tests added: shortLevels.test.ts, 16 tests (V10 frozen hash a3bb328e taken from main 754b6f7, J12/J13, length table, races, beats, report pins)
npm test: 4899 pass, 31 fail = accepted generator perf test + 30 in tests/game and tests/ui (Requests 1, 2); npm run build: pass
Version 11 (enableShortLevels, default on): level 1 90 s, then 105, 120, 135; from level 5 each non boss level draws from SHORT_LENGTHS.late [120..180 step 15], never repeating the level before. Boss entrance 85 s on levels 5, 10, 15, 20 (120 x 150/210); boss spec, objective and hp unchanged
Races: at least one scoreInTime in every 4 non boss levels from level 3; share 0.39 over non boss levels 1 to 30 (per level 0.18 to 0.64); goal still wholeLevelTarget = 0.6 x par
Beats: each full minute brings a formation (one roster kind, a fresh pattern) or a 10 s surge (x1.5), alternating; the last 20 s are a rush (x1.4, the stronger of the rush and the R5 lift wins). Boss levels: beats until 10 s before the entrance, no rush. levelBeats(def) lists them
Ramp: PAR_RAMP_SCALE and the live cap kept; R3 rampSec and the calm opening scaled by length / 210; one build per level (no breather before the end)
Moved pins: parRamp, t3, scoreTarget, leaver now run on V10_GEN_CONFIG because the default is version 11; gcTriage device hashes moved with version 11 (old ones recorded in the file); J3 tests now use 12 as the first unknown version; drum configOfVersion maps 11 to the default
How to verify on device: 1. New run, level 1: the clock reads 1:30. 2. At 1:00 a surge or a formation arrives, then the final rush from 0:20 left. 3. Level 5: the boss enters at 1:25. 4. Levels 6 to 9: different lengths, at least one score race
Dependencies requested: none
Requests 1: tests/game/bossHelpers.ts:148 earlyBoss pins atSec 120; change to BOSS_SHORT_LEVEL_AT_SEC (import from src/levelgen/short). Fixes 24 boss and well tests
Requests 2: tests/game/scoreTarget.test.ts:14 and tests/ui/scoreTarget.test.ts:16,23 use tester seed level 4, which is a 135 s survive on version 11; pass V10_GEN_CONFIG. With 1 and 2 applied, all 140 game and ui files passed locally
Requests 3 (optional): minute aligned well arrivals need the sim to read a beat time (src/game/wellArrival.ts); not done, wells keep their own GW2 clock
Known gaps: formations join the wave at or just after the minute mark (up to 5 s late); beats are not stored on the LevelDef (Ledger can call levelBeats for the HUD); boss level objectives keep the version 10 tables
