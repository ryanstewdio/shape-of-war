# Scribe: guide-update-1c52828

Create and check out branch feat/scribe-guide-1c52828 before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: opus
Owned paths: docs/player-guide/README.md, docs/player-guide/img/diagrams/
Do not touch: src/, tests/, scripts/, docs/player-guide/img/shapes/ (Shipwright refreshes them in parallel; keep every image file name the guide already uses), every other doc except your hand off
Read first: docs/player-guide/README.md, docs/01-game-design.md, docs/11-v2-spec-addendum.md, docs/DECISIONS.md rows since 2026-11-10, then the diffs below

## Goal
Update the player guide from 96dcc2a (version tester-1+96dcc2a) to main at 1c52828. Three gaps found on 2026-11-11 must be fixed: the Free Play Bosses row now reads "Every 2 min" (the guide says "Every 3 min", first at 1:40, then every 5 minutes); the Free Play setup has an "Arena surface: Flat / Trough" row the guide does not mention; Endless and Free Play guardians now open Brood then Warden.

## Sections likely affected (check each against the code)
1 The legend (scene data for guardians 35 to 50), 4 Core loop and scoring (HUD boss bar), 5 Levels and missions (start card, mission type, timed only clock, par per difficulty on guardian levels, generator version 14), 6 Difficulty (regular enemies after a guardian enters by difficulty), 7 Your ship (trough pull, float in shelter pools), 8 Weapons (Pierce 1.5x on guardians, Pierce through the Bulwark shield, 2 damage to Bulwarks), 10 Enemies (Bulwark), 11 Hazards, 12 Arenas and surfaces (troughs from level 24, guardian arenas version 13, Free Play trough), 13 Guardians (shield over health bar, crack, fury mid point and every guardian's fury, hit points, boss calm, arenas, hit feedback), 14 Endless and Free Play (guardian timing, caps and order, Bosses and Arena surface rows), 16 Settings reference (full reset; Free Play rows), 17 Music and sound (boss hit tick, old boss hit cue removed), 18 Install and device, 19 Glossary. Developer only items (dev unlock, fight timer, dev knobs) belong only in the For testers subsection, if anywhere.

## Commits since 96dcc2a (non merge, newest first)
42bb672 docs: status and decisions after fury fixes
43858e7 feat(swarm): fury fixes (Mirage gate and aimed lane, Brood pincer view, Gravitas shelter pools)
00bd906 feat(glow): fury fixes (Mirage arc from the sim, Brood pincer telegraph, Gravitas pools)
383cf7a ci: retrigger the gate (first run stuck in the GitHub Actions incident)
425d347 stub: fury fixes contract (pincer view fields, HazardType.Pool, GRAVITAS_POOL) and briefs
286d300 docs: fury three device check from Ryan
be84bb1 docs: status and decisions after fury three
0711411 feat(glow): fury three looks for Brood, Mirage and Gravitas
6685792 feat(swarm): fury three, Brood frenzy pincer, Mirage false landings, Gravitas tide
8afbccc stub: BossView fury three fields; briefs; status and rulings
7506c08 fix(glue): score race goal reads the per difficulty guardian goal
f52ae17 feat(foundry): guardian par per difficulty (generator version 14)
c1668b4 feat(chorus): remove old boss hit cue, keep music tick
8266895 feat(swarm): pierce deals extra damage to Bulwark
f1f72a7 docs: briefs for guardian par, pierce bulwark, tick only; rulings
966ee57 docs: status and decisions after the flame wave
578bc86 test(proctor): par audit of every Adventure level by difficulty
e4be08f feat(swarm): pierce passes bulwark shield, prove spindle fury arms
c514979 feat(glow): ember blue flame fury, thinner cracks, Spindle arm cap
ec406e3 docs: pierce arms, ember flame, par audit briefs; status rewrite
04a474f glue: fix B9 import placement
8d9f0ef glue: B9 rows on V12 arenas (pins predate V13 guardian arenas)
2fe3481 feat(foundry): boss arenas, version 13 guardian arenas
96823b9 fix(glow): crack glow uses damage colours only
dc98d6a feat(glow): stronger boss hit flash, bigger sparks, health crack glow
76dfa92 feat(swarm): boss calm, Brood numbers and per difficulty wave budget
69b50a9 docs: boss calm, boss arenas, hit feel briefs
fc11d3e docs: Furiosa issue 25 hand-off, unattended runs, runsheet R3
ff729d4 feat(swarm): shared guardian fury, Spindle needles, Ember Leavers, boss hit feedback
2302431 feat(chorus): boss hit tick
459f83b fix(ledger): refill boss bar at Brood split, 6 s fight toast
dd0ddbe feat(glow): guardian hit feedback and generic fury look
4a57fb9 stub: boss hit contract and fury two briefs
bed0236 feat(swarm): warden fury break, enraged dash charge, brood device retune
c33f269 feat(glow): warden fury break, enraged form and dash aim line
b3c8060 feat(ledger): one boss bar, dev fight timer, dev unlock, build:cap:dev
81c53c9 stub: warden fury contract and briefs
28abe3c test: unit tests for the story scene Web Audio backend
b070e30 docs: Furiosa second task and publishing rule
7c7d824 docs(furiosa): publish through the GitHub connector; drop the cache key step
95dede6 feat(ledger): boss bar shield and health strips
af1a248 feat(shipwright): exclude WebView offline cache from Android backup
9ace694 feat(swarm): boss health, shield and health bars, pierce 1.5x
7ca01c8 test: cover time warning and scroll tick audio backends
9b68e95 docs: Furiosa lane decisions, status
00cd6ee docs(runbooks): Furiosa runsheet; templates carry start sha and npm cache path
df10ff9 stub: boss bar contract; briefs for boss health, boss bar and backup rules
5c7ac94 test: unit tests for the button stack helpers
3ea11bf docs(agents): npm cache in /tmp for the Codex sandbox
3a85127 fix(native): ship no service worker in the native build and drop an old one
2fee77c docs(forge): trough-tune hand-off branch name
58bd1bc feat(glow): trough depth scale and rim light
372737f feat(forge): trough tune, pull 1.5x
ced3860 docs(agents): cut Furiosa branches from the checkout commit, no fetch
def7a0c docs: trough tune briefs, device check
6ce3f10 docs: ruleset and gate rulings
41b4b3b docs: native service worker brief
2795f47 ci: skip tests and build for docs-only pull requests
fa4099b briefs: shipwright ci docs fast
c157d67 docs(scribe): Furiosa Codex lane rules and templates
4ead204 docs: domain move closed (D5); trough timeout fix deployed green
2926c85 briefs: scribe furiosa lane files
7a532aa glue: 120 s timeout on trough generator sweeps (CI runner timed out); status
2f576e9 feat(ledger): polish-d how to fixes, dev gates, release footer
e9c9e6c docs(forge): fp-guardians hand-off
14260c2 feat(forge): free play guardians every 2 min, one at a time
c03f9e5 feat(foundry): Endless and Free Play guardians open Brood then Warden
04d2836 feat(ledger): guardians 35 to 50 as corrupted servants in scene data
39a20f3 docs: guardians 35 to 50 as servants of Vecta; briefs for scene data and Free Play guardian timing
4407dc2 feat(ledger): trough option
6792fa3 docs: guide rewrite rulings, briefs for polish-d and guardian order
358ab64 glue: feel test treats trough levels as flat; trough option brief; status
6f00131 docs(glow): trough hand-off
f41b613 feat(glow): trough valley projection
000a3c8 feat(foundry): trough levels from 24, trough maps and Free Play trough (generator version 12)
ec1ffeb docs(ledger): start card hand-off
14ef3e4 feat(ledger): focused stack start card, Return to Menu, mission type, timed only clock, full reset
7c0ccfa scribe: guide rewrite 96dcc2a
06deab5 feat(forge): trough pull on the ship
730edb5 feat(shipwright): guide images for bosses, Leaver and drone pickup
09b46f9 briefs: player guide rewrite and images at 96dcc2a

## Diff stat 96dcc2a to 1c52828 (src and design docs)
 src/audio/bossTick.ts           |  54 ++++
 src/audio/bossTickSynth.ts      |  37 +++
 src/audio/cues.ts               |  15 +-
 src/audio/synth.ts              |  11 +-
 src/core/events.ts              |  14 +
 src/core/settings.ts            |  12 +-
 src/core/stars.ts               |  28 +-
 src/game/bosses/bar.ts          |  50 +++
 src/game/bosses/bastion.ts      |   4 +-
 src/game/bosses/brood.ts        | 263 ++++++++++++++-
 src/game/bosses/core.ts         |  93 +++++-
 src/game/bosses/ember.ts        | 121 ++++++-
 src/game/bosses/fury.ts         | 112 +++++++
 src/game/bosses/gravitas.ts     | 197 +++++++++++-
 src/game/bosses/mirage.ts       | 195 +++++++++--
 src/game/bosses/rotation.ts     |   4 +-
 src/game/bosses/spindle.ts      | 150 ++++++++-
 src/game/bosses/state.ts        |  31 ++
 src/game/bosses/table.ts        | 219 +++++++++++--
 src/game/bosses/twins.ts        |  18 +-
 src/game/bosses/types.ts        |  11 +
 src/game/bosses/view.ts         |  84 ++++-
 src/game/bosses/warden.ts       | 213 ++++++++++--
 src/game/combat.ts              |   9 +-
 src/game/difficulty.ts          |   7 +-
 src/game/endless.ts             |   5 +-
 src/game/enemies/bulwark.ts     |   4 +-
 src/game/fpGuardians.ts         |  76 +++++
 src/game/game.ts                |   9 +-
 src/game/ship.ts                |   9 +-
 src/game/trough.ts              |  61 ++++
 src/game/world.ts               |   2 +
 src/levelgen/boss.ts            |  27 +-
 src/levelgen/bossArena.ts       |  30 ++
 src/levelgen/freeplay.ts        |  48 ++-
 src/levelgen/generator.ts       | 117 +++++--
 src/levelgen/guardianPar.ts     | 163 ++++++++++
 src/levelgen/leveldef.ts        | 100 +++++-
 src/levelgen/pacing.ts          |   8 +
 src/levelgen/trough.ts          | 119 +++++++
 src/levelgen/validate.ts        | 235 +++++++++++++-
 src/main.ts                     |  87 +++--
 src/native/dropServiceWorker.ts |  39 +++
 src/render/bossHitFury.ts       | 189 +++++++++++
 src/render/bossShapes.ts        |   4 +-
 src/render/bossTier2.ts         |  10 +-
 src/render/drum.ts              |  79 ++++-
 src/render/drumPen.ts           |   7 +-
 src/render/emberFury.ts         | 106 ++++++
 src/render/furyFixes.ts         | 164 ++++++++++
 src/render/furyThree.ts         | 268 +++++++++++++++
 src/render/grid.ts              |  47 +++
 src/render/hazardFx.ts          |  69 +++-
 src/render/latticeView.ts       |  38 ++-
 src/render/particlePool.ts      |   4 +-
 src/render/particles.ts         |  62 ++++
 src/render/renderer.ts          | 698 ++++++++++++++++++++++++++++++++++++++--
 src/render/troughDepth.ts       |  92 ++++++
 src/render/troughGeom.ts        | 215 +++++++++++++
 src/render/wardenFury.ts        | 211 ++++++++++++
 src/story/scenes.ts             |  14 +-
 src/ui/boss.ts                  |  11 +
 src/ui/devGate.ts               |  18 +-
 src/ui/devUnlock.ts             |  12 +
 src/ui/fightTimer.ts            |  56 ++++
 src/ui/flow.ts                  |   2 +
 src/ui/freePlay.ts              |  33 +-
 src/ui/howTo.ts                 |   4 +-
 src/ui/hud.ts                   |  85 ++++-
 src/ui/intro.ts                 | 304 +++++++++++++----
 src/ui/menu.ts                  |  13 +-
 src/ui/objective.ts             |  32 +-
 src/ui/results.ts               |   8 +-
 src/ui/settings.ts              |  31 +-
 src/ui/vectorFont.ts            |   1 +
 src/vite-env.d.ts               |   6 +
 76 files changed, 5566 insertions(+), 418 deletions(-)


## Acceptance
- Read the actual diffs (git diff 96dcc2a 1c52828 -- <paths>) and the current code; code wins over docs. List every Canon conflict with file and line in the hand off.
- Update only the affected sections, plus: the header line to `Describes main at 1c528280eeb531681d8e54bce0c814031a72a6ec (version tester-1+1c52828), written <ISO date>.`; the "Changed in this version" section rewritten for this update; a new top row in the Changelog table.
- Tag every changed entry with "(changed in tester-1+1c52828)" and every new one with "(new in tester-1+1c52828)"; remove such tags older than two guide versions.
- New enemy or item: full template entry with image img/shapes/<kind>.svg. Removed item: delete the entry and say so in the changelog.
- Never invent a number; write "unknown" and list it. Do not reword sentences that need no change (the website converts this guide sentence by sentence).
- No em or en dashes, sentence case headings, player facing language. Dash check prints nothing: perl -CSD -ne 'print "$ARGV:$.: $_" if /[\x{2013}\x{2014}]/' docs/player-guide/README.md
- Commit "scribe: guide update 1c52828". Hand off at docs/handoffs/scribe-guide-update-1c52828.md under 15 lines: sections changed, Canon conflicts, unknowns. Push the branch. Stop.

## Rules
No em or en dashes in any file you write. Nothing beyond this brief.
