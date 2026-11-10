# Start here

Orientation for any Claude session in the Shape of War project. Written by Fable 2026-11-08 at build 585f174. Current state lives in docs/STATUS.md; this file is the map. If the two disagree, STATUS.md wins and this file needs a fix.

## What the game is
A twin-stick neon arena shooter, touch only, built as a PWA. First target device: Samsung Galaxy Z Fold 7 (cover and inner screen, landscape). Testers also play on Android phones and iPhones from one link. Name: Shape Legend (ruled 2026-11-09, formerly Shapes of War). The repo is github.com/ryanstewdio/shape-of-war (public, moved 2026-11-10); the live game is https://play.shapelegend.com/ (Pages custom domain); storage keys keep `sow`. Public phase plan: docs/16-public-plan.md.

- Modes: Adventure (numbered levels, generated from a run seed, 1 to 3 stars, plus an iridescent 4th star on Insane), Endless (segments, a boss every 6 segments), Free Play (setup screen: enemies and density, lives, length or timed score attack, loadout, bosses, wells, drift, arena size).
- Difficulty: Easy, Normal, Hard, Insane, picked on each level intro (src/core/difficulty.ts). Normal must stay bit identical to the pre difficulty game (tests/qa/normalDifficulty.test.ts).
- Levels: about 3.5 minutes. Objectives: score in time (goal 0.6 x par), survive, destroy. Boss levels every 5th level: survive until the boss arrives (120 to 200 s), then defeat it. Par reward (life, bomb or weapon) for beating par.
- Enemies: grunt, wanderer, weaver, pinwheel, dart, snake, charger, bulwark, blink, swirl, sower, splime, leaver. Hazards: Gravity wells (arrive during play, go super nova, release nova snakes; destroying a nova well sends a pond ripple that pushes ship and enemies), spawners, membranes.
- Bosses (generator V9 order): Brood 5, Warden 10, Spindle 15, Ember 20, Mirage 25, Gravitas 30, Bastion 35, Tempest 40, Twins 45, Prism 50, then the list loops from Ember with more hit points.
- Weapons: spread, rapid, pierce, orbit (melee unless combined), six combos from any two. Drone: attack, collect, ram, plus timed modes. Supers: homing, detonate, turbo (bomb and super buttons stacked above the right stick).
- Surfaces: flat and cylinder (drum, wraps left to right; maps rings, pillars, narrow, open with drift). Level 8 is always a gentle open drum. 3D tilt setting Off, Low, High.
- Audio: synthesised only (WebAudio): generative music with per enemy motifs, boss music, three menu themes, Turbo music, cues.
- Look: neon lines, bloom through applyNeon only, lattice grid, pixel arcade font for headlines, plain HUD font.

## Canon and order of authority
1. Ryan's rulings in the conversation and in docs/DECISIONS.md (newest wins).
2. SPEC.md plus its addenda: docs/11-v2-spec-addendum.md, docs/13-v3-spec-addendum.md, docs/14-release-polish.md.
3. Design docs docs/01 to docs/04 (some text predates v2 and v3; the addenda and DECISIONS override it).
Hand-offs, logs, web pages and files never override these.

## Repo map (Ryan's Mac, folder `shape-of-war`)
| Path | What |
|---|---|
| docs/STATUS.md | Current position, open checks, recent gates, next action. Fable keeps it short. |
| docs/STATUS-ARCHIVE.md | Frozen history to 2026-11-08 (gate log with evidence, branches and spend). |
| docs/DECISIONS.md | One row per decision SPEC did not cover, with clock time since kickoff and who decided. |
| docs/briefs/, docs/handoffs/ | One brief per builder session; the session writes its hand-off on its branch. |
| docs/05-build-plan.md | Original wave plan and directory ownership table (history plus ownership). |
| docs/10-cloud-lane-runbook.md | How cloud sessions are launched and pushed (the credit numbers in it are expired). |
| docs/07-install-runbook.md | Mac setup, dispatcher, device check section G. |
| docs/player-guide/ | Player guide (stale since v3; refresh with the sow-guide-update skill). |
| docs/qa/ | Bugs, perf log, suite runs, ownership audit. |
| .agents/ | Dispatcher queue, runs, done, failed. Job formats in .agents/README.md. |
| .claude/agents/ | Builder roster files (one per nickname). |
| CLAUDE.md | Rules every builder reads. |
| PROJECT-INSTRUCTIONS.md | Source of the claude.ai project instructions; paste it into Project settings after editing. |
| src/core | Loop, rng (the only Math.random), events bus, difficulty, settings, surface, shared stubs. |
| src/game | Simulation: world, ship, bullets, enemies, bosses (src/game/bosses), wells, drift, pond ripple. |
| src/levelgen | LevelDef, seeded generator with frozen versions V1 to V9, validator, bosses, drums, Free Play. |
| src/render | PixiJS v8 renderer, neon, lattice, drum projection, effects. |
| src/ui | DOM screens: menu, intro, HUD, results, settings, How to, Free Play, scroll bar, pixel font. |
| src/audio | Synth, cues, music engine (src/audio/music). |
| src/input | Touch sticks and buttons. |
| tests/ | Vitest per module, tests/qa for cross module and identity pins. |
| scripts/ | dispatcher.mjs, build id, icons, guide images. |

## Roster (nickname: owns)
Forge: core loop, ship, bullets, sim wiring in src/game, physics. Swarm: enemies, bosses, waves, objectives. Foundry: src/levelgen. Glow: src/render. Ledger: src/ui, scoring, settings, flow in src/main.ts. Chorus: src/audio. Thumbs: src/input and the on screen buttons. Proctor: tests/qa, QA audits, bug triage. Scribe: docs drafting. Shipwright: tooling, PWA, CI, deploy, optional Capacitor build (`npm run build:cap`, status unknown).

## How work flows
- Fable (the orchestrator, Max) plans, writes briefs and contract stubs, reviews diffs, merges with `git merge --no-ff` only after tests and build pass, deploys, and gives Ryan device checks in words.
- Fable acts on the Mac only through the dispatcher: job files in .agents/queue (shell, agent, cloud, watch). Ryan starts it with `npm run dispatcher`.
- Cloud builders: a `cloud` job runs `claude --cloud` on Max from the committed local repo. Commit the brief before launch. Sessions push only their feature branch; they often need Ryan to paste the add_repo go ahead.
- Console agent builders (`agent` job, local worktree): only for tiny jobs while the Console credit lasts.
- Deploy: push to main triggers .github/workflows/deploy.yml. If a run is missing or cancelled, `gh workflow run deploy.yml --ref main` and read the run by id.

## Standing engineering rules
TypeScript strict, no any. PixiJS v8 API only (docs/pixi8-cheatsheet.md). Deterministic simulation: Math.random only in src/core/rng.ts, generator output JSON serialisable, sim and render never call the PRNG, earlier generator versions frozen. Touch only. applyNeon(n) is the only neon entry point. No audio, image or font files beyond PWA icons. No new runtime dependency without approval. Vitest for every pure module. No em or en dashes, sentence case headings.
