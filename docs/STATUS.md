Kickoff: 2026-10-27T08:49:39Z
History: docs/STATUS-ARCHIVE.md. Decisions: docs/DECISIONS.md (newest rows at the bottom).

## Current position (2026-11-11)
- Game: Shape Legend. Repo ryanstewdio/shape-of-war (public). Live web: https://play.shapelegend.com (deploy on every merge to main). Android: Capacitor debug APKs built on the Mac by dispatcher shell jobs; Ryan's test APKs are dev builds (npm run build:cap:dev: dev items on, Settings "Unlock all levels", fight timer on results and as a 6 s toast).
- Main is protected: PR only, required check "gate", branch up to date, merge commits only. Morpheus merges builder PRs with .agents/merge-pr.sh; only Ryan merges Furiosa cx/* PRs.
- Generator: V14 is current for Adventure guardian levels (par per difficulty over a tiered fight, LevelDef.difficultyPar); V13 arenas from 10; V12 troughs from 24; V1 to V13 frozen.
- Guardians: Shield (blue) over Health (red) bar, crack at the Shield end. Fury mid point (shared, src/game/bosses/fury.ts): 4.5 s invincible break, then enraged. Live for Warden (dash charge), Spindle (needle arms, 4 arms enraged), Ember (enraged Leavers on stun). Regular enemies after a guardian enters: Easy 0, Normal 25 percent, Hard 50 percent, Insane 60 percent. Pierce 1.5x on guardians; Pierce passes through Bulwark's front shield. Enraged Ember is a blue flame. Hit feedback: flash, sparks, tick, crack glow.
- Furiosa lane live: PR 15, 20 and 27 merged; publishes through the GitHub connector only (never git push); runs unattended ("Approve for me", ruled 2026-11-11); issues stay test only or isolated files; checkout starts at 8ba70ea, cause unknown.

## Open checks and items
- Awaiting Ryan's device check on dev APK ecc5807 (sent 2026-11-11): enraged Spindle 4 arms, Ember blue flame, crack width, Bulwark with Pierce (passes the shield, 2 damage), tick only hit sound, guardian par reachable (V14), fight lines for Brood, Spindle, Ember; plus the sweep of levels 25, 30, 35, 40, 45, 50 on Normal (fight line and rating each).
- Running (launched 2026-11-11): swarm-fury-three and glow-fury-three (Opus): fury for Brood (Broodlings enrage), Mirage (false landings), Gravitas (tide). Next waves, table approved by Ryan: Bastion, Tempest, Twins (Bastion needs the validator M1 rule widened by Foundry first), then Prism.
- Fight lines (dev timer) not yet recorded by Ryan; hit points tuned from his ratings: Brood 3, Warden 4, Spindle 4, Ember 4 on 9c799e2.
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
Record Ryan's device check and sweep on ecc5807. Review and merge swarm-fury-three and glow-fury-three, dev APK, device check of the three furies. Then brief wave 2 (Foundry M1 change first).
