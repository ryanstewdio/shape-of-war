# Hand off: swarm r1-bosses

Branch feat/swarm-r1-bosses from local main b1af0f8 (carries the 6dce020 Insane stub). Session: https://claude.ai/code/session_018Gwqi4KMqCHhaSmMJ167ha

## What changed
- Hit points: every BOSS_TABLE row is 40 percent higher (warden 2576, brood 4060, spindle 5918, ember 3205, mirage 5932, gravitas 7602, bastion 5222, tempest 5020, twins 5918, prism 1840). Windows and patterns unchanged.
- Fight length script at Normal (new band 294 to 364 s, was 210 to 260): warden 314.8, brood 330.0, spindle 328.8, ember 345.3, mirage 329.6, gravitas 325.7, bastion 327.6, tempest 328.9, twins 328.8, prism 334.6.
- Minions scale by addScale (rounded, at least 1, capped) through minionCount in the new src/game/bosses/scale.ts. Warden Hornets per shield 8, 10, 13, 16 (Easy to Insane). Bastion shield Hornets 6, 8, 10, 13; Bulwarks per wave 1, 1, 1, 2 (new BASTION.addsPerWave and addSpreadDeg). Brood Darts per wave 2, 3, 4, 5 (phase 2: 3, 4, 5, 6) and Broodling Darts 2, 2, 3, 3, inside MAX_ADDS 8. Prism pods (read as its "echoes"; nothing named echo exists) 2, 3, 4, 4 inside MAX_PARTS 4.
- Hornet pool: MAX_HORNETS 10 to 16 slots (512 entity store has room, allocated once per world). The live cap is HORNET_CAP 10 times addScale, so Normal still holds at most 10 live.
- Insane telegraph: BossState.teleScale is 0.85 on Insane, else 1. Every hazardTelegraph(bs.row.tier) in boss code now goes through bossTele(bs): hazards, markers, boss bullets, rotation volleys, wind ups (Ember windupFor takes an optional scale).
- Normal is unchanged apart from the hit points.

## Files touched
src/game/bosses: scale.ts (new), table.ts, state.ts, core.ts, warden.ts, bastion.ts, brood.ts, prism.ts, ember.ts, tempest.ts, twins.ts, spindle.ts, rotation.ts, shots.ts.
tests/game: bossInsane.test.ts (new, 23 tests), bossFightLength (new band, 500 s limit), bossBroodSplit (Brood is now armoured), bossWardenGw2 and bossWardenShield (HORNET_CAP 10, pool 16).

## Tests and build
Boss suite 44 files, 456 tests pass. npm run build passes. Full npm test: 7 failed, 4166 passed. Expected: tests/settings/difficulty.test.ts (4) and tests/qa/normalDifficulty.test.ts (1), which Ledger updates; generator perf "200 levels under 350 ms" (817 ms in this VM). New because of the hit points: tests/qa/bossFairnessSweep.test.ts "is not vacuous" (see Requests).

## Requests (outside my ownership)
- Proctor: tests/qa/bossFairnessSweep.test.ts line 234 wants more than 10 of 60 sessions to take 20 percent of the bar. With 40 percent more hit points exactly 10 do. Suggest a threshold of 0.2 / 1.4 (about 0.14) or "at least 8".
- Glow: src/render/hazardFx.ts draws the telegraph from the tier alone (1.0, 0.8, 0.6 s). On Insane a hazard turns lethal at 0.85 of that, so the bright form shows late by 0.15 to 0.09 s. Glow should scale by 0.85 when the run is Insane (telegraphScaleFor in scale.ts).

## Risks
- Insane tier 3 and 4 telegraphs are 0.51 s, under the 0.6 s fairness floor; the brief asked for it.
- Up to 16 Warden Hornets on Insane: watch the boss fight fps on Standard tier. No per frame allocation was added.

## Contracts for other roles
New exports: scale.ts (minionCount, hornetCap, bossTele, telegraphScaleFor, INSANE_TELEGRAPH_SCALE), table.ts HORNET_CAP, bastion.ts bastionHornets and bulwarksFor. Events unchanged.

## Device check for Ryan
1. Settings, Difficulty Normal. Play level 5 and fight Warden the way you did at R1. The fight should now take about 3.5 minutes (it took 2.5), with the same windows and patterns.
2. Settings, Difficulty Insane. Fight Warden again. Each shield releases 16 Hornets, not 10. Rings flash bright a little sooner after they appear, and his attacks come faster.
3. On Insane, play level 35 (Bastion). Two Bulwarks join each wave instead of one, and once it wakes each shield releases 13 Hornets. Watch that the fps meter holds 58 or more.
4. On Insane, play level 10 (Brood). Its Dart waves are 5 (6 in phase 2), not 3 and 4.
