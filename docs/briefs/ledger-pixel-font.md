# Ledger: pixel-font

Create and check out branch feat/ledger-pixel-font before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/ (vectorFont.ts and every place it is used), tests/ui/
Do not touch: everything else
Read first: src/ui/vectorFont.ts and its call sites (search vectorText or the helper name), the HUD score code

## Goal
Font check on build 4a49922 (Ryan): the vector line font rates 3 and the HUD score is hard to read mid fight. He chose a pixel arcade style for headlines and the plain font for the HUD score.

## Acceptance
- Replace the line glyphs with an original pixel arcade font drawn in code (no font files): each glyph on a 5 x 7 cell grid (A to Z, 0 to 9, and . , : ! ? - + / % # x space), rendered as crisp square cells (SVG rects or a single path, shape-rendering crispEdges) with a neon glow from the current neon state and a 1 cell drop shadow in a darker shade of the same hue at low alpha (never black). Integer cell sizes only so cells stay sharp on the cover and main screens. Same call sites as now: title, headlines, results score, buttons.
- HUD score: back to the plain font, larger and bolder (tabular digits), readable mid fight on both screens.
- Accessibility unchanged (aria-label and hidden text). Tests: glyph coverage on the 5 x 7 grid, integer cell sizes at every call site size, HUD uses the plain font, headlines expose their text. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-pixel-font.md under 25 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No assets beyond PWA icons. Original glyph design only. No em or en dashes.
