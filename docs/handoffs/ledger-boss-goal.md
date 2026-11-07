HAND-OFF ledger: boss-goal
Branch: feat/ledger-boss-goal
Files changed: src/ui/intro.ts, src/ui/objective.ts, src/ui/results.ts, src/ui/howTo.ts, tests/ui/{intro,objective,results}.test.ts
Tests added: intro goal line, bar before and after atSec, non boss unchanged, results goalLine (3 new, 3 updated)
npm test: pass except accepted generator perf test (617ms vs 500)  npm run build: pass
How to verify on device: 1. Open a boss level intro: goal reads "Survive until <Boss> arrives, then defeat it (m:ss)". 2. After the main.ts request below, the bar reads BOSS IN m:ss, then the boss name draining. 3. Win: results show "<Boss> defeated".
Dependencies requested: none
Requests (changes outside my ownership): src/main.ts emitHud line 445: pass a 5th arg to objectiveProgress, { spec: level.boss, hpFraction: bossRead.hp / bossRead.maxHp } (1 before the boss spawns), only when level.boss is set. Without it the bar is unchanged.
Known gaps: the HUD bar change is inert until that wiring lands. Old How to boss line replaced with a two line version.
