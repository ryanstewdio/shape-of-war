# Foundry hand off: r1-pacing

Branch feat/foundry-r1-pacing (local dispatcher run 0549, no cloud session, so no session URL; not pushed).

## What changed
- New flag GenConfig.enableR1Pacing (default on, works only with enableLongLevels). Non boss levels report GENERATOR_VERSION_V6 = 6. Boss levels stay version 5 (waves, par, fight unchanged) so the boss replays and goldens hold. New V5_GEN_CONFIG is the old default.
- Par (pacing.ts wholeLevelPar): take the spawns in time order over the expected duration (survive or scoreInTime clock, or the first ceil(count / 0.7) spawns for destroy). Each spawn adds 0.7 x base x m to the score, then m grows by 0.45 x 0.7 x geoms (m starts at 1, capped at 999 like the sim). Par is the total on the 500 grid. Stars are par, 1.25 x par and 1.5 x par.
- Checked against Ryan: on version 5 waves this formula comes to 4.45 x the old par (p5 to p95 within 10 percent). So his level 6 (old par 742,000) gets par of about 3.3 M and a top star of 4.95 M. His 4,873,670 is 1.48 x par, just under the top star. Version 6 waves have about 25 percent more spawns, so a version 6 par is about 7 to 13 x the old one.
- The HUD bar is not par. It is objectiveProgress in src/ui/objective.ts: the survive clock, or the score target and then the clock. His 97 percent was the 5 minute timer. For Ledger.
- Waves (generator.ts, own stream R1_SALT): intervals are half the v5 ones with plus or minus 25 percent jitter, kept between 1.2 and 2.8 s, and the budget is rescaled to match. Flavours: normal 0.8x, surge 2x, swarm 1.4x (all darts, or all grunts if no darts). The first wave of each breather is a lull: 1 big enemy, then the next wave 2.6 s later. Every other wave has at least 3 enemies.
- Dead air model (deadAirGaps): each enemy lives 2 s (0.6 s telegraph plus the kill). Over 500 seeds, after 10 s no gap with fewer than 3 live enemies is over 3 s, except lull breathers of at most 4 s. Version 5 had gaps over 5 s, up to 21 s.
- Drums: 40 percent of eligible levels are cylinders (same single draw, so every old drum is still a drum). An open drum now drops its C0 bars, so 30 percent of drums have no barriers at all.
- Validator: knows version 6. P1 checks stars per version. J9 ties version 6 to the flag on non boss levels. Long level rules accept version 5 or 6.

## Files
src/levelgen/{leveldef,generator,pacing,drum,cylinder,validate}.ts; tests/levelgen/{r1pacing (new, 16 tests), par (+2), boss, drum, durations, gcTriage, generator, v2enemies}.test.ts. QA pin update: tests/qa/levelSnapshots.test.ts, where the five LONG_PINS now build with V5_GEN_CONFIG. Hashes and snapshot files are unchanged.

## Tests and build
npm test: 6 failures, the same as main: the perf test "200 levels under 350 ms" (now about 410 ms warm against 328 for v5, from 25 percent more spawns), tests/settings/difficulty.test.ts x4 and tests/qa/normalDifficulty.test.ts (Ledger). npm run build passes. The PIXI grep prints nothing.

## Risks
- Par is calibrated on one run. The collect rate (0.45) is the one knob.
- The boss bonus is 25 percent of par, but boss levels keep version 5, so it is unchanged.
- Spawn rate is up about 25 percent, more in band 1 where the gaps were longest.

## Contracts and requests
- Ledger: src/main.ts:751 computes the fallback game:over stars as stars(score, level.par), which is fixed at 1, 2 and 4 x par. Please switch it to starsFor(score, level.stars) (src/game/objective.ts) so the HUD, results and intro agree on version 6.
- Fable: decide whether boss levels should get R1. That means updating tests/game/bossLevelEndSeed42, bossTempestGw4, tests/qa/bossFairnessSweep and bossScheduleGolden.

## Device check for Ryan
1. Open Seed in the menu, type 2026, and start level 11. It should be a narrow drum, about as wide as it is tall, with no bars at all.
2. Level 14 on the same seed should be a drum with rings of barriers, and each ring has a dimmer membrane stretch that enemies squeeze through.
3. Level 16 should be a wide open drum with no barriers anywhere.
4. Play any non boss level for its full 5 minutes. The arena should never be empty for more than about 3 seconds. Look for big surges, packs of darts, and a single big enemy for a moment after each peak.
5. On the intro card, the three star scores should be close together (par, 1.25 x par, 1.5 x par). A strong full run should land between 1 and 3 stars, not 6 x par.
