# Ledger hand-off: howto

Branch: feat/ledger-howto (base 7397d0b)

- Level select (src/ui/levelSelect.ts): the title, each level number and the Prev, Next and Back labels use the pixel font. Star glyphs and the page line stay plain. Each button reads "Level 7, 2 stars".
- Main menu (src/ui/menu.ts): a sixth yellow framed row, How to. When stacked it sits under the five rows. On the cover screen it sits under the info line in the title column, so the short screen still fits.
- New src/ui/howTo.ts: a paged card with Back, Next and Close, a row of 9 page dots and swipe left or right. Headings are in the pixel font and lines are short and plain. Pages: Move and aim, Your goal, Bombs and Super, Weapons, Drones, Enemies, Hazards, Stars par and rewards, Difficulty and Free Play.
- Words come from the real tables: FOE_INFO names and types, WEAPON_KINDS, COMBO_TABLE, the Turbo and super numbers, DRONE_ARM_SEC, DRONE_MODES, STAR_CAP, INSANE_STARS and the DIFFICULTY lives.
- Icons are the game's own shape specs (enemies, well, drone, pickups, mine) plus stroke drawings (thumb sticks, super ring, membrane, drift, stars). enemyIntro.ts exports specCanvas and parReward.ts exports strokeCanvas so the guide can use them.
- main.ts: How to opens the card over the menu, with no flow state. Close hides it.
- The new pixel sites in PIXEL_SITES all draw whole px cells.

Tests: tests/ui/howTo.test.ts is new (23 tests). They cover: all nine pages render, every heading is spoken, every enemy kind and weapon appears with its icon, numbers come from the tables, no section is over 40 words, swipe and buttons, the menu row and fit, and level select in the pixel font. menu, release and vectorFont tests are updated for the sixth row.
npm test: 4689 pass, 1 fail (levelgen "200 levels under 500 ms", the accepted perf exception). npm run build: pass. Banned API grep: empty.

Device check:
1. Menu, cover then main: How to is a yellow row and the menu still fits inside the border.
2. Tap How to: page 1 shows the pixel title, two thumb stick icons and short lines. Swipe left, or tap Next, through all 9 pages. The dots follow along and Back is hidden on page 1. Long pages scroll up and down.
3. Close returns to the menu. Level select shows pixel level numbers and pixel Prev, Next and Back.

Known gaps: not checked on a device. The text says the bomb and super are "on the right" and the super is "just above the Bomb button". That is true before and after Thumbs' button move, but please recheck the wording once feat/thumbs-buttons lands.
