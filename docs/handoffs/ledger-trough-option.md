HAND-OFF ledger: trough-option
Branch: feat/ledger-trough-option
Files changed: src/ui/freePlay.ts, src/ui/intro.ts, src/ui/devGate.ts, src/core/settings.ts (surface field only), tests/ui/freePlaySetup.test.ts, tests/ui/troughIntro.test.ts
Tests added: 7 (row, shape picker disable, persistence and default, intro label, Details hint, hint text, dev knob)
npm test: all pass except the accepted generator perf test  npm run build: pass
How to verify on device: 1. Free Play, set Arena surface to Trough, shape buttons grey out with a hint. 2. Start, open the intro card Details: Arena Trough and the slope hint. 3. Restart the app, the setting persists.
Dependencies requested: none
Requests: none
Known gaps: the Adventure card shows the hint only if the level def carries surface 'trough' (Foundry sets it). Surface is stored only when Trough.
