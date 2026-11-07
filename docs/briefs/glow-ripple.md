# Glow: ripple

Create and check out branch feat/glow-ripple before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/render/ (pond wave look, reusing src/render/ripple.ts or the lattice kicks), tests/render/
Do not touch: src/game/ (Forge emits the events in parallel), src/levelgen/ (Foundry), src/audio/ (Chorus), src/ui/ (Ledger), src/core/ (Fable stubs: 'sim:rippleWarn', 'sim:ripple', src/core/pondRipple.ts), docs/ other than your hand off
Read first: src/core/pondRipple.ts, src/core/events.ts, src/render/ripple.ts (explosion grid ripple), src/render/lattice/, docs/pixi8-cheatsheet.md

## Goal
Tester 3: "a rectangle that randomly has sudden ripples or waves like a rock being thrown into a still pond." The sim pushes the ship and enemies with the wave; the grid must show it clearly.

## Acceptance
- On 'sim:rippleWarn': a small telegraph at (x, y) for RIPPLE_WARN_SEC, for example a tightening pulsing ring or a drop marker, so the player sees where it will hit.
- On 'sim:ripple': a pond wave on the grid whose front moves at POND_WAVE_SPEED and lives POND_WAVE_LIFE (matching the sim exactly), with two or three trailing rings like water, amplitude by strength, fading out. Clearly bigger and slower than the explosion ripple. The grid returns flat after.
- Works with tilt off, low and high. Colours through the palette and applyNeon only.
- Perf: no extra cost when no wave is live; at most 3 live pond waves; frame budget on the Fold 7 kept (note your measured cost in the hand off).
- Tests: wave radius over time matches the sim constants, telegraph lifetime, cleanup after life. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-ripple.md under 15 lines with a dev URL to see it (a hand built way to fire one under ?dev=1 is fine if it stays behind dev). Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 API only. applyNeon(n) only. No asset files. No em or en dashes.
