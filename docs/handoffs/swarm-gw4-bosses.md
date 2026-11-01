# Hand-off swarm: gw4-bosses

Branch: feat/swarm-gw4-bosses (from main 578bcb4). Session: https://claude.ai/code/session_018Gwqi6VKRmKapcVwDtCcos

## What changed
- Tempestlings, root cause: a full level 40 fight (generator seeds 1, 2, 42) showed the pincer came only about every 9 s. Slot 0 waited out the body's phase 3 dashEvery (4 s) of chase, then a 2.5 s flank wait that always ran out against a circling ship. Ryan kills them in about 10 s, so he saw at most one pincer. On an obstacle floor, rayToWall's bisection could also land past an obstacle, so a marked dash stopped short (122 u seen).
- Fixes: TEMPESTLING.dashEvery is 3 s of chase, counted from the end of the rest. flankWait is 1 s (2.5 before) and firstDash 1.5 s. Slot 0 now waits for slot 1 to be back in its chase, and slot 1 dashes alone if it missed a pincer. rayToWall marches in 8 u steps, then refines. Chase is 165 u/s (196 before). The wind up is 0.7 s (TEMPESTLING.windupSec), and the lane marker shows for all of it.
- Bastion: turret HP 180 to 300. Core HP 900 to 1080 (plus 20 percent). Phase 3 shield every 10 s (12 before), first one 10 s after waking.
- Bastion turret regen: a fallen turret rebuilds at half HP (150) 18 s after it fell. Only one rebuilds at a time: the next one down starts its own 18 s when that rebuild lands. Regen runs only while the core holds more than 33 percent and has not woken (phase 3 never lowers, so a woken core never rebuilds). The 18 s counts fight time, so the 1 s phase change pause and bomb stagger are not counted. Only the first four turret deaths cut the bar, so a rebuilt turret never makes the bar easier.

## Files touched
src/game/bosses/tempest.ts, bastion.ts, table.ts; tests/game/bossTempestGw3, bossBastion, bossBastionGw3, bossBastionShield, bossBastionShots (updated to the new numbers); new tests/game/bossTempestGw4.test.ts, bossBastionGw4.test.ts.

## Tests added
- bossTempestGw4 (9 tests): pure rules; rayToWall stops at the first obstacle; the real level 40 fight (generateLevel, real stepGame, shielded ship circling with no shots, drone on Collect) on seeds 1, 2, 3, 7, 42 and 12345. Each Tempestling makes at least 3 committed dashes of 200 u or more in 20 s, each after its own marker and a full 0.7 s wind up. Two runs hash equal with Math.random trapped.
- bossBastionGw4 (7 tests): pure rules; rebuild at 18 s in its slot at 150 HP; one at a time; no rebuild at 33 percent or below or after waking; only the first four deaths cut the bar; two runs hash equal.
- GW3 flank test relaxed: at least two thirds of wind ups from opposite sides (the first pincer after the split may start on the shorter wait).

## Results
npm test: 3510 passed, 1 failed (the known perf test "200 levels under 350 ms", which also fails on main in this VM). tests/qa snapshots and goldens unchanged. npm run build: pass. tsc clean, the v7 grep prints nothing.

## Risks
- The dash count margin is exact: every seed gives exactly 3 per Tempestling in 20 s. If the fight is too hot, raise TEMPESTLING.dashEvery to 3.5 (each part then makes 2 to 3 dashes in 20 s).
- The pincer gets fewer opposite side lines because the flank wait is shorter.
- Ryan said "less life is removed" when turrets fall. The brief did not change turretBarShare (5 percent per turret, 20 percent total), so it is untouched. Lowering it is one table edit if wanted.
- No per frame allocation was added. The rayToWall march (at most about 220 point tests) runs only when a wind up starts.

## Contracts
No event or exported type changed. New exports: RAY_STEP, tempestlingDashEvery (tempest.ts); REGEN, FELL, DEATHS, regenHp, regenAllowed, deathCutsBar (bastion.ts). A rebuilt turret is a normal Kind.BossPart PartType.Turret spawn, so the renderer needs no change.

## Device check for Ryan
1. Open level 40 (or add ?boss=tempest) and crack the Tempest below a third so it splits.
2. Stop shooting and circle. Within about 2 s both small Tempests stop, show a red lane for under a second, then dash at least a third of the arena. This repeats about every 6 to 7 s.
3. Between dashes they chase noticeably slower than before and stay off the walls.
4. Open level 35 (or add ?boss=bastion). A turret takes about two thirds more shots than before.
5. Kill one turret and wait 18 s without hurting the core much: it returns, smaller on the bar, in the same corner.
6. Kill all four: none come back. The core's shield now rises every 10 s.
