# Hand-off Ledger: gems

Branch feat/ledger-gems. New src/economy/ (pure, no PRNG, no storage, no UI) and tests/economy/ (43 tests).
- earn.ts: `EARN_TABLE` (5 per star, 50 boss first clear, Endless milestones 10k to 1M paying 10 to 100, Free Play 0); `awardsFor(event: ResultEvent, claimed?: ReadonlySet<string>, table?): GemAward[]`; `totalGems(awards)`; ids `starAwardId`, `bossAwardId`, `milestoneAwardId`; `starCeiling(difficulty)` caps the stars a run can lift.
- ResultEvent: `{ mode: 'adventure'|'endless'|'freeplay', levelIndex, difficulty, starsBefore, starsAfter, bossLevel, success, score }`.
- ledger.ts: `EMPTY_LEDGER`, `apply(ledger, entry): { ledger, status }` (applied, duplicate, insufficient, owned, invalid), `applyAwards`, `spend(ledger, itemId, price)`, `balance`, `owns`, `entryIds` (feed to awardsFor as claimed), `hasEntry`, `spendId`.
- save.ts: `serialize(ledger)`, `deserialize(text|null): { ledger, status: ok|empty|migrated|corrupt, problems }`, `fromSave`, `toSave`, `migrateV0` (`{ gems, owned }` to v1), `MIGRATIONS` hook keyed by from version, `SAVE_VERSION = 1`. Never throws; corrupt falls back to an empty wallet.
- Wiring later: call awardsFor with entryIds(ledger) on the results screen, applyAwards, then store serialize under a new registered sow. key (tests/qa storage key scans need the key registered).
- npm test: all pass except the accepted generator perf test. npm run build: pass.
- Known gaps: earn values are placeholders; difficulty only caps stars (no per difficulty multiplier); PVP earn and daily cap are P2.
