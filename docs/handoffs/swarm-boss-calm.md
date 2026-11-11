# Swarm hand-off: boss-calm
Branch feat/swarm-boss-calm. Brood body 202 to 340, BROODLING.hp 300 to 450 (45 hits each); table.ts notes they bracket Ryan's two device fights (22 s and 150 to 170 s).
WAVE_BUDGET_WITH_BOSS is now a table by difficulty (easy 0, normal 0.25, hard 0.5, insane 0.6) read in keepScheduledEntry; before the entrance nothing changes.
Tests: bossCalm.test.ts (4 new). Pins moved by these changes: bossCore (Normal keeps 25 of 100, 2 of 10 grunts), bossFuryTwo and bossWardenFury (Brood values), bossFightLength (brood band 27 to 44 s on the bot).
npm test: only the accepted generator perf test fails; build passes.
Known gaps: Free Play uses the same table by difficulty (no separate setting found in code); Endless still holds the wave clock while a guardian lives.
