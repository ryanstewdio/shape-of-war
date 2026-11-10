# Ledger: scene-revise

Create and check out branch feat/ledger-scene-revise before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/story/, src/ui/story/, src/main.ts (story and input lines only), tests/story/, tests/ui/story*.test.ts
Do not touch: src/levelgen/ (Foundry), src/audio/ (Chorus softens warnings in parallel), src/ui/hud.ts and hudFrame.ts, src/core/events.ts, docs/ (Morpheus already revised docs/19), everything else
Read first: docs/19-story-bible.md (revised 2026-11-10: new opening with 7 panels and two Torus lines, new level 1 Grunt briefing with 4 panels, "the Dim" capitalised everywhere, Geoms named), src/story/scenes.ts, tests/story/scenes.test.ts, src/main.ts (story hooks and the loop step)

## Goal
Ryan rewrote the opening and the first briefing and capitalised the Dim. He also found a bug: after the opening, the first level shows the pause screen ("Resume") instead of play.

## Acceptance
- src/story/scenes.ts matches docs/19 word for word again (opening 7 panels, P5 is a new Dim spreading visual: colour drains from the edges with grey static creeping inward; P6 and P7 Torus lines; Grunt briefing P2 single line, P3 and P4 new). The data tests allow the opening exception only: 7 panels and two Torus lines for 'opening'; every other scene keeps 2 to 4 panels and at most one Torus line.
- Resume bug: find the cause and fix it, with a test that reproduces it. Likely causes to check first: taps on the scene (Skip sits top right, where the pause button is) or the call sign keyboard reaching the touch input while a scene holds the sim, so a queued pause press fires when play starts; or the keyboard opening triggering a visibility or resize pause. Presses made while a scene is open must be dropped, the way the intro card drops them.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-scene-revise.md under 12 lines naming the cause. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes.
