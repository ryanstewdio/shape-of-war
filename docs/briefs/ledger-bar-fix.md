# Ledger: bar-fix

Create and check out branch feat/ledger-bar-fix before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: src/ui/, src/main.ts, src/vite-env.d.ts, package.json (scripts only, one new line), tests/ui/
Do not touch: src/game/, src/render/, src/core/, src/levelgen/, docs/ other than your hand off
Read first: src/ui/hud.ts (bossBarEl, setBoss, setObjective strips from feat/ledger-boss-bar), src/ui/objective.ts, src/game/bosses/bar.ts, src/ui/devGate.ts, src/ui/settings.ts, src/ui/levelSelect.ts, src/main.ts (emitHud, gated, Adventure unlock)

## Goal
Ryan's device check on 1d724e3 (2026-11-11): during the Brood fight he saw only a green bar. The blue Shield over red Health strips went into the objective bar, but the bar on screen during a fight is the separate boss bar (bossBarEl, tier coloured). Also, testing needs real fight times and a way to reach late levels.

## Acceptance
1. Bar: during a guardian fight exactly one boss health bar is on screen, and it is the boss bar players see: blue Shield strip over red Health strip (palette and applyNeon only), shield strip dims once empty, name above it reads the guardian or "Broodlings" (BossBar.label). Find out why the objective strips never showed and remove the duplicate so there is one bar. Before the entrance the "BOSS IN m:ss" phase is unchanged. Endless and Free Play guardians get the same bar.
2. Dev fight timer (dev builds only): on 'sim:bossDown' record the fight time on the sim clock (paused time never counts) from 'sim:bossEnter' to the kill, split at 'sim:bossSplit' and at 'sim:bossFury' stage 'break' when they happen. Show it on the results screen as one line, for example "Brood 1:52 (body 0:58, Broodlings 0:54)" or "Warden 1:05 (to break 0:31, break 0:05, enraged 0:29)". Endless and Free Play: a short HUD toast. 'sim:bossFury' is a fixed stub event in src/core/events.ts.
3. Dev unlock (dev builds only): a Settings button "Unlock all levels" that unlocks Adventure levels 1 to 50 on the stored seed (keeps stars and scores). Confirm with the existing in game confirm pattern (no browser dialogs).
4. Dev test APK: add the script "build:cap:dev": "tsc --noEmit && VITE_SOW_DEV=1 vite build --mode native --base=./ && cap sync". isDev is true when ?dev=1 or import.meta.env.VITE_SOW_DEV === '1', so every dev item (HUD level code, build label taps, panel long press, timer, unlock) is on in that build. The plain build:cap and the web build stay exactly as today. Type the env var in src/vite-env.d.ts.
- Tests: one boss bar, strips and label, Broodlings label, timer formatting and splits, timer ignores paused time, unlock writes 50 levels and keeps scores, isDev with the env flag on and off. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-bar-fix.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
