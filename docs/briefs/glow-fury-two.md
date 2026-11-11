# Glow: fury-two

Create and check out branch feat/glow-fury-two before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-warden-fury.md, src/render/wardenFury.ts, src/game/bosses/view.ts (fury, furyT, hitT), src/core/events.ts ('sim:bossHit', 'sim:bossFury'), src/render/bossShapes.ts, bossDamage.ts, docs/pixi8-cheatsheet.md

## Goal
Ryan 2026-11-11: he cannot tell when he is hurting a guardian without staring at its bar, and every guardian gets a fury mid point (Spindle and Ember now; Swarm fills fury for them in parallel). Warden's fury look is rated 4: keep it exactly.

## Acceptance
1. Hit feedback on every guardian: on a landed hit the body flashes white briefly (hitT under about 0.08 s), and 'sim:bossHit' landed true throws a few sparks at (x, y) through the existing particle pool; landed false throws one small grey spark and no flash, so a blocked shot reads differently. Readable under heavy fire without washing the body out (cap the flash rate). No allocation per frame.
2. Generic fury look for any guardian with fury: the break shakes, flashes faster and crosses to hot red as Warden does (reuse wardenFury.ts helpers); enraged: hot red with the slow pulse. Spindle enraged: arms hot red with the pulse. Ember enraged: hot red body with a short spark trail on its dashes. Warden keeps its spikes and look unchanged. Needles are ordinary enemy bullets (no new art needed).
- Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no image files. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-fury-two.md under 8 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
