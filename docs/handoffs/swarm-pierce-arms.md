# Swarm hand-off: pierce-arms
Branch feat/swarm-pierce-arms. Spindle: the sim was already right (4 arms, HAZARD.sweepArmsMax is 4); new test holds vy 4 on the live sweep every tick for 20 s enraged across 5+ rebuilds. The 3 red arms Ryan saw is not a sim cap, so check the render side (Glow).
Bulwark: Pierce (style pierce, so combos with Pierce too) skips the shield check in combat.ts bulletHits; spread, rapid, drone, blades, bombs and Detonate unchanged.
Tests: tests/game/pierceArms.test.ts (5 new); fxevents pierce pin updated (pierce no longer blocked, spread still is).
npm test: all pass except the accepted generator perf test; npm run build passes.
Requests: none. Known gaps: none.
