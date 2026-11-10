# Ledger: hud-clock

Create and check out branch feat/ledger-hud-clock before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/hud.ts, src/ui/hudFrame.ts, src/ui/objective.ts, src/ui/vectorFont.ts (only to add digits or glyphs the clock needs), src/main.ts (emitHud only), tests/ui/
Do not touch: src/ui/menu.ts, index.html, vite.config.ts, .github/, src/ui/story/ and src/ui/levelSelect.ts (story work), src/levelgen/ (Foundry shortens levels in parallel), src/audio/ (Chorus adds warning sounds), src/native/, src/core/events.ts ('ui:timeWarn' is stubbed by Morpheus; use it as is), docs/ other than your hand off
Read first: src/ui/objective.ts (bar label includes the time today), src/ui/hud.ts and hudFrame.ts, src/ui/vectorFont.ts (pixel arcade font), src/core/events.ts ('ui:timeWarn')

## Goal
Tester: move the clock out of the green and yellow objective bar, because once the goal is reached you cannot see how much time is left, and make the timer retro 8 bit. Ryan ruled 2026-11-10: the clock must be more prominent and themed, especially in race against time levels, with warnings at 1 minute, 30 seconds and 10 seconds.

## Acceptance
- A dedicated clock above or beside the objective bar (not inside it), in the pixel arcade font with a neon frame, always readable on the Fold 7 cover and inner screens and a 360 px wide phone in landscape, never under the thumbs or the HUD score.
- Timed objectives (scoreInTime and survive) count down; destroy and boss levels show time played, smaller. The bar keeps the goal progress only.
- Warnings: at 1:00 left the clock turns yellow and pulses once; at 0:30 orange with a pulse; from 0:10 red, larger digits and a pulse every second; no flashing faster than 3 times a second. Emit 'ui:timeWarn' { secondsLeft } at 60, 30 and every whole second from 10 down to 1 (paused time does not count; never twice for the same second).
- Colours through the palette and applyNeon only. Touch only. No image or font files.
- Tests: clock text per objective kind, warning thresholds and colours, emit once per threshold across pause and resume, bar label without time. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/ledger-hud-clock.md under 15 lines with a device check. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
