# Hand-off swarm: gw2-bosses

Branch: feat/swarm-gw2-bosses. Session: https://claude.ai/code/session_018Gwqi4sHDhVhqDpgjYjico

## What changed
- sim:bossShield { id, up, x, y } now fires once on every shield edge (up, drop, a ship death or kill while up), through the new `setShield` in src/game/bosses/shield.ts. The payload is reused from BossState.shieldEv.
- Warden is harder: 520 hits, 10 Hornets per shield (two bursts of 5, MAX_HORNETS 10), Hornet speed 300 u/s, rings every 3.7 s (phase 1) and 2.8 s (phase 2), a 2.0 s window after the shield. In phase 2 the dropping shield fires one ring of 12 enemy bullets (180 u/s, they charge for the tier telegraph first, fx:bossShot at launch).
- Bastion phase 3: drifts toward the ship at 50 u/s (wakeSpeed was 110). Every 12 s, start to start, with the first 12 s after waking, it stops and raises a 3 s shield (core closed, shots absorbed). It releases 6 Hornets (two bursts of 3, shared Hornet pool), then holds still with a timed 2 s open window. A shield that falls due mid charge waits for the charge to end. Sweep and charges are unchanged.
- Tempest: at the stage 2 crack it splits once into 2 Tempestlings (new PartType.Tempestling = 8, radius 60 percent, remaining HP split evenly). It follows the Brood and Gravitas split pattern: sim:bossSplit once, bar = sum of parts, contact kills, and the win comes when both die. Each one laps (the second the other way), lays Slime and does the marked dash, with its clocks at 70 percent rate. A wind up whose marker a bomb or death cleared goes back to the lap, so no dash is ever unmarked.
- BossState: ABL_SIZE 8 to 16 (per part scratch for Tempestlings), shieldEv added.

## Files touched
src/game/bosses/{table,state,types,core,index,warden,bastion,tempest,shield(new)}.ts; tests/game/{bossCore,bossFightLength,bossWarden,bossWardenShield}.test.ts updated; new tests below.

## Tests added
bossWardenGw2.test.ts (7: numbers, drop ring, shield events, ship death edge, determinism hash), bossBastionShield.test.ts (5: rules, shield timing, absorb and Hornets, 50 u/s drift, determinism hash), bossTempestSplit.test.ts (8: pure rules, split, bar sum, storm at 70 percent, contact, win on both, bomb mid wind up, determinism hash), bossGw2Helpers.ts (stateHash).

## Test and build
npm run build: pass. npm test: 3275 pass, 3 fail. The failures are the accepted generator perf test ("200 levels under 350 ms") and 2 in tests/qa/bossFairnessSweep.test.ts (Proctor's file, I did not edit it). The sweep counts every Kind.BossPart, Hornets included, against MAX_PARTS (4). Warden bursts of 5 now put 5 Hornets live, so it reports "5 parts, cap 4" and its "maxParts toBe 4" check reads 5. Hornets live in their own pool (MAX_HORNETS) by design since GW1.

## Requests (outside my ownership)
- Proctor: in tests/qa/bossFairnessSweep.test.ts, count PartType.Hornet against MAX_HORNETS, not MAX_PARTS.
- Glow: give PartType.Tempestling (8) a look in src/render/partLooks.ts (a small Tempest body in the boss red; today it falls back to the pod look), and use sim:bossShield for the shield ring (Warden and Bastion).
- Chorus: optional shield up and drop cue on sim:bossShield.

## Risks
- Bastion drift 50 u/s replaces the 110 u/s pursuit, as the brief says. Charges, sweep, shields and Hornets carry the threat now. Watch on device that it does not feel slower.
- Tempestlings take damage at all times (parts have no window gate), like Broodlings and Gravitants.
- Warden fight at open fire is now about 60 s (band in bossFightLength widened to 50 to 75 s).

## Contracts for other roles
sim:bossShield as in src/core/events.ts (unchanged). BossView.shielded and shieldLeft are also true for Bastion now. PartType.Tempestling = 8 (w.rot heading, w.radius 27.6).

## Device check for Ryan
1. Level 5 Warden: about 10 s in it stops and shields. Count 10 Hornets in two waves of 5, and see that they chase faster. When the shield drops you get a 2 s window. Below half health, a ring of 12 bullets also leaves the body as the shield drops, then flies out after a 1 s charge. Rate fairness out of 5 (target 4).
2. Level 35 Bastion: kill all four turrets. It now creeps toward you slowly. About 12 s later it stops, its shots are absorbed for 3 s and 6 Hornets come out, then it sits open for 2 s. This repeats every 12 s.
3. Level 40 Tempest: bring it below a third. It bursts into two smaller Tempests that lap in opposite directions, lay Slime and dash behind markers, a little slower than the original. The bar keeps going down across both, and the level ends only when both die.
4. Note fps in each fight (Standard tier target 58 to 59 at the lowest).
