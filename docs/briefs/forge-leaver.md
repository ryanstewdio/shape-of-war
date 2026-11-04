# Forge: leaver

Create and check out branch feat/forge-leaver before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: this is a cross cutting enemy, so you own every file the new kind touches: src/levelgen/ (EnemyKind, tables, rosters), src/game/ (Kind, the Leaver and shard steps, scoring, Free Play wells arrivals, drum boss hazard deltas in src/game/bosses/kit.ts and core.ts), src/render/ (shape spec and look), src/audio/ (kill note and layer entries), src/ui/enemyIntro.ts (intro entry), and their tests. Nothing else runs in parallel, so no one else edits these files during your session.
Do not touch: docs/ other than your hand off, src/core/difficulty.ts, src/core/freeplayConfig.ts (read only)
Read first: the Weaver end to end as the template (src/game/enemies/weaver.ts, its shape spec, its kill note and layer entries, its roster weights in src/levelgen), then src/game/wellArrival.ts and src/game/bosses/kit.ts (hazardHits)

## Goal
Ryan's new enemy, the Leaver: "very similar to Weaver, but when killed it breaks into several smaller pieces with single colour fills that shimmer, which delay for 0.5 s, then pursue 6 percent faster than Weaver." His inspiration image: a yellow square, a green square frame rotated about 40 degrees over it, and a red square inside the frame. Original design, not a copy of any game asset.

## Acceptance
- Types and tables: EnemyKind 'leaver' and Kind.Leaver, Kind.LeaverShard, with an entry in every exhaustive table (TypeScript tells you where: about 19). Roster: Adventure from level 21 (band 3 and up) at a weight like Weaver's, Endless after 3 minutes, Free Play enemy toggles (the setup grid picks it up from the roster list; check), the intro card lists it as "Leaver, splitter".
- Sim: the Leaver moves exactly like the Weaver (reuse its step) with 2 hit points. On death it releases 6 shards (two yellow, two green, two red) flung outward 40 u at random hashed angles (no PRNG), which hold still for 0.5 s and then chase the ship (or the decoy) at 1.06x Weaver speed, 1 hit point each, seam aware on drums, enrage through membranes like other enemies, never more than the live cap allows (drop shards that do not fit). Score: Leaver as Weaver, each shard a quarter of that. Tests: split count and colours, the 0.5 s hold, speed ratio, cap respect, determinism.
- Look: the Leaver is drawn as three layers of neon outline: a yellow square at the back, a green square frame rotated 40 degrees on top, a red square inside the frame; it slowly counter rotates the frame against the squares. Shards are small solid single colour squares with a shimmer (brightness flicker and a hue shimmer within their own colour, through the palette and applyNeon). Works on flat, tilt and drum paths.
- Sound: a distinct kill note (a bright three note break) and a layer entry.
- Also fix two Forge requests from foundry-r5-fp: Free Play wells arrive over time (stepWellArrivals and arrivalsHeld return early in endless mode; allow them when the run is Free Play, using FREE_PLAY_ARRIVAL_GAP_SCALE from src/levelgen/freeplay.ts) with a test; drum boss hazards hit across the seam (route kit.ts hazardHits and the core.ts hazard tests through w.surface.delta) with a test.
- tests/qa snapshots: flat levels that gain no Leaver keep their hashes; list any pin that moves and why. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/forge-leaver.md under 45 lines with a device check in words (a seed and level with Leavers under level 30). Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes.
