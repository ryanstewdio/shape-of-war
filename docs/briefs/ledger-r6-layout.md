# Ledger: r6-layout

Create and check out branch feat/ledger-r6-layout before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/stars.ts, tests/ui/, tests/settings/
Do not touch: src/game/, src/levelgen/, src/render/, src/audio/, src/core/difficulty.ts (read only: parScale), docs/ other than your hand off
Read first: src/ui/results.ts, src/ui/intro.ts, src/core/stars.ts, src/core/difficulty.ts (parScale per difficulty, Foundry calibrates the values in parallel; all 1 until then)

## Goal
Gate R5 (build 420adcb, Ryan): results 3.75 ("the Details control should look like the Next and Menu buttons; remove the word Difficulty so intro and results just show the difficulty setting"); intro 3.75 ("Goal should sit to the left of the goal statement, aligned with the Victory line below it; the level title should only be Level # and not 'rectangle arena' or 'circle', that is a detail"). Par is near impossible on Easy (level 1 Easy: 129k against par 751k).

## Acceptance
- Details: same button style as Next and Menu (size, border, glow), still collapsed by default.
- Difficulty: show only the setting as a chip ("Easy", "Insane"), no "Difficulty" label, on intro and results.
- Intro: a two column label grid: "Goal" and "Victory" labels in a left column, their statements in the right column, aligned on one baseline per row. Title is "Level 12" only; the arena type and size move into Details.
- Par and stars follow difficulty: everywhere par and the three star targets are shown or scored (intro, HUD star line, results, best stars), multiply them by DIFFICULTY[d].parScale for the run's difficulty. Tests with a stubbed table.
- npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-r6-layout.md under 35 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes.
