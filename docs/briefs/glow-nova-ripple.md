# Glow: nova-ripple

Create and check out branch feat/glow-nova-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/render/ (pondWave.ts, latticeView.ts, ripple.ts, renderer.ts wiring), tests/render/
Do not touch: src/game/ (Forge moves the trigger to the nova well kill in parallel), src/levelgen/, src/audio/, src/ui/, src/core/ (Fable stubs), docs/ other than your hand off
Read first: src/render/pondWave.ts, src/render/renderer.ts (pond events and the ?dev=1&pond=1 drops), src/core/pondRipple.ts, docs/pixi8-cheatsheet.md

## Goal
Ryan's T3 device check on 1f1efb5: the scheduled ripples were "underwhelming and almost not noticeable. I expected the plane (floor) to animate more. With so much going on it's hard to understand the waves are coming." Push rated 1 (no push felt). His direction: attach the ripple to gravity wells. A ripple happens only when a well in super nova is destroyed, right after it is destroyed. No visual warning and no alert sound: just the ripple pushing ship and enemies, with one short wave sound (deep whoomp plus watery whoosh) at the wave start. src/core/pondRipple.ts now has POND_WAVE_WIDTH 160 and POND_WAVE_LIFE 3.2 (Fable); RIPPLE_WARN_SEC is deprecated, stop using it; Fable deletes it and 'sim:rippleWarn' at merge.

## Acceptance
- Remove the telegraph ring and the 'sim:rippleWarn' listener. On 'sim:ripple' the wave starts at once.
- The floor must clearly move: amplitude about three times today (roughly 40 to 80 u by strength), a wider crest matching POND_WAVE_WIDTH 160, life POND_WAVE_LIFE 3.2, two trailing crests, and the crest lines brighten toward white as they lift so the wave reads through a busy fight. It must be obvious in a still screenshot mid wave with tilt off.
- Also bend the grid on the low effects tier with tilt on if it can be done within budget; otherwise state the gap.
- Drums: the wave wraps across the seam (the drum pen already handles owner based projection).
- Keep the dev drop (?dev=1&pond=1) but make it fire a strength 1 wave every 4.5 s with no telegraph.
- Perf: no cost when no wave is live; at most 3 live; report measured cost.
- Tests: radius over time from the constants, no telegraph, amplitude range, cleanup flat. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-nova-ripple.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 API only. applyNeon(n) only. No asset files. No em or en dashes.
