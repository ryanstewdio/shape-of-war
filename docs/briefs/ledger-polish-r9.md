# Ledger: polish-r9

Create and check out branch feat/ledger-polish-r9 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/ui/ except src/ui/hud.ts and src/ui/hudFrame.ts, tests/ui/ except tests/ui/hud*.test.ts
Do not touch: src/ui/hud.ts, src/ui/hudFrame.ts, src/input/, everything outside src/ui/, docs/ other than your hand off
Read first: the How to guide pages, the Endless intro card, the main menu, the Free Play setup screen, src/ui/vectorFont.ts

## Goal
Check on build 68d010f (Ryan): How to 4, overall 4. Changes he asked for.

## Acceptance
- How to page 2: each goal word (Survive, Destroy, Score, Boss) in its own neon colour; apply the same treatment to every similar list of titles in the guide (weapons, drones, supers, hazards, difficulties) so each named item has a distinct colour from the palette.
- Endless intro card: remove the New enemies block (the How to guide covers them).
- Main menu: every button label in the pixel font; move How to directly above Settings.
- Free Play setup screen: the Back button in the pixel font, matching Start.
- Tests for each change. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-polish-r9.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No em or en dashes.
