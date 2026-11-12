# Ledger: capture-mode

Create and check out branch feat/ledger-capture-mode before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/main.ts (capture glue only), src/ui/devGate.ts, a new src/ui/capture.ts if you want one, src/ui/hud.ts and src/ui/fightTimer.ts only where a dev readout is hidden, src/ui/freePlay.ts and src/ui/dom.ts only for item 5, tests/ui/
Do not touch: src/game/, src/levelgen/, src/render/, src/input/, src/audio/, src/core/, src/story/, package.json, index.html (if you truly need a CSS hook there, at most 5 lines, explain it in the hand off), docs/ other than your hand off
Read first: CLAUDE.md, src/ui/devGate.ts and its tests, src/main.ts (gateLocation, the build and viewport labels near line 242, hud.setDevCode near line 374, the dev fight timer near line 437, the dev panel near line 1061, stickCircles near line 1221), src/ui/hud.ts, src/ui/fightTimer.ts, src/ui/freePlay.ts (the enemy picker near line 215), src/ui/dom.ts

## Goal
Ryan ruled on 2026-11-12: a capture mode in the game, so scripted gameplay clips for shapelegend.com show a clean screen with no stick markers. The capture tool runs a production web build in a headless browser and reaches scenes with the existing dev knobs (?boss, ?level, ?seed, ?trough) and the Free Play setup. Also fix one layout bug found in the capture trial.

## Acceptance
1. New dev knob `capture`: `?dev=1&capture=1` turns capture mode on. It rides the existing dev gate: without dev=1 (or the VITE_SOW_DEV build flag) it does nothing, and the gate strips it like every other knob. Add 'capture' to DEV_KNOBS. A pure reader (for example isCapture(search)) with tests: on only for capture=1 exactly, off when the gated query is empty.
2. In capture mode, on every screen: the touch stick knobs are not drawn (the sticks still work exactly as before), the corner build label and the viewport label are hidden, the HUD dev level code is hidden, the dev fight timer toast is not shown, and the two finger long press that opens the dev panel is off (two thumbs held down for minutes must never open it). Everything a player sees in a release build stays: HUD, bomb and super buttons, pause, boss bar, cards, results.
3. Capture mode changes nothing in the simulation or in input handling: the same touches give the same game. No new storage key. normalDifficulty and every pin pass unchanged.
4. Without ?dev=1 in a release build there is zero visible change. A test proves the stick circles are still produced when capture is off.
5. Free Play setup layout bug (found at 1280 by 720 CSS px on the Free Play setup screen): the "All" and "None" buttons of the enemy picker render about 220 px tall. Make them the height of the other chips on that screen, with a touch target of at least 48 px, at 1280 by 720, at 915 by 412 (phone landscape) and at about 1080 by 900 (the Fold main screen). Change nothing else on that screen. Say in the hand off what caused it and how you checked each size.
- npm test and npm run build pass on the branch. Hand off at docs/handoffs/ledger-capture-mode.md under 12 lines: the URL that turns capture on, what it hides, the layout cause and fix, files touched, tests added. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only, no keyboard, mouse or gamepad handlers. No new dependency. No em or en dashes in any file you write. Nothing beyond this brief.
