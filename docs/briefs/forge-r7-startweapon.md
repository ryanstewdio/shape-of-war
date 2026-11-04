# Forge: r7-startweapon

Create and check out branch feat/forge-r7-startweapon before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: opus
Owned paths: src/game/ except src/game/bosses/, tests/game/ except tests/game/boss*, and for this bug only the orbit and bullet drawing in src/render/renderer.ts and src/render/spikeSaw.ts with their tests (Glow edits only src/render/leaverLook.ts in parallel)
Do not touch: src/levelgen/, src/audio/, src/ui/, src/main.ts, docs/ other than your hand off
Read first: the StartBonus weapon path (search startBonus in src/game), how a weapon pickup activates a weapon (weapons.ts), the orbit spike drawing in src/render/renderer.ts (search shieldOf, orbit spikes, spikeLen)

## Goal
Gate R6 (Ryan): "After reaching par I selected the Orbit weapon as my reward. In the next level any projectile shot from my ship was not displayed. The sound effect and kills occurred, just no visual of the bullets."

## Acceptance
- Reproduce on the real path: createGame with startBonus weapon orbit, step the real loop and run the real renderer bookkeeping for bullets (or the pure functions it uses) to show which bullets are live but get no draw (style, tint or mask missing because the bonus weapon skipped the event or state the renderer keys on, for example fx:pickup, the weapon hue, the orbit spike mask, or a bullet style index). Fix at the cause so every start weapon (spread, rapid, pierce, orbit) draws exactly like the same weapon picked up in play. Tests for all four start weapons: every live player bullet maps to a visible draw entry.
- npm test and npm run build pass on the branch (accepted perf exception aside). Hand off at docs/handoffs/forge-r7-startweapon.md under 30 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts. No em or en dashes.
