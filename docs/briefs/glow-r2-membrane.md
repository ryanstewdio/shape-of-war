# Glow: r2-membrane

Create and check out branch feat/glow-r2-membrane before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: everything else
Read first: the membrane drawing from glow-membrane (search membrane in src/render), the solid obstacle and ring bar drawing on flat, tilt and drum paths, src/core/events.ts (sim:enrage, sim:driftBurst, read only)

## Goal
Release gate R2 (Ryan): "the dim membrane looks poor quality, like a bad cartoon. Membrane should look near identical to the ring barriers but with minor openings, and when an enemy moves through, the adjacent area glows red while it passes; when they pass through they become enraged, which makes them hot red." Also the drift bursts need to be noticeable.

## Acceptance
- Membrane: drawn with the exact ring bar style (same stroke, glow and colour as solid bars) but broken into segments with small regular openings (about 10 percent of the length), so it reads as the same barrier with gaps. While an enemy overlaps it, the membrane section within 60 u of the enemy glows red (fade in 0.1 s, out 0.4 s). Works on flat, tilt and drum paths.
- Enraged enemies: on sim:enrage, tint that enemy hot red (body and glow, through the palette and applyNeon), add a subtle flicker, for the rest of its life; the renderer reads the enrage flag Forge exposes in parallel (if not on main yet, track ids from the event).
- Drift burst: on sim:driftBurst draw speed streaks across the drum in the burst direction for the telegraph and the burst, so it is unmistakable.
- Tests for the membrane style, the red glow region, the enrage tint, the streaks. npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 40 lines as your final message.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. applyNeon(n) only. No em or en dashes.
