# Swarm: r6-drumboss

Create and check out branch feat/swarm-r6-drumboss before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*, src/levelgen/freeplay.ts (the boss choice rule only, coordinate by keeping your change to that function)
Do not touch: other src/game files, src/render/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: src/game/bosses/kit.ts (hazardHitsOn), src/game/bosses/core.ts, src/levelgen/freeplay.ts (how a chosen boss becomes Warden on drums), tests/game/leaverRequests.test.ts (the seam hazard tests)

## Goal
Leaver check (build e8d2da5, Ryan): on a Free Play drum with bosses on, boss attacks do not hit across the seam on device, although the tests pass. Free Play: "I selected Gravitas and Warden appeared" (on drums a chosen boss outside Warden and Brood fights as Warden by design; Ryan expects his choice).

## Acceptance
- Seam hits on device: find the gap between the passing tests and real play (body contact, enemy bullets from bosses, rings, sweeps, tethers, pull fields, adds: check every damage path a boss uses, not only hazardHitsOn) and make every one seam aware through w.surface.delta. Test each path on a real drum fight with the ship across the seam.
- Chosen boss on drums: every boss can fight on a drum now that its paths are seam aware; make each boss's movement and attacks wrap correctly (steer helpers, ring centres, sweep arcs) and let freePlayLevel honour the chosen boss on drums too (every3 still rotates the full ladder). If a boss truly cannot work on a drum, keep Warden for it and say which and why in the hand off and on the setup screen note (Ledger reads a list you export: DRUM_SAFE_BOSSES).
- Determinism, flat bit identical. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/swarm-r6-drumboss.md under 35 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. No em or en dashes.
