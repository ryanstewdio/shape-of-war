# Ledger: vector-font

Create and check out branch feat/ledger-vector-font before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/, src/main.ts, tests/ui/
Do not touch: src/game/, src/levelgen/, src/render/ (read only: palette and applyNeon state), src/audio/, docs/ other than your hand off
Read first: the title splash, menu, intro card, results screen and HUD headline code in src/ui/, how the UI reads neon state (search getNeonState)

## Goal
Ryan wants a font that matches the geometric neon theme and the 1980 to 2000 arcade music. No font files are allowed (only PWA icons), so draw an original vector stroke font in code, used for headlines only (Ryan's choice); body and small text keep the current clean font for readability.

## Acceptance
- src/ui/vectorFont.ts: an original stroke font in the spirit of vector arcade lettering (straight segments and a few arcs on a 4 x 6 grid, consistent stroke width, slightly squared corners): A to Z, 0 to 9, and . , : ! ? - + / % # x and space. A pure layout function (text, size, letterSpacing) returns SVG path data and width; a DOM helper renders an inline SVG with the neon glow (stroke in the palette colour with a soft drop shadow glow from the current neon state).
- Use it for: the title splash and menu title ("SHAPES OF WAR"), screen headlines (level title "LEVEL 12", Victory, Defeated, Par reached, Free Play), the big score number on results, button labels (Start, Next, Retry, Menu, Details), and the HUD score digits if they stay readable at their size on the cover screen (otherwise skip the HUD and say so). Everything else keeps the current font.
- Accessibility: every vector headline keeps the text in an aria-label and a visually hidden span, so screen readers and tests still read it.
- Tests: every supported glyph has paths and a positive advance; unknown characters fall back to a box; layout width is monotonic in text length; headlines expose their text. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-vector-font.md under 30 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes. Original glyph design only: do not copy any existing font's outlines.
