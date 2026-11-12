# Glow: fury-fixes

Create and check out branch feat/glow-fury-fixes before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/render/, tests/render/
Do not touch: src/game/, src/core/, src/ui/, src/audio/, src/main.ts, docs/ other than your hand off
Read first: docs/handoffs/glow-fury-three.md, src/render/furyThree.ts, hazardFx.ts, bossTier2.ts, bossTier2Fx.ts, bossShapes.ts (mirageShield, mirageLips), src/game/bosses/view.ts (the pincer fields), src/game/bosses/types.ts (HazardType.Pool), src/game/bosses/table.ts (MIRAGE, BROOD_FRENZY, GRAVITAS_POOL), docs/pixi8-cheatsheet.md

## Goal
Ryan's rulings on 2026-11-12 after his fury three device check: Mirage's shield opening grows to half the ring, the Brood pincer needs a telegraph you cannot miss, and Gravitas leaves shelter pools. Swarm builds the sim in parallel and writes the view fields; build against the stub fields and treat an absent field as off. Warden, Spindle and Ember looks stay exactly as they are.

## Acceptance
1. Mirage: the drawn shield opening follows the sim's MIRAGE.arcDeg from table.ts (it becomes 180 deg, half the ring, when Swarm merges; it reads 70 on main today), not a copy of the number. The lips sit at the opening's edges; the window glow and the open and shut animation keep working.
2. Brood pincer: while view.pincerAim is 0 or more, both pincer Broodlings (pincerA, pincerB) flash white at about 6 Hz and a thin hot green aim line runs from each to its drive point (pincerAx, pincerAy and pincerBx, pincerBy), brightening as the aim runs out. While view.pincerDrive is true, a short streak trails each driving Broodling. The frenzy look is otherwise unchanged.
3. Gravitas pools: Kind.BossHazard with w.a 5 (HazardType.Pool): a violet dashed ring at w.radius with a faint fill and specks rising slowly inside; the lattice stays flat inside if that is cheap. It dims as it shrinks over its last GRAVITAS_POOL.fadeSec (age w.t of its life w.vx). Never drawn as a lethal hazard (no telegraph form, no lethal flash). Four at once stay cheap.
4. The Low quality setting keeps each look readable at lower cost (fewer specks, no streak).
- Colours through the palette and applyNeon only, Pixi v8 only, no PRNG, no image files, no allocation per frame. Tests for the pure helpers. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/glow-fury-fixes.md under 8 lines with what to verify on a device. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Touch only. No em or en dashes. Nothing beyond this brief.
