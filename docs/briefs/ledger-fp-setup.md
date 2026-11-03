# Ledger: fp-setup

Create and check out branch feat/ledger-fp-setup before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/ui/, src/main.ts, src/core/settings.ts, tests/ui/, tests/settings/, tests/qa/storageKeys*.test.ts, the docs/13 key table
Do not touch: src/game/, src/levelgen/ (call freePlayLevel only), src/render/ (read only), src/audio/, src/core/freeplayConfig.ts (read only), src/core/events.ts, docs/ other than the key table and your hand off
Read first: src/core/freeplayConfig.ts (FreePlayConfig, DEFAULT_FREE_PLAY), src/levelgen/freeplay.ts, the Free Play options screen in src/ui/, src/main.ts by search (startLevel freeplay branch, gameOptions)

## Goal
Ryan's Free Play options (docs/14): enemies and density, lives and run length, loadout, bosses and hazards, arena size, on top of difficulty, arena type and barriers. Foundry builds the level side and Forge the rules side in parallel; you build the setup screen and pass the config.

## Acceptance
- Setup screen sections with clear labels and padding: Difficulty, Arena (type, size, barriers), Enemies (a toggle grid of every enemy kind with its neon icon and name, plus density Low, Normal, Swarm, plus All and None shortcuts; None counts as all), Rules (lives 1, 3, 5, infinite; length Endless, 3, 5, 10 min), Loadout (starting weapon none or one of four, pickups on or off, drone Attack, Collect, Ram, super Homing, Detonate, Turbo), Hazards (bosses Off, Every 3 min, or one chosen boss; wells Off, Normal, Many; drum drift Off, Low, High, shown only for the drum). Scrolls on the cover screen; Start button always visible.
- The last config persists under one new key sow.settings.freePlay (JSON, validated on load, defaults from DEFAULT_FREE_PLAY), registered in the storage audits and the docs/13 table.
- Start passes the config: freePlayLevel({ arena, barriers, seed, config }) and GameOptions.freePlay = config (Forge adds the field in parallel; pass it through a typed options object if not on main yet). Results for a timed run show "Score attack 5:00" and the score; infinite lives show an infinity sign in the HUD.
- Tests: config round trip and validation, every control writes the right field, Start passes the config. npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/ledger-fp-setup.md under 40 lines with a device check in words. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No Math.random outside src/core/rng.ts. Touch only. applyNeon(n) only. No assets beyond PWA icons. No em or en dashes.
