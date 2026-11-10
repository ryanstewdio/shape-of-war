# Hand-off Forge: fp-guardians
Branch: feat/forge-fp-guardians  Head: 14260c2 (code; this file on top)
Files: src/game/fpGuardians.ts (new), src/game/endless.ts, src/game/game.ts, src/ui/freePlay.ts (label), tests/game/fpGuardians.test.ts (7), tests/ui/fpGuardianLabel.test.ts (2), tests/ui/freePlaySetup.test.ts (label string).
What: guardian option ('every3', now "Every 2 min") is timed game side on the wave clock (stops on pause, respawn delay and while a guardian lives): first at 120 s, next 120 s after the previous is freed, order from freePlayBossFor (Brood first). Segment bosses are skipped for this option only, so never two alive. Chosen boss, Endless and Adventure paths unchanged; stored value kept so old saves load.
npm test: 5118 pass, 1 fail (accepted generator perf exception, generation is fast 200 levels). npm run build: pass. Banned API grep: empty.
Verify on device: Free Play, guardians Every 2 min, play to 2:00 (Brood enters, none earlier); free it, the next enters 2:00 later; chosen Warden still arrives at 1:40.
Dependencies requested: none.
Requests: Foundry: the 'every3' Free Play segments still carry the old 1:40 then 5 min bosses (freePlayBossFor and validate.ts expect them); the game ignores them, so they could be dropped from levelgen in a later gate.
Known gaps: past the end of the boss ladder no more guardians arrive (the ladder loops today, so not reachable in practice).
