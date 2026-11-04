# Ledger: r5-screens

Create and check out branch feat/ledger-r5-screens before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Start from the current HEAD (local main may be ahead of origin; keep it).

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, tests/ui/, tests/settings/
Do not touch: src/game/, src/levelgen/, src/render/ (read only), src/audio/, src/core/difficulty.ts, docs/ other than your hand off
Read first: src/ui/results.ts, src/ui/intro.ts, src/ui/freePlay.ts and the setup screen, the Free Play config load and save (search sow.settings.freePlay)

## Goal
Gate R4 (build 64a20eb, Ryan): results screen 2 of 5 ("still not every value labelled, not enough padding"), intro 3.8; "intro and results screens still have minor clustering and developer information, but if dev info is needed for testing keep it". Free Play: "when I toggled wells off I could not reactivate them: toggled on again and played, no wells appeared."

## Acceptance
- Results: one clear column with a strong hierarchy and 24 px gaps between blocks: (1) outcome headline large (Victory or Defeated) with level and difficulty under it; (2) Score block: big score, then a labelled row "Par 3.3M", a bar with three labelled star ticks and the score marker, stars earned with the cap text ("Normal: up to 2 stars"); (3) "Best" with its stars; (4) par reward when earned; (5) two big buttons. Everything else (seed, hash, build, kills, time, multiplier, geoms) moves into a collapsed "Details" row at the bottom, closed by default, each value labelled ("Seed 42", "Kills 412", "Time 3:31"). No unlabelled text anywhere.
- Intro: same treatment: goal and victory first, star targets, new enemies, difficulty and Start; seed and loadout details in a collapsed Details row; at least 16 px gaps; nothing touching the card edges on the cover or main screen.
- Free Play wells: find why turning wells back on does not restore them (the saved config, the control state, or the value passed to freePlayLevel) and fix it with a test that toggles off, saves, reloads, toggles on and builds a run whose config has wells normal. If the cause is on the level side, say so in the hand off for Foundry.
- Tests for the layout content (labels, Details collapsed by default). npm test and npm run build pass on the branch except tests/game/difficulty.test.ts and tests/qa/normalDifficulty.test.ts (Forge updates them in parallel). Hand off at docs/handoffs/ledger-r5-screens.md under 40 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes.
