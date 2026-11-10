# Foundry hand-off: guardian-order
Branch feat/foundry-guardian-order. New orderedBossOfNumber in src/levelgen/boss.ts (Brood, Warden, Spindle, Ember, then the loop); bossForSegment and the Free Play every3 ladder use it. Adventure and t3 untouched.
First Endless and Free Play guardian: no first fight discount (hpMul 1); the 0.75 discount stays Adventure only (t3BossOfNumber).
Pins moved: boss.test, bossScheduleGolden, fpLevel, r5fp (Brood then Warden); fpLevel segment 6 hashes, r2bosses Endless digests and levelSnapshots segment 6 pin and snapshot (boss field changed).
npm test: all pass except the accepted generator perf test (538 ms vs 500). npm run build passes.
