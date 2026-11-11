Kickoff: 2026-10-27T08:49:39Z
History: docs/STATUS-ARCHIVE.md. Decisions: docs/DECISIONS.md (newest rows at the bottom).

## Current position (2026-11-11)
- Game: Shape Legend. Repo ryanstewdio/shape-of-war (public). Live web: https://play.shapelegend.com (deploy on every merge to main). Android: Capacitor debug APKs built on the Mac by dispatcher shell jobs; Ryan's test APKs are dev builds (npm run build:cap:dev: dev items on, Settings "Unlock all levels", fight timer on results and as a 6 s toast).
- Main is protected: PR only, required check "gate", branch up to date, merge commits only. Morpheus merges builder PRs with .agents/merge-pr.sh; only Ryan merges Furiosa cx/* PRs.
- Generator: V13 is current for Adventure guardian levels from 10 (bigger arenas); V12 troughs from 24; V1 to V12 frozen.
- Guardians: Shield (blue) over Health (red) bar, crack at the Shield end. Fury mid point (shared, src/game/bosses/fury.ts): 4.5 s invincible break, then enraged. Live for Warden (dash charge), Spindle (needle arms, 4 arms enraged), Ember (enraged Leavers on stun). Regular enemies after a guardian enters: Easy 0, Normal 25 percent, Hard 50 percent, Insane 60 percent. Pierce 1.5x on guardians. Hit feedback: flash, sparks, tick, crack glow.
- Furiosa lane live: PR 15, 20 and 27 merged; publishes through the GitHub connector only (never git push); runs unattended ("Approve for me", ruled 2026-11-11); issues stay test only or isolated files; checkout starts at 8ba70ea, cause unknown.

## Open checks and items
- Running (launched 2026-11-11): swarm-pierce-arms (Spindle 4th arm in the sim, Pierce through Bulwark shield), glow-ember-flame (blue flame enraged Ember, thinner cracks, Spindle arm drawing), proctor-par-audit (report and proposal only). Review, merge, dev APK, device check.
- Next design pass for Ryan's approval: fury moves for the other seven guardians (Brood, Mirage, Gravitas, Bastion, Tempest, Twins, Prism); Ryan cleared membranes and boss abilities that change barriers for guardian arenas (membranes need the validator M1 rule widened beyond drums).
- Fight lines (dev timer) not yet recorded by Ryan; hit points tuned from his ratings: Brood 3, Warden 4, Spindle 4, Ember 4 on 9c799e2.
- Known: old fx:hit boss cue plays alongside the new tick (Ryan rated the sound good). Free Play shares the boss wave budget table.
- Later queue: hunt objective, gems wiring to results and storage, native icons and splash, Dependabot alerts, Foundry clean up of the old 'every3' levelgen bosses, ripple "pixelated short decay" sound idea.
- Not yet tested: iPhone Safari install and audio, small phone layout, fps at Insane plus Swarm.

## Recent gates (newest first)
| Gate | Date | Result | Evidence from Ryan |
|---|---|---|---|
| Boss calm and arenas | 2026-11-11 | pass with notes | 9c799e2: Brood 3, Spindle 4, arena right, needles fair, enraged Spindle 3 arms (bug), Ember 4, Leavers yes, calmer waves yes, hits readable, cracks too thick in places, 59 fps |
| Fury two | 2026-11-11 | partial | ecde5b2: Brood 0:22 rated 1, refill yes; levels after 10 too hard (swarm plus small arena); hits hard to read; 60 fps |
| Warden fury | 2026-11-11 | pass | 1580146: unlock yes, one bar yes, Warden fun 4, break, enraged form and aim line clear |
| Boss health | 2026-11-11 | partial | 1d724e3: footer right over the old app, bar on the wrong element, Brood 150 to 170 s, Warden 37 s, Pierce yes, trough 60 fps |
| Trough and native | 2026-11-10 | pass | 6987c7c after clearing data: troughs, pull 3, 3D 4; Auto Backup cause found |

## Next action
Review and merge swarm-pierce-arms, glow-ember-flame and proctor-par-audit when Ryan says pushed; build a dev APK; device check (enraged Spindle 4 arms, Ember blue flame, crack width, Bulwark with Pierce, fight lines). Bring the par audit proposal and the seven guardian fury draft to Ryan for approval before any build.
