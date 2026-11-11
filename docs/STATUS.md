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
Main is protected (PR only, gate green, merge commits). Merged 2026-11-10 and 11 via PRs: forge-trough-tune (11), glow-trough-depth (12), shipwright-native-sw (13), boss bar stub and briefs (16). Android check on 6987c7c passed (pull 3, 3D 4); Android Auto Backup restored stale WebView data (fix: shipwright-backup-rules). Running: swarm-boss-health (fight lengths 60 s to 2.5 min, pierce 1.5x on guardians, Shield then Health bars, Broodlings bars), ledger-boss-bar, shipwright-backup-rules. Furiosa lane live: first task merged (PR 15, 7e07655); open item: Codex caches its container up to 12 hours from the default branch, so tasks can start up to 12 hours behind main (Reset cache before each task, being confirmed). Next: hunt objective, gems wiring, native icons and splash. Game URL https://play.shapelegend.com; repo ryanstewdio/shape-of-war.
