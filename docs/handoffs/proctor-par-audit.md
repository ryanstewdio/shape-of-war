HAND-OFF proctor: par-audit  Branch: feat/proctor-par-audit
Files: scripts/par-audit.ts, tests/qa/parAudit.test.ts (4 tests), docs/qa/par-audit.md. No src/ change. npm test: 5324 pass, 0 fail. npm run build: pass. Dependencies requested: none.
Finding: non guardian par is steady (Normal 0.49 to 0.51 of available score); every guardian level is out of reach on Easy, Normal and Hard (Normal 1.73 to 2.25, level 15 about 1.95) because guardian par still counts 180 s of full waves after the entrance while the boss calm keeps 0, 25 or 50 percent of them, and a quick kill ends the level early.
Proposal: par on difficulty d = s_d x score available (Easy 0.51, Normal 0.49, Hard 0.42, Insane 0.36); guardian available counts the calm and a 90 s fight. Needs GENERATOR_VERSION_V14, a frozen V13 pin, and a per difficulty par on guardian LevelDefs read by targetsFor.
Verify: node scripts/par-audit.ts prints the tables in docs/qa/par-audit.md byte for byte.
Requests: Fable to rule on the proposal (DECISIONS row); Foundry and Ledger own the fix.
Known gaps: guardian adds are not counted; the 90 s fight is an estimate, not measured per guardian.
