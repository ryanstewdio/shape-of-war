# Hand-off swarm: gw5-bosses

Branch: feat/swarm-gw5-bosses. Session: https://claude.ai/code/session_018Gwqi4wQmHs26UF9uNvmoy

## What changed (GW5, both bosses rated fairness 5, target 4)
- Tempest body: dash interval divided by 1.2 (5, 4.17, 3.33 s by phase, from 6, 5, 4). HP 1035 to 1138.5 hits (plus 10 percent).
- Tempestlings: they chase at 165 u/s at full HP, rising in a straight line to 185 u/s as each one loses its HP (the HP at the split is stored in abl slot 4). They dash every 2.6 s (was 3) at 462 u/s (was 420). Wind up stays 0.7 s.
- Tempestling fan: after each dash, in the rest, a fan of 6 bullets 14 deg apart at 200 u/s, aimed back along the dash path (toward where the ship stood). Bullets charge for the tier telegraph at the body edge. The fan fires only while the ship is 300 u or more from the muzzle; it rechecks every rest step and is dropped if the rest ends first (abl slot 5 is the pending flag).
- Bastion: turret turn every 1.125 s (was 1.5; shot row every/everyP2 match). Regen 12 s (was 18), still half HP and still only above 33 percent before waking. Phase 3 shield: 8 Hornets (was 6), two bursts of 4, same pool (MAX_HORNETS 10). Sweep 1.08 rad/s (was 0.9). Core HP 1080 to 1242 hits (plus 15 percent).
- bossFightLength bands: no change needed. They cover only Brood, Spindle and Warden.

## Files touched
src/game/bosses/table.ts, src/game/bosses/tempest.ts, tests/game/bossGw5.test.ts (new), and updated pins in tests/game/bossBastionGw4, bossBastionShield, bossBastionShots, bossTempest, bossTempestGw3 and bossTempestGw4 (all .test.ts).

## Tests
- New bossGw5.test.ts, 15 tests. Every changed number. Fans checked in play on seeds 1, 2 and 42 (6 bullets, spacing, centre on the reverse dash heading). Dash step length is 462 u/s. No fan within 300 u. Turret turn gap 1.125 s, rebuild at 12 s, sweep 1.08 rad/s in play. Two determinism hash runs, one per boss, with Math.random stubbed to throw.
- npm test: 262 files, 3699 passed, 1 todo, no failures (the perf and levelgen timeouts did not trip). npm run build: exit 0. The v7 grep prints nothing. tests/qa snapshots unchanged.

## Risks
- The Tempestling fan is 6 bullets, above SHOT_VOLLEY_MAX (5). That cap binds the BOSS_SHOTS rows only, so the fan does not use the shot row helpers; it has its own TEMPESTLING row because the brief asks for 6.
- I read "cadence 20 percent faster" as rate times 1.2 (interval divided by 1.2), not interval times 0.8. "Chase 165 to 185" is my reading of a range: speed rises as HP falls.
- bossBastionShots "dodge in play" test: at 1.125 s, two turret bullets are in flight at once. The scripted dodger used to switch sides every shot and walked back into the earlier bullet. It now always steps to the same side (a circle strafe) and survives 60 s, 24 shots, no lives lost. A player who switches sides every shot can be caught.
- Both Tempestlings share bs.shotId for fx:bossShot. If both fans fire on the same step, only one launch fx plays. Bullets are unaffected.
- No per-frame allocation added. The fan loop writes into the existing bullet pool.

## Contracts for other roles
No event added or changed (sim:wellArrive, sim:saw, sim:bossShield untouched). New exports in tempest.ts: tempestlingSpeed(hpShare?), hpShareOf, fanCentre, fireDashFan. New TEMPESTLING fields: chaseSpeedMax, fanCount, fanSpreadDeg, fanSpeed. Render needs nothing new; the fan uses the normal enemy bullet look.

## Device check for Ryan
1. Play level 35 (Bastion). Turret lanes and bullets should come visibly faster than at GW5. Kill one turret and count: it should rebuild about 12 seconds later, not 18.
2. Kill all four turrets. Each shield should release 8 Hornets (4 then 4), and the sweep arm should turn noticeably faster. Rate fairness 1 to 5 (target 4).
3. Play level 40 (Tempest). The big Tempest should dash more often and take a little longer to crack.
4. After the split, each small Tempest should dash about every 3 to 4 seconds. After each dash, from the far wall, it fires a fan of 6 bullets back along the line it came from. Sidestep the fan. Damaged Tempestlings should chase slightly faster. Rate fairness (target 4) and note the lowest fps in both fights (Standard budget 58 to 59).
