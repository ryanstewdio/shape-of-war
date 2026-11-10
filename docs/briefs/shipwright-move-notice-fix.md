# Shipwright: move-notice-fix

Branch: fix/shipwright-move-notice-fix (create and check out before any edit; never push main)
Model: sonnet
Owned paths: src/ui/moveNotice.ts, tests/ui/moveNotice.test.ts
Do not touch: everything else, including src/ui/menu.ts (its one call to addMoveNotice stays as is), .github/, vite.config.ts
Read first: CLAUDE.md, src/ui/moveNotice.ts, src/ui/menu.ts, src/ui/dom.ts, src/ui/hudFrame.ts (aspectClass)

## Goal
Ryan's device check on the old URL (2026-11-10): the move banner is fine on the Fold 7 inner screen, but on the folded cover screen it sits on top of the Settings button. Testers on phones have the same narrow shape. Fix the banner so it never blocks a menu control.

## Acceptance
- The banner sits at the top of the menu screen (respect the safe area inset at the top), not the bottom, and stays a single compact strip: font size and padding no larger than now, text may wrap to at most two lines on the narrowest aspect class.
- Add a close control at the right end of the strip (a plain "X" glyph in the menu font, hit area at least MIN_HIT_PX from dom.ts). Tapping it removes the banner for the rest of this page load. No storage writes, no network calls. Tapping the text still opens https://play.shapelegend.com/.
- Read menu.ts and its CSS classes to confirm the top strip cannot cover the title row's controls in any aspect class; if the title area holds a control, place the strip so it does not overlap it and say how in the hand-off.
- Tests: the existing hostname cases stay; add jsdom tests that addMoveNotice adds one banner with a close control, that tapping close removes it, that a second call adds nothing, and that a non github.io hostname adds nothing.
- npm test and npm run build pass on the branch; the Pixi v7 grep from CLAUDE.md prints nothing.

## Rules
TypeScript strict, no any. Touch only, no keyboard, mouse or gamepad handlers. No new dependency. No em or en dashes in any file you write.

## Hand off
Write docs/handoffs/shipwright-move-notice-fix.md: what changed, files touched, tests added, test and build summary, how the strip avoids the title row on each aspect class, risks, open questions, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). Commit and push the branch. Stop.
