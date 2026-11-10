Kickoff: 2026-10-27T08:49:39Z
History before 2026-11-08 (gate log, merged branches with spend, old bugs): docs/STATUS-ARCHIVE.md, frozen.

## Current position (2026-11-08)
- Phase: tester release live, gathering feedback. Next phase being planned with Ryan: going public (wider audience, revenue). Nothing for that phase is approved yet.
- Live build: 585f174 on main, deployed to https://stoopstoop.github.io/shape-of-war/ (GitHub Pages, Actions deploy.yml runs npm test then build). Tags: v1.0.0, v1.1.0, v2.0.0, v2.1.0, v3.0.0, tester-1 (d9bfb54).
- Tests: 4852 pass, 1 skipped, 2 todo. Accepted exception: tests/levelgen/generator.test.ts "200 levels under 500 ms" flakes locally (CI budget 2500 ms).
- Generator: GENERATOR_VERSION_V9 is the default (V1 to V8 configs frozen, bit identical).
- Name: Shape Legend (ruled 2026-11-09). Rename wave in flight.
- Builders: cloud sessions on Ryan's Max account (claude --cloud through the dispatcher). Console API credit about $5 left (valid to 2026-11-29), used only for tiny Sonnet jobs. Ryan's Max usage resets Tuesday; check headroom before large waves.

## Open checks and items
- Ripple tune on 585f174 (Ryan 2026-11-08): push 3.5, sound 3, audible only somewhat. His suggestion, not yet briefed: a "pixelated" sound with a short decay and release. Bosses never drowned out.
- Half drum (curved trough that does not wrap, gravity grows on steeper ground, late levels only): planned after the Tuesday 2026-11-10 Max reset. A reminder fires in the orchestrator session at 10:00 Abu Dhabi.
- Bombs reset Gravity wells and make no ripple (design, Ryan has not ruled).
- Not yet tested: iPhone Safari install and audio, small phone layout, fps at Insane plus Swarm.
- Known gaps: low effects tier drum grid does not bend under a ripple; a How to page turn may tick once; MORE cue can sit over the last visible line.
- HUD dev line (Par and level hash) stays visible by Ryan's choice (2026-11-07).
- Codex lane: Ryan's separate setup under a different GitHub owner. Nothing from any Claude session goes into ChatGPT or Codex.

## Recent gates (newest first; older ones in the archive)
| Gate | Date | Result | Evidence from Ryan |
|---|---|---|---|
| Ripple tune | 2026-11-08 | pass with note | 585f174: push 3.5, sound 3 (somewhat audible, wants a pixelated short decay), never louder than boss sounds |
| T4 nova ripple | 2026-11-07 | partial | c7aa3be: ripple on nova kill, ship and enemies pushed, none before nova, look 4, sound 2 (too quiet), push 2, drum seam yes, 60 fps |
| T3 | 2026-11-07 | partial | 1f1efb5: Brood at 5 (3 on Easy), boss goal intro, bar and results right, level 8 drum, Warden at 10; scheduled ripples underwhelming, dev pond 59 fps |
| Scroll bar | 2026-11-07 | pass | 9bb4ebe: bar on all scrolling screens, drag and page, tick sound 4, look 4, nothing covered |
| Score goal | 2026-11-07 | pass | a9cd3fe: goal under par, follows difficulty, score levels run the full timer by design |
| Tester release | 2026-11-05 | pass | d9bfb54 tagged tester-1 |

## Merged since the archive
- 2026-11-07: ledger-scrollbar, chorus-scroll-tick (9bb4ebe); T3: foundry-t3, forge-ripple, glow-ripple, chorus-ripple, ledger-boss-goal, glue 1f1efb5; T4: forge-nova-ripple, foundry-ripple-off, glow-nova-ripple, chorus-nova-ripple, glue c7aa3be; forge-ripple-tune (Console Sonnet $0.25), glue 585f174.

## Next action
Merged 2026-11-10: ledger-start-card (focused stack card, Return to Menu, mission types RUSH & SCORE, HOLD OUT, SEEK & DESTROY, GUARDIAN, clock on timed missions only, full reset), foundry-trough (generator V12: troughs from level 24 at about 20 percent of eligible levels; seed 42 level 24 is a trough), forge-trough (ship pull, 0 at the floor to about 160 u/s at the rim), glow-trough (valley projection; dev knob ?dev=1&trough=1) plus glue (feel test treats troughs as flat). Running: ledger-trough-option. Then Android build and one device check. Open: an untracked "public/Shape of War guide.html" from the guide session would be published if committed; it belongs outside public/. Repo is ryanstewdio/shape-of-war; live https://play.shapelegend.com/. Dependabot: 2 alerts (1 moderate, 1 low) to triage.
