# Proctor hand off: release-fix

Branch fix/proctor-release-fix from c892ddc (the five release polish merges). Only tests/ and this file changed; no src defect found, so src is untouched.

## Decision per failing test (all: old numbers that docs/14 changed on purpose, test updated)
- bossLevelEnd (7): boss at 240 s, objectives 300 to 360 s. Budgets raised to 480 s (hold) and 600 s (kill), 60 s timeouts. Same assertions.
- bossLevelEndSeed42 level 10 bossFirst (1): by the 240 s entrance a bot that clears waves nearly meets destroy 530, so the objective passed 1 s before the boss died. bossFirst now aims at boss targets only, which keeps its premise (boss dies before the objective).
- bossGw5 (6), bossTempestGw4 (7), bossTempestGw6 (10): real level 40 floor and waves, boss brought in at the old 20 s with the new bossHelpers earlyBoss(def) (the ?boss path idea; it asserts the def has atSec 240). Playing 240 s of waves first took 6 to 10 s a test. bossGw5 seed 2 fans: 12 of 14 rests begin inside the 300 u rule on the paced waves, so 2 fans land (one per part); minimum per seed is now 1: 3, 2: 2, 42: 3.
- weapons v1 golden (1): plays generateLevel(0x1234, 9, V4_GEN_CONFIG), the same level as before; V1_BAND2_30S matches unchanged. New: the long default level has kills and hashes equal twice.
- wellArrival "none while a boss is alive" (1): earlyBoss on the found level, so the 70 s run covers due arrivals.
- bossFairnessSweep "is not vacuous" (1): 60 s cannot kill a 235 s boss. Now: more than 10 of 60 sessions take a fifth of the bar (16 measured), none kill. New describe: kill path on legacyBossHp, shooter and chaser, every boss, all rules, more than 5 kills. It found twins "moved" during a respawn: a bullet in flight felled the front body and the entity took the second body's place (twins.ts afterDamage). That is an oracle gap, not a move, so the sweep resets its baseline on that fall.
- Also failing on this VM, not in the brief list: durations "every level validates" (5.6 s against a 5 s default, now 60 s) and v2enemies "rosters keep 3 to 6" (45 s alone, an expect per wave entry; now one expect over failure rows, 0.2 s, same rules).

## Normal is identical (acceptance 2)
tests/qa/normalDifficulty.test.ts (17): the Normal table is exactly 1, 1, 1, 1 and 0; the helpers are the identity; enemySpeedScale and boss cadence and maxHp are unscaled. 13 non boss V4 levels (seeds 42 and 7) play 30 s with kills to the hash babadbf gave for the same script, with and without an explicit normal. The open drum (seed 7 level 33) differs by drift only: with drift off it equals babadbf.

## Results
npm test: 4149 passed, 1 failed (accepted generator perf test, 1238 ms on this VM), 1 todo; two full runs, no flakes. npm run build: pass. Legacy Pixi grep: empty.

## Files
tests/game: bossHelpers.ts (earlyBoss), bossGw5, bossLevelEnd, bossLevelEndSeed42, bossTempestGw4, bossTempestGw6, weapons, wellArrival. tests/levelgen: durations, v2enemies. tests/qa: bossFairnessSweep, normalDifficulty (new).

## Requests and gaps
- None outside ownership. Gap: the real level boss tests now see the boss at 20 s on long level waves (calm first minute), not at 240 s under peak waves; the bossLevelEnd files cover the real 240 s entrance.
