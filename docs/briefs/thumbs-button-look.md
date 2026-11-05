# Thumbs: button-look

Create and check out branch feat/thumbs-button-look before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/input/, src/ui/hud.ts and src/ui/hudFrame.ts (button drawing and labels only), tests/input/, tests/ui/hud*.test.ts
Do not touch: other src/ui files (Ledger works there in parallel), src/game/, src/render/, src/audio/, docs/ other than your hand off
Read first: src/input/stack.ts, src/input/buttons.ts, src/input/visuals (or wherever the button rings are drawn), src/ui/vectorFont.ts (pixel font helper, read only)

## Goal
Button check on build 68d010f (Ryan): comfort 4, reach yes, "visually needs slight improvement: the circles are not equal size and are unaligned. They should be slightly filled at 25 percent opacity so they look like joystick buttons, with the inside colour pixelated to match, and a single label above each: Bomb and the super's name."

## Acceptance
- Both buttons the same diameter (visual ring and hit circle), centres on one vertical line, 12 px gap kept.
- Arcade button look: a filled disc at 25 percent opacity in the button colour (bomb and super keep their current colours through the palette and applyNeon), a 1.5 to 2 px neon rim, and an inner pixel pattern (a ring of small square cells, or a dithered 2 x 2 checker inside the disc) in the same colour so it reads as pixel styled; pressed state brightens the fill to 50 percent; cooldown or empty state dims it as today.
- One label above each button in the pixel font, small (cell size 2 px), centred: "BOMB" and the super's name ("TURBO", "HOMING", "DETONATE"); labels never overlap the other button or the HUD.
- Tests: equal radii, aligned centres, label text per super, labels inside the safe area. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/thumbs-button-look.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No em or en dashes.
