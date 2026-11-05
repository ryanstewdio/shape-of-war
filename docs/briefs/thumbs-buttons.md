# Thumbs: buttons

Create and check out branch feat/thumbs-buttons before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/input/, src/ui/hud.ts and src/ui/hudFrame.ts (button placement only), tests/input/, tests/ui/hud*.test.ts
Do not touch: other src/ui files (Ledger is building the How to guide in parallel), src/game/, src/render/, src/audio/, docs/ other than your hand off
Read first: src/input/reach.ts (the thumb reach model), the bomb and super button layout (search in src/ui/hudFrame.ts and src/ui/hud.ts), tests for button reach

## Goal
Ryan: "the Bombs and Super position still feels awkward because it is under my right thumb usually." He chose: stacked high on the right edge, above the right stick's travel, still reachable with a thumb stretch.

## Acceptance
- Move bomb and super to a vertical stack on the right safe edge, above the aim stick rest zone: super on top, bomb below it, the lower button's bottom edge at least one stick radius plus 24 px above the top of the aim rest zone's travel, with hit circles at least 64 CSS px, 12 px apart, inside the safe area on both the cover and main screens, never overlapping the HUD top band. Update the reach model so the aim stick's ring never covers either button while aiming from the rest zone, and the reach from the rest zone to each button stays within a comfortable stretch (state the numbers).
- Tests: positions on both aspect classes, no overlap with the aim ring travel or the HUD, inside safe areas with notch insets. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/thumbs-buttons.md under 25 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only, no keyboard, mouse or gamepad handlers. No em or en dashes.
