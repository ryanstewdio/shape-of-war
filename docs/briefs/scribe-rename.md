# Scribe: rename

Create and check out branch feat/scribe-rename before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/ui/ (player visible name strings only), index.html, public/manifest.webmanifest, README.md, tests that assert the name
Do not touch: src/game/, src/levelgen/, src/render/, src/audio/, src/input/, src/core/ (storage keys), src/economy/ (Ledger works there in parallel), package.json, capacitor files (Shipwright works in parallel), docs/ other than your hand off and README.md
Read first: docs/16-public-plan.md section "New name", src/ui/menu.ts (GAME_TITLE and the pixel title width note)

## Goal
Ryan ruled the game's public name is "Shape Legend" (formerly "Shapes of War", taken by another game).

## Acceptance
- Every player visible name becomes "Shape Legend": menu pixel title (GAME_TITLE), splash, How to, results or any screen text, index.html title and meta, manifest name and short_name ("Shape Legend"), README.md title and intro.
- The pixel title still fits on the Fold 7 cover screen and on a 360 px wide phone in landscape (check the menu width note and its test).
- Keep unchanged: the repo name, package.json name, the GitHub Pages base path /shape-of-war/, every storage key prefix (sow.), build ids, generator data, file names. Saved progress must survive the update.
- grep -rn "Shapes of War" src index.html public README.md prints nothing.
- Tests updated; npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/scribe-rename.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
