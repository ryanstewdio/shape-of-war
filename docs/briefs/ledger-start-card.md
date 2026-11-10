# Ledger: start-card

Create and check out branch feat/ledger-start-card before any edit. Never push main. You have explicit go ahead now: call add_repo for the repository named by git remote -v (stoopstoop/shape-of-war or, after the transfer, ryanstewdio/shape-of-war) with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/ui/intro.ts, src/ui/details.ts, src/ui/vectorFont.ts (new glyphs only), src/ui/objective.ts and src/ui/hud.ts (clock visibility only), src/core/settings.ts (reset progress only), src/main.ts (intro card actions only), tests/ui/, tests/core/ or tests/settings/ for reset
Do not touch: src/levelgen/, src/game/, src/render/, src/audio/, src/story/ (read only), docs/ other than your hand off
Read first: src/ui/intro.ts (level start card: goal line, buttons), src/ui/vectorFont.ts (pixel font), src/ui/objective.ts (clockView), src/core/settings.ts (reset progress, story keys sow.progress.callsign and sow.progress.storySeen)

## Goal
Ryan's device check on ab5e14d (2026-11-10): the level start card has no way back to the menu; he wants a mission type shown above the goal; no timer on missions that are not timed; and Reset progress must replay the opening.

## Acceptance
- Redesign the level start card as Ryan's chosen "focused stack" (2026-11-10), with more padding, because the card has become crowded. Top to bottom: "LEVEL 6" small; the Mission type as the headline in a neon pixel frame; one plain goal line; the three star targets in one compact row; "New:" with enemy icons only (no descriptions; the story briefings now introduce enemies); the difficulty chips in one row; Start (primary, larger) and Return to Menu side by side; a collapsed Details row holding the victory text, the star cap line, the new enemies' short notes, loadout, arena and seed. Nothing scrolls on the Fold 7 inner screen; on the cover screen and a 360 px wide phone the card may scroll with the existing pixel scroll bar, with Start and Return to Menu always visible without scrolling.
- Start card gets a third button "Return to Menu" beside Start (same pixel style, touch target at least the existing button size) that returns to the main menu without starting the level. Fits the Fold 7 cover and inner screens and a 360 px wide phone in landscape.
- A "Mission type" line above "Goal" in the pixel font, each type in its own colour through the palette and applyNeon: scoreInTime "RUSH & SCORE" gold, survive "HOLD OUT" cyan, destroy "SEEK & DESTROY" red, boss levels "GUARDIAN" magenta. Endless and Free Play cards keep their current text. Add the "&" glyph to the pixel font if it is missing.
- HUD clock: shown only on timed missions (scoreInTime and survive, counting down). Destroy and boss levels show no clock at all (today they count up from 0:00). Warnings unchanged.
- Reset progress clears everything, including sow.progress.storySeen and sow.progress.callsign, so the next Adventure start plays the opening and asks for a call sign again. The confirmation text says so.
- Tests: the third button returns to the menu, mission label per objective, clock hidden on destroy and boss levels, reset clears the story keys. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-start-card.md under 12 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No image or font files. No em or en dashes.
