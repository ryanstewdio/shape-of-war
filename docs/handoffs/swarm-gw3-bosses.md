# Swarm hand-off: gw3-bosses

Branch: feat/swarm-gw3-bosses. Session: https://claude.ai/code/session_018Gwqi4zv6K5S7uPi4qzWix

## What changed
- Bastion: turret HP 80 to 180. After each turret death the turrets left are shielded for 1.5 s (hits blocked, fx:hit blocked true). Uses a new optional BossDef hook `partGate` that damageBossPart checks. Each turret death takes 5 percent of max HP off the bar (all four: 20 percent). The old drop to 50 percent at waking is gone, so phase 3 starts at about 80 percent minus whatever damage the core took in phase 2. Phases still follow the turret count.
- Tempest: big body HP 900 to 1035 (plus 15 percent).
- Tempestlings: they no longer lap the wall. Between dashes they chase a flank point 260 u from the ship at 196 u/s (1.4x the body's 140 u/s lap speed) and stay at least 150 u from the walls. Slot 0 leads a pincer: when its dash clock is due and the two are on opposite sides of the ship (or 2.5 s have passed), both wind up together and dash through the ship from opposite sides at 420 u/s. Storm attack (Slime and dash clocks) now runs at full rate. Rest after a dash is 0.6 s.
- Root cause of "aim a path then abandon it": a lane marker expires 0.01 s before its wind up ends, and the Tempestling read the missing marker as a bomb clear, so it went back to lapping. Now only a marker gone with more than 0.05 s of wind up left (bomb, ship death) cancels the dash. A wind up starts only when the dash line to the wall is at least 200 u long.

## Files touched
src/game/bosses/{bastion,core,table,tempest,types}.ts; tests/game/{bossBastion,bossBastionShield,bossBastionShots,bossReadability,bossTempestSplit}.test.ts, tests/game/bossHelpers.ts (new breakTurret helper), new tests/game/bossBastionGw3.test.ts, new tests/game/bossTempestGw3.test.ts.

## Tests added
- bossBastionGw3 (5): pure rules, 18 HP turret, 1.5 s turret shield (blocked, then lands), bar cap of 20 percent under steady turret fire, determinism (two 40 s runs hash equal, Math.random throws).
- bossTempestGw3 (7): pure rules (HP plus 15 percent, speed ratio, pincer), every marker followed by a committed dash of at least 200 u with none abandoned, dash about 420 u/s and chase 1.4x lap speed, at least 150 u wall distance between dashes, opposite flanks at every wind up, markers present, determinism.
- Existing Bastion and Tempest split tests updated to the new rules.

## Test and build
npm test: 3358 passed, 1 failed (generator "200 levels under 350 ms": 419 ms in this VM, the accepted perf exception). npm run build: pass. tests/qa snapshots unchanged. bossFightLength has no Bastion or Tempest bands, so none changed. Fights are longer: Bastion has 4x10 more turret HP and about 30 percent more core HP to burn in phase 3; Tempest has 15 percent more HP.

## Risks
- The brief asked for both "1.4x the big Tempest's speed" and "chase at about 150 u/s". Those conflict (1.4 x 140 = 196), so I used 196 u/s. If that is too hot, lower TEMPESTLING.speedRatio.
- The turret shield clock pauses during the 1.2 s phase change pause and the bomb stagger, so the window after the second turret death is about 2.7 s in real time.
- On a non rect arena the flank axis falls back to the plain bearing when no turn fits.
- No per frame allocation: the confine results are module scratch.

## Contracts for other roles
- BossDef.partGate is new and optional. Events are unchanged (sim:bossShield, sim:wellArrive, sim:saw untouched).
- Glow (request): the turret shield is bs.abl[TURRET_SHIELD] (exported from bastion.ts), seconds left. Turrets have no shielded look yet; blocked hits already show through fx:hit blocked.

## Device check for Ryan
1. Play level 35 (Bastion). Shoot one turret until it dies, then keep firing at the next one at once. For about a second and a half your shots should spark off without damage, then they should land. A turret should take about twice as long to kill as before.
2. After all four turrets die, the boss bar should sit at no less than about 80 percent unless you hit the core during phase 2. Phase 3 should take real work.
3. Play level 40 (Tempest). Bring it below a third so it splits. The two small Tempests should leave the walls, move faster than the big one did, and sit on opposite sides of you. Every time two dash lines appear, both should really dash along them, crossing where you stood. They should not float along the edge. Rate fairness out of 5 for both bosses (target 4).
