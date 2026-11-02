# Foundry hand-off: durations (release polish items 7 and 9)

Branch feat/foundry-durations. Session https://claude.ai/code/session_018Gwqi6UgyJp3hbvAeSt3up

## What changed
- New GenConfig.enableLongLevels (optional; only true turns it on). DEFAULT_GEN_CONFIG sets it true; V1, V2 and V3 configs set it false and stay byte identical. New V4_GEN_CONFIG is the old default (cylinder on, long off).
- Version: every def built with the flag on reports GENERATOR_VERSION_V5 = 5 in place of 1 to 4. Boss and cylinder are read from the boss and surface fields. Flag off: versions 1 to 4 as before. Endless never reads the flag.
- LONG_BANDS (leveldef.ts): survive and scoreInTime 300 s in band 1, up to 330, 345 and 360 s in bands 2 to 4 (band 4 from 315 s). Destroy draws a clear second in the same ranges, then destroyCountFor sizes the count from the waves so the needed spawn (ceil(count / 0.7)) comes at or after that second. scoreInTime target is the band's legacy window target scaled by limit / legacy limit, at most par.
- Paced waves (pacing.ts pulseAt): first 60 s at 0.7 budget and 1.25x interval, then cycles of 90, 80, 75 and 60 s by band: a build from 0.85x to 1.3x budget, the peak, then a 10 s breather (0.45x budget, 1.6x interval). The ramp runs over 180 to 240 s. The loop period has a 90 s floor (measured 153 s or more).
- Boss levels: BossSpec.atSec 240 (BOSS_LONG_LEVEL_AT_SEC). Objectives are long too, so the hold never brings the boss in early.
- Membranes (drum.ts addMembranes): each ring of a rings drum gets 1 or 2 membranes, 120 to 200 u. Each one takes the gap end of a bar, so the open gaps and the bar count stay the same. Seam halves keep 80 u of solid. They are drawn after every ring draw.
- Validator: J3 knows 5; O1 uses the long ranges on version 5 (destroy: clear not before the band minimum); W11 loop period at least 90 s; B1, B3 and C1 accept 5 (boss at 240 s); J8 ties 5 to the flag when opts carry it; M1 allows a membrane only on a version 5 cylinder ring, sized, touching a bar, at most 2 per ring; A4 counts solid bars; A5 lets a membrane touch its bar.

## Files
src/levelgen: leveldef.ts, generator.ts, validate.ts, boss.ts, drum.ts, pacing.ts (new).
Tests: tests/levelgen/durations.test.ts (new, 22 tests). These moved to V4_GEN_CONFIG with no change in what they check: boss, cylinder, drum (identity sweeps), generator (band 1 line). Hash pins regenerated in gcTriage and drum EXAMPLES; old values are kept in comments. v2enemies and boss J3 now reject 6.
tests/qa pins (list): levelSnapshots boss pins now run on V4_GEN_CONFIG (no existing file changed), plus 5 new files seed42-level{5,10,12,13,50}-long.json. bossScheduleGolden now expects atSec 240 and version 5 on default levels. generatorBossFlagSweep ON is V3_GEN_CONFIG and physicsReplay NO_CYL is V3_GEN_CONFIG; both are the same configs as before.

## Tests and build
npm run build: pass. npm test: 3958 pass, 34 fail. One is the generator perf test (200 levels 770 ms; main also fails here at 861 ms). The other 33 are in 7 tests/game files I do not own (below).

## Requests (outside my ownership)
- Swarm or Forge: tests/game bossGw5, bossTempestGw4, bossTempestGw6, bossLevelEnd, bossLevelEndSeed42 and wellArrival wait at most 120 s for a boss that now enters at 240 s. weapons.test compares the first 30 s with v1. Each one calls generateLevel(seed, n) with the default config. Fix: pass V4_GEN_CONFIG (keeps today's levels), or raise the step caps past 240 s.
- Forge: the sim must read Obstacle.membrane (block the ship and its bullets, let enemies squeeze through slowly). Until then a membrane acts as a solid wall.
- Ledger: the HUD and results text may assume levels of 2 minutes or less. Scores and par are much larger now (for example, band 2 destroy 605 has par 1512500).

## Risks
- Par grows with the square of the level length. par.test still passes (10 to 35 percent of the simulated score).
- About 1.5x generation time per level. Waves are longer, but maxLiveEnemies is unchanged and nothing allocates per frame.

## Device check for Ryan
1. Start a new run on seed 42. Level 1 should show a 5:00 timer or a target that takes about 5 minutes.
2. Play level 5. Waves run for 4 minutes. The Warden enters at 4:00, not at 0:20.
3. Play level 12 on seed 42 (a drum with barrier rings). Each ring has 1 or 2 bar segments that look different (membranes) next to its open gaps.
4. On any level, the first minute should feel calmer. After that a busy spell comes about every minute or so, followed by a short lull.
