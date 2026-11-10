# Foundry: trough

Create and check out branch feat/foundry-trough before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/levelgen/ (surface choice, trough maps, Free Play trough level), tests/levelgen/, tests/qa/ pins that move because of this change
Do not touch: src/core/ (stub, read only), src/game/ (Forge), src/render/ (Glow), src/ui/ (Ledger), docs/ other than your hand off
Read first: src/core/trough.ts and src/core/surface.ts (stub), src/levelgen/generator.ts (surface choice, cylinder eligibility, drum maps), src/levelgen/cylinder.ts, src/levelgen/freeplay.ts, the newest generator version and config flags

## Goal
Tester 3 asked for a "half drum": a curved surface that does not connect like the cylinder, where gravity increases the steeper you go, as a later level arena so players learn normal physics first. Ryan ruled 2026-11-10: from level 24; gravity pulls the ship only (not enemies, not bullets); a valley across the width with steep left and right edges; gentle at the bottom and strong at the rim; also a Free Play option. Morpheus committed the contract stub before launch: SurfaceKind 'trough' and troughSurface in src/core/surface.ts (flat delta and wrap, no wrap at the seam), and src/core/trough.ts with the shared profile (height and slope as functions of u across the width, TROUGH constants), and FreePlayConfig.surface ('flat' | 'trough', default 'flat'). Use the stub; never redefine the profile.

## Acceptance
- A new generator version and config flag; every earlier version frozen, bit identical.
- From level 24, non boss levels may be troughs (choose a share, about 1 in 5 of eligible levels, never two in a row, never a boss level, never on the same level as a drum); levels below 24 never. State the trough levels for seeds 42 and 2471588027, levels 24 to 60.
- Trough maps suit the valley: wider open floor, few or no obstacles on the steep rims, spawns spread so enemies reach the floor; wells allowed at most one, placed off the rim. validateLevel accepts 'trough' and checks these rules.
- Free Play: FreePlayConfig.surface 'trough' builds a trough arena of the chosen size.
- Par stays the existing formula.
- Update moved pins with a one line reason each. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/foundry-trough.md under 15 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. Deterministic generator, no Math.random outside src/core/rng.ts. No em or en dashes.
