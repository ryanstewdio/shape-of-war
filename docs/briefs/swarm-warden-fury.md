# Swarm: warden-fury

Create and check out branch feat/swarm-warden-fury before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/ (not bar.ts signature), tests/game/, tests/qa/ boss pins only
Do not touch: src/core/events.ts and the BossView fields fury, furyT, dashAim, dashHeading (Morpheus stub, fixed), src/render/, src/ui/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: src/core/events.ts ('sim:bossFury'), src/game/bosses/view.ts (fury fields), src/game/bosses/warden.ts, table.ts (WARDEN, WARDEN_SHIELD, CRACK_AT, BROOD, BROODLING), core.ts (phaseFor, clampDamage hook, bossEnraged), brood.ts, docs/handoffs/swarm-boss-health.md

## Goal
Ryan's device check on 1d724e3 (2026-11-11): Warden died in 37 s with a powered up Pierce and had no mid point; Brood took 150 to 170 s, about half body and half Broodlings. Ryan ruled a Warden fury and the look and ability below.

## Part A: Warden fury (every mode Warden appears in)
- Break: the moment the Shield bar empties (hp reaches CRACK_AT[0] of maxHp, the stage 1 crack), Warden stops, clears its own live rings and Hornets, closes its core and takes no damage for FURY_BREAK_SEC = 4.5 (clampDamage returns 0). Emit 'sim:bossFury' stage 'break' once (sec 4.5, Warden x y). Hits during the break never move the bar.
- Phase 2 starts at the break instead of at 50 percent (Warden only; phaseOf hook), so 'sim:bossPhase' fires with the break.
- Enraged, from the break's end to death: emit 'sim:bossFury' stage 'on' once. Seek 55 to 80 u/s, turn 60 to 90 deg/s, rings every 2.8 to 2.4 s, shields keep their cycle. Constants in table.ts (WARDEN_FURY), one place.
- Dash charge (enraged only): first one 3 s after the break ends, then every 8 s. Warden stops and aims for 0.8 s (dashAim counts down, dashHeading locked at the start toward the ship), then dashes at 300 u/s along that heading for up to 1.0 s, stopping early at the wall. Where it stops it fires one ring of 12 enemy bullets, then its core opens for 2.0 s (the reward window). Contact during the dash kills like body contact. Never starts while a shield is up or the ship is respawning; the fairness sweep must still pass.
- readBoss writes fury (0, 1, 2), furyT, dashAim (-1 when not aiming) and dashHeading every frame. Fury state resets with the boss (ship death restart keeps the fury stage reached; armState clears it).
- The old 240 s enrage (bossEnraged) is unchanged and stacks as before.

## Part B: Brood first cut retune from Ryan's real fight
Target about 60 s at Normal level 5: body about 35 s, Broodlings about 25 s. Scale the Brood body row by 0.44 (459 to about 200) and BROODLING.hp by 0.31 (600 to about 190, so 19 hits each). Update the fight bot test bands to match; write in table.ts that these come from Ryan's device time, not the bot.

## Acceptance
- Tests: break at the crack, 4.5 s with zero damage, events fire once each in order, phase 2 at the break, enraged speeds, dash aim then dash then ring then open window, dash stops at the wall, no dash during shield or respawn, view fields, Brood and Broodling hit points. Fairness sweep and every boss pin pass (update pins only where the Warden or Brood change explains them, and say which in the hand off).
- No Math.random (use the boss hash or clocks), no allocation per frame, TypeScript strict, no any.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-warden-fury.md under 12 lines with the bot times before and after for Warden and Brood. Commit and push the branch. Stop.

## Rules
Touch only. No em or en dashes. Nothing beyond this brief.
