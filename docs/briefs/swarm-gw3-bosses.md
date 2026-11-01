# Swarm: gw3-bosses

Create and check out branch feat/swarm-gw3-bosses before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works.

Model: opus
Owned paths: src/game/bosses/, tests/game/boss*
Do not touch: src/game/ outside src/game/bosses/, src/core/, src/render/, src/audio/, src/ui/, docs/ other than your hand off
Read first: src/game/bosses/bastion.ts, src/game/bosses/tempest.ts, src/game/bosses/table.ts (BASTION, TEMPEST, TEMPESTLING), src/game/bosses/core.ts (bar and phases)

## Goal
Device gate GW3 (build 675f6c3, Ryan). Warden passed at fairness 4 (leave it). Bastion: phase 3 is now more threatening, but "the turrets are too easy to kill, which makes Bastion lose down to 50 percent easily". Tempest: fairness 5, too easy; "after splitting the smaller Tempests are non threatening. They aim a path like they are going to move fast in a direction but abandon it and keep floating near the edge like a cloud. Smaller Tempests should be more aggressive and faster than the big Tempest."

## Acceptance
- Bastion: turret HP 80 to 180; a turret can only be damaged while the core is not in its own sweep or charge (keep it simple: turrets are shielded for 1.5 s after each turret death, sim:bossShield is not needed for turrets); turret kills alone can take the boss bar down by at most 20 percent (phases may still follow the turrets, but the bar must reflect remaining real effort); target fairness 4.
- Tempest: big Tempest HP plus 15 percent. Tempestlings: move 1.4x the big Tempest's speed; every telegraphed dash marker is followed by a real committed dash along it (about 420 u/s, never abandoned); between dashes they chase the ship at about 150 u/s and keep at least 150 u from the arena walls (no edge drifting); storm attack at full rate (not 70 percent); they flank: the two pick dash lines from opposite sides of the ship. Target fairness 4.
- Determinism tests (two runs hash equal), tests for turret HP and bar cap, Tempestling dash commitment (each marker followed by a dash of at least 200 u), wall distance, speed ratio. Update bossFightLength bands if needed and say so. npm test and npm run build pass on the branch (accepted perf exception aside)

## Rules
TypeScript strict, no any. PixiJS v8 only. No Math.random outside src/core/rng.ts; simulation and render never call the PRNG (use the existing hash helpers). Touch only, no keyboard, mouse or gamepad handlers. applyNeon(n) is the only neon entry point. No new runtime dependency. No audio, image or font assets beyond PWA icons. Vitest for every pure module. No em or en dashes in any file you write. tests/qa level snapshots must stay unchanged. Keep the Standard tier fps budget (lowest 58 to 59 in a boss fight on the device): no per frame allocation. Contract events in src/core/events.ts already exist on main (sim:wellArrive, sim:saw, sim:bossShield); do not rename or change them.

## Working rules
Read only the files you need, one at a time; never read docs/12-v3-plan.md or docs/13-v3-spec-addendum.md in full (this brief carries what you need). While working run `npx vitest run <your test dir> --reporter=dot 2>&1 | tail -20`; run the full `npm test 2>&1 | tail -15` and `npm run build > /tmp/b.log 2>&1; echo BUILD_EXIT=$?; tail -5 /tmp/b.log` once before the commit. The generator perf test "200 levels under 350 ms" and slow levelgen timeouts may fail in this VM; note them and move on. No exploratory refactors.

## Hand off
Write docs/handoffs/swarm-gw3-bosses.md (under 45 lines): what changed, files touched, tests added, test and build summary, risks, contracts for other roles, an exact device check for Ryan written in words, and the session URL (echo https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}). If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git. Commit and push the branch. Stop.
