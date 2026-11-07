# Ledger: scrollbar

Create and check out branch feat/ledger-scrollbar before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/ (new src/ui/scrollbar.ts plus wiring in the screens that scroll and the CSS in src/ui/dom.ts), tests/ui/
Do not touch: src/audio/ (Chorus works there in parallel), src/core/events.ts (the 'ui:scroll' event is already stubbed by Fable, use it as is), src/game/, src/render/, src/input/, docs/ other than your hand off
Read first: src/ui/dom.ts (scroll containers: .sow-panel line 31, .sow-howto-body line 97, .sow-card line 118, .sow-fp-body line 169), src/ui/vectorFont.ts (pixel font helper), src/core/events.ts ('ui:scroll')

## Goal
Tester 2: "I did not know there was more information until i accidentally swiped up. It would be great to see a pixel themed vertical scroll bar on those informational screens so that i know to scroll. it would be cool to see the scroll icon on the scroll bar change colors too." Android hides the native overlay scrollbar until you scroll, so nothing signals overflow.

## Acceptance
- One shared module src/ui/scrollbar.ts: attachScrollbar(el, bus) returns a detach function. Applied to every scroll container above (level intro, results, pause and other cards, side panels, How to pages, Free Play setup). Native scrollbar hidden on those containers (scrollbar-width: none and ::-webkit-scrollbar).
- Visible only when scrollHeight exceeds clientHeight by more than 4 px; recomputed on content change and resize (ResizeObserver plus MutationObserver, disconnected on detach).
- Pixel look: a track of square cells (no border radius, 6 to 8 px wide, inside the right padding, never covering text or buttons), a stepped thumb made of square blocks sized to the visible fraction (minimum 24 px). Neon rim through the existing palette and applyNeon only.
- Thumb colour cycles with scroll progress through the neon hues (top cyan, through magenta and yellow, to green at the bottom or similar), stepped not smooth so it reads as pixel art; colour also shifts briefly brighter while scrolling, then settles.
- MORE cue: a small blinking down arrow plus "MORE" in the pixel font at the bottom edge of a container that overflows and sits at the top; it hides on the first scroll past 8 px and when the bottom is reached; it never blocks a button tap (pointer-events none).
- Touch: dragging the thumb scrolls the container; tapping the track pages by one visible height. Pointer events only for touch (pointerType touch or pen); no keyboard, mouse wheel or gamepad handlers.
- Emits bus 'ui:scroll' { delta, progress } at most once per animation frame while scrolling, delta summed since the last emit. No emit when delta is 0.
- Tests (jsdom): hidden when content fits, shown when it overflows, thumb size and position from scrollTop, colour step for progress 0, 0.5, 1, MORE hides after scroll, emit coalescing, detach removes listeners and observers. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-scrollbar.md under 20 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. applyNeon(n) only. No font or image files. No new dependency. No em or en dashes.
