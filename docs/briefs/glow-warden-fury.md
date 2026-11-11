# Glow: warden-fury

Create and check out branch feat/glow-warden-fury before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/ (Swarm fills the fury fields in parallel; the BossView fields and 'sim:bossFury' are a fixed Morpheus stub), src/ui/, src/main.ts, src/core/, docs/ other than your hand off
Read first: src/game/bosses/view.ts (fury, furyT, dashAim, dashHeading), src/core/events.ts ('sim:bossFury'), src/render/bossShapes.ts, bossShell.ts, bossLook.ts, bossIdentity.ts, docs/pixi8-cheatsheet.md

## Goal
Ryan ruled 2026-11-11: when the Warden's Shield bar empties it becomes enraged: a 4.5 s invincible break where it shakes and changes, then an enraged form that clearly differs from the first. His pick: blue turns hot red, the shell grows corner spikes, a slow pulse blink while enraged. Plus a readable aim line for the new dash charge.

## Acceptance
- Break (fury 1, furyT 0 to 4.5): Warden shakes (position jitter of the drawn body only, about 4 u, from sin of furyT, never the PRNG), flashes between its blue and white faster and faster, and its colour crosses to hot red by the end; corner spikes grow out of the shell from 0 to full over the break. A short burst of sparks at the start is fine through the existing effects.
- Enraged (fury 2): hot red through the palette and applyNeon only, spikes at full length, a slow pulse (about 1 Hz, alpha 0.6 to 1). Clearly different from the blue Warden at a glance on the Fold 7 cover screen.
- Dash aim (dashAim >= 0): a thin red dashed line from the Warden along dashHeading to the arena edge, blinking, for the aim time; gone when dashAim is -1. Works on flat, drum and trough surfaces (use the existing projection).
- Fields absent or 0: draw exactly as today (every other guardian unchanged). No allocation per frame, Pixi v8 API only, no image files.
- Tests: pure helpers (shake offset, colour mix by furyT, spike length, pulse alpha, aim line end point). npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-warden-fury.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
