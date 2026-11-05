# Ledger: howto

Create and check out branch feat/ledger-howto before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/ except src/ui/hud.ts and src/ui/hudFrame.ts (Thumbs moves the buttons there in parallel), src/main.ts, tests/ui/
Do not touch: src/ui/hud.ts, src/ui/hudFrame.ts, src/input/, src/game/, src/levelgen/, src/render/ (read only: shape specs for icons), src/audio/, docs/ other than your hand off
Read first: src/ui/vectorFont.ts (pixel font helper), the menu and level select screens, src/ui/enemyIntro.ts (names, types, icons), src/game/supers.ts and weapons (numbers, read only)

## Goal
Pixel font check (Ryan): "the level select font must also use the pixel font". New ask: "a How to section with a button on the main menu so new players quickly learn how to play, what the weapons and enemies are, par, rewards and other info. Not a full wiki, but enough for a 7 year old to understand and play better." Testers will play a round, then read it and judge whether it helps.

## Acceptance
- Level select: level numbers, headings and button labels in the pixel font (small body text may stay plain).
- Main menu: a "How to" button opening a paged guide (swipe or Next and Back buttons, a page dot row, Close), pixel font headings, short plain sentences at a 7 year old reading level (one idea per line, at most about 30 words per page section), large neon icons drawn from the game's own shapes. Pages: 1 Move and aim (two sticks, a simple drawing of thumbs); 2 Your goal (finish the level's goal before your lives run out; what Survive, Destroy and Score mean); 3 Bombs and Super (what each does, where the buttons are, when to use them); 4 Weapons (spread, rapid, pierce, orbit with icons, how pickups work, combos make super weapons); 5 Drones (attack, collect, ram and drone pickups); 6 Enemies (every enemy kind with its icon, name and a few words such as "chases you", "splits when hit"); 7 Hazards (gravity wells, snakes from wells, membranes, drift on drums); 8 Stars, par and rewards (stars by difficulty, Insane gives a 4th star, reaching par earns a life, bomb or weapon); 9 Difficulty and Free Play. Content comes from the real data tables where possible (enemy names and types, weapon names, Turbo numbers) so it stays true.
- Tests: every page renders, every enemy kind and weapon appears, text exposes headings, no page section over 40 words. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-howto.md under 30 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes.
