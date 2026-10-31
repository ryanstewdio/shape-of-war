# Ledger: hud-menu

Create and check out branch feat/ledger-hud-menu before any edit. Never push main.

Branch: feat/ledger-hud-menu (create and check out before any edit; never push main)
Model: opus
Owned paths: src/ui/, src/main.ts, tests/ui/
Do not touch: src/game/, src/render/, src/audio/, src/input/
Read first: src/ui/hud.ts, src/ui/hudFrame.ts, src/ui/menu.ts (or the menu screen file), src/ui/dom.ts, src/core/events.ts (hud:weapon, fx:droneArm, fx:droneExpire, fx:weaponCombine)

## Goal
Two items. (1) GW1: the drone pickup "is not entirely clear when it happens": the HUD needs a drone indicator. (2) Ryan wants the main menu redesigned in the spirit of a classic neon arcade title screen: a glowing bordered panel with stacked neon framed menu rows over the grid, the selected row framed in a warm highlight. This is an original design: no logo, wordmark, typeface or layout copied from any existing game; the title stays "Shape of War" in the game's own neon style.

## Acceptance
- Drone indicator beside the weapon indicator: mode name (Homing, Detach, Rapid, Double) in the mode colour, a 20 s countdown bar, a flash on fx:droneArm and a fade on fx:droneExpire; the weapon indicator flashes and shows the pair name on fx:weaponCombine (Hail, Trident, Halo, Needle, Whirl, Eclipse) with a short "combined" caption for 1.5 s; both screens, no overlap with the arena or the boss bar (extend the hudFrame no overlap tests).
- Menu: a centred neon panel with a double glowing border over the grid, the title in the existing neon style, four stacked rows (Play or Continue, Level select, Endless, Settings) each a framed neon rectangle with a glow, the focused or last used row in a warm orange frame, the seed and level info line below, and a thin footer line with the build id; rows animate in with a 200 ms stagger; touch only (tap selects, no keyboard focus code); readable on both the cover and main screens with the 44 px minimum hit size; the existing menu callbacks and tests keep working.
- Tests: indicator state machine, no overlap on both screens, menu row layout fits both viewports, hit sizes.
- npm test and npm run build pass on the branch (the one accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency without declaring it in the hand off. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): one geometry buffer per layer, no per frame allocation.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build 2>&1 | tail -5` once before the commit. The generator perf test "200 levels under 350 ms" may fail in this VM because it is slower than the Mac; that single failure is accepted, note it and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/ledger-hud-menu.md (under 50 lines): what changed, files touched, tests added, test and build output summary, risks, open questions, render or event contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
