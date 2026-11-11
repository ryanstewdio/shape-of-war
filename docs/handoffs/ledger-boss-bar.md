HAND-OFF ledger: boss-bar
Branch: feat/ledger-boss-bar
Files: src/ui/objective.ts, src/ui/hud.ts, src/main.ts, tests/ui/{objective,r6Layout,bossBarStrips}.test.ts
main.ts feeds bossBar(readBoss) via BossBarInput { spec, bar }; ObjectiveProgress gains shield and health; label is BossBar.label or the guardian name. Entrance phase unchanged.
HUD: two thin strips in the objective bar, blue Shield over red Health via toneColour and neon state; cracked shield strip dims to 0.3.
Tests: 4 new (3 strips, plus label and entrance cases in objective.test.ts). npm test passes except the accepted generator perf test; build passes.
Verify: start a boss level, watch the shield strip empty then health, dim on crack; Brood split reads Broodlings.
Dependencies: none. Requests: none. Known gaps: strip colours repaint on the next 100 ms objective update after a neon change.
