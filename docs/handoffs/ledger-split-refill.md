HAND-OFF Ledger: split-refill. Branch feat/ledger-split-refill.
Cause: main.ts fed the boss bar only while readBoss().active; Brood's body is gone at the split, so the feed stopped and the bar kept its old near-empty fill. Now it follows barOn (new pure bossBarFeed in src/ui/boss.ts), so the Broodlings bar (full, label "Broodlings") shows at the split.
Dev fight line also shows as a 6 s HUD toast in every mode (FIGHT_TOAST_MS).
Tests: tests/ui/bossSplitRefill.test.ts (5). npm test: only the accepted generator perf test fails; build passes.
Known gaps: not checked on device.
