HAND-OFF Ledger: bar-fix. Branch feat/ledger-bar-fix.
Cause: the strips were added to the objective bar, but a fight shows the separate boss bar (bossBarEl). Fixed by moving the blue Shield over red Health strips and the BossBar.label name into the boss bar (hud.setBossBar, fed by emitHud, Adventure, Endless, Free Play); the objective bar reads "Defeat the boss" with an empty fill from the entrance, so one health bar remains.
Dev: src/ui/fightTimer.ts (sim clock, split and fury) shows on results (fightLine) or as a HUD toast in Endless and Free Play; Settings "Unlock all levels" (two tap confirm) via src/ui/devUnlock.ts; isDev also true with VITE_SOW_DEV=1; npm run build:cap:dev added.
Tests: bossBarStrips, fightTimer, devUnlock (unlock, isDev flag); hud and objective tests updated for the one bar design.
Known gaps: not checked on device. Dev unlock count of 50 is a constant in src/ui/devUnlock.ts. Settings "Unlock all levels" sits beside Reset and Back, only when dev.
