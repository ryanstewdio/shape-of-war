# Forge: r2-enrage

Create and check out branch feat/forge-r2-enrage before any edit. Never push main. Start from the current local main.

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*
Do not touch: src/game/bosses/, src/core/ (read only: events.ts has sim:enrage and sim:driftBurst; bonus.ts has StartBonus), src/levelgen/, src/render/, src/audio/, src/ui/, src/main.ts, tests/qa/ (read only), docs/ other than your hand off
Read first: src/core/bonus.ts, src/core/events.ts (sim:enrage, sim:driftBurst), src/game/game.ts (GameOptions), the membrane code and the open drum drift code (search membrane and drift in src/game)

## Goal
Release gate R2 (Ryan): enemies that pass through a membrane should become enraged (hot red, chase faster); the drift bursts on open drums are so minor they are hard to notice; reaching par earns a start bonus for the next level.

## Acceptance
- StartBonus: GameOptions.startBonus?: StartBonus. life adds 1 life at start; bomb adds 1 bomb; weapon starts the level with that base weapon active for its normal duration. Tests for each; absent changes nothing (tests/qa unchanged).
- Enrage: an enemy that fully crosses a membrane becomes enraged for the rest of its life: move speed x1.5 and turn rate x1.3 (its attack logic unchanged), a flag readable by the renderer (say where), and 'sim:enrage' { id, x, y } once at the moment it emerges. Bosses and boss parts never enrage. Tests: crossing sets it once, speed scale, flat levels without membranes unchanged.
- Drift bursts: make bursts unmistakable: 0.6 s before each burst emit 'sim:driftBurst' { inSec: 0.6, dir }, then burst to 4x the base drift (scaled by driftScale) for 1.5 s; base drift stays as today. Tests for timing, the event and the speed.
- npm test and npm run build pass on the branch (accepted perf exception aside). Commit on the branch. Do not push; the dispatcher reports the branch. Hand off under 40 lines as your final message.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. No em or en dashes.
