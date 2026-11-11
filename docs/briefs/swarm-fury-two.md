# Swarm: fury-two

Create and check out branch feat/swarm-fury-two before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: src/game/bosses/, src/game/enemies/ (spawning only, no behaviour change to regular enemies), tests/game/, tests/qa/ boss pins only
Do not touch: src/core/events.ts and the BossView fields fury, furyT, dashAim, dashHeading, hitT (Morpheus stubs, fixed), src/game/membrane.ts (read only), src/render/, src/ui/, src/audio/, src/main.ts, src/levelgen/, docs/ other than your hand off
Read first: docs/handoffs/swarm-warden-fury.md, src/game/bosses/warden.ts (fury), spindle.ts, ember.ts, brood.ts, core.ts, table.ts, view.ts, src/core/events.ts ('sim:bossFury', 'sim:bossHit'), src/game/enemies/leaver.ts, src/game/membrane.ts (w.enraged, enrageSpeed)

## Goal
Ryan's device check on 1580146 (2026-11-11): Warden fury is fun, keep it exactly as is. Brood is now too easy (Broodlings die too fast). Spindle is boring and not threatening; Ember is somewhat boring and must send out enraged Leavers. Ryan ruled: every guardian gets a fury mid point in waves, Spindle and Ember in this one, and hit feedback on every guardian.

## Acceptance
1. Shared fury: move the break mechanics (break at the stage 1 crack, FURY_BREAK_SEC with zero damage, 'sim:bossFury' break then on, phase 2 at the break, view fields) into one shared helper any guardian can opt into. Warden's behaviour and every Warden test stay bit identical. readBoss writes fury and furyT for any guardian using it (dashAim and dashHeading stay Warden only).
2. Spindle: needle arms all fight: each arm tip sheds one needle (enemy bullet, flung along the sweep tangent) every 1.2 s, never spawning within 150 u of the ship. Fury: break, then enraged: a 4th arm, arm turn 0.4 to 0.6 rad/s, reversals every 3 s (telegraph never shortened), needles every 0.9 s. Constants in table.ts (SPINDLE_FURY, SPINDLE_NEEDLES).
3. Ember: every stun releases 2 enraged Leavers at its body (w.enraged set as a membrane crossing would, cap 4 Ember Leavers alive, within maxLiveEnemies). Fury: break, then enraged: dash speed x1.2, up to 3 wall bounces, and 3 Leavers per stun. Constants in table.ts (EMBER_FURY, EMBER_LEAVERS).
4. Brood: BROODLING.hp 190 to 300 (30 hits each); body unchanged. Confirm with a test that at the split the bar's barHp equals barMax (the Broodlings start full); Ledger fixes the HUD side.
5. Hit feedback: emit 'sim:bossHit' (reused payload) on every player hit on a guardian body, core or part, landed true when it took hit points, false when absorbed (closed core, shield, pods, fury break). readBoss writes hitT (seconds since the last landed hit, -1 before any).
- Tests for each item, the fairness sweep and every pin pass (update pins only where these changes explain them, named in the hand off). No Math.random, no allocation per frame, TypeScript strict, no any.
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/swarm-fury-two.md under 12 lines. Commit and push the branch. Stop.

## Rules
Touch only. No em or en dashes. Nothing beyond this brief.
