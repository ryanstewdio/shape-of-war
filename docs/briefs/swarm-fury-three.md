# Swarm: fury-three

Create and check out branch feat/swarm-fury-three before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/ (brood.ts, mirage.ts, gravitas.ts, table.ts rows for those three, view.ts readBoss only), tests/game/, tests/qa/ boss pins only
Do not touch: src/core/events.ts, the BossView field names and types (Morpheus stubs: fury, furyT, hitT, frenzy, tide, tideFlipIn), warden.ts, spindle.ts, ember.ts and their table rows (Ryan rated them, keep bit identical), bastion.ts, tempest.ts, twins.ts, prism.ts, src/render/, src/ui/, src/audio/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: src/game/bosses/fury.ts, ember.ts and spindle.ts (how a guardian opts into the shared fury), brood.ts, mirage.ts, gravitas.ts, table.ts, view.ts, core.ts, docs/handoffs/swarm-fury-two.md, src/core/events.ts ('sim:bossFury')

## Goal
Ryan approved the fury table on 2026-11-11. This wave: Brood, Mirage, Gravitas. One enraged move each. No repeat of Warden's dash, Spindle's needles or Ember's Leavers. Glow draws the looks in parallel from the view fields.

## Acceptance
1. Brood: the body gets no fury and no break (the split is its mid point). The Broodlings enrage when the first Broodling dies: emit 'sim:bossFury' stage 'on' once, readBoss writes frenzy true from then. Pincer: survivors move BROOD_FRENZY.speedMul faster (start 1.25) and every BROOD_FRENZY.everySec (4 s) they close on the ship from opposite sides: each picks a point on the far side of the ship from the other and drives through it. With one survivor it keeps the speed and simply hunts. Body and split numbers unchanged.
2. Mirage: opts into the shared fury (break at the stage 1 crack, then enraged). False landings: enraged, every warp shows MIRAGE_FURY.rings (3) landing ring markers, one real; the fakes are markers only, never lethal, and vanish MIRAGE_FURY.fakeFadeSec (0.2 s) before the landing. Fake points follow the same distance rule as the real one and are at least 120 u from it and from each other. The choice of which ring is real reads the clock and the warp counter hash, never the PRNG. Lanes, mirrors and the shield gate are unchanged.
3. Gravitas: opts into the shared fury. Tide: enraged, the pull flips to a push and back every GRAVITAS_FURY.flipSec (4 s) at the same strength; readBoss writes tide (1 pull, -1 push, 0 when not enraged) and tideFlipIn (seconds to the next flip, -1 when none) so Glow can flash a ring from GRAVITAS_FURY.telegraphSec (0.8 s) before each flip. The push never throws the ship into a lethal wall faster than the pull could (same speed cap). The tide carries on through the stage 2 split onto the pair. Anchors and rings unchanged.
4. All new numbers are named constants in table.ts so Ryan can tune them. A ship death keeps the fury stage, as for Warden.
- Tests for each item, the fairness sweep and every pin pass (update pins only where these changes explain them, named in the hand off). No Math.random, no allocation per frame, TypeScript strict, no any.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-fury-three.md under 12 lines with known gaps and requests. Commit and push the branch. Stop.

## Rules
Touch only. No em or en dashes. Nothing beyond this brief.
