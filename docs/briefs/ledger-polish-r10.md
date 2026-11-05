# Ledger: polish-r10

Create and check out branch feat/ledger-polish-r10 before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: src/ui/, src/input/ (button drawing only), tests/ui/, tests/input/
Do not touch: everything else
Read first: the super button charge fill (search in src/ui/hud.ts, src/ui/hudFrame.ts and src/input/ for the super charge or fill), the How to guide pages 3, 4 and 5, the pause screen

## Goal
Check on build 4bca5fb (Ryan): three small changes before the tester release.

## Acceptance
- Super button charge: the charging fill uses a distinct colour from the button's resting fill (for example the super colour at 25 percent for empty, a contrasting bright fill rising from the bottom as it charges), and when full the whole button pulses brightly (fill 70 percent, rim glow 1.5x, a 1 Hz pulse) with the label switching to "READY", so the full state is unmistakable. Through the palette and applyNeon.
- How to pages 3, 4 and 5: every section title in its own neon colour, like page 2.
- Pause screen: the title in the pixel font.
- Tests for each. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-polish-r10.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No em or en dashes.
