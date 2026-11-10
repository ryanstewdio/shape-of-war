HAND-OFF Ledger: polish-d
Branch: feat/ledger-polish-d  Head: see git log
Files changed: src/ui/howTo.ts, menu.ts, settings.ts, hud.ts, src/main.ts, package.json (version 0.9.0), tests/ui/polishD.test.ts, release.test.ts, hud.test.ts
Tests added: polishD.test.ts (9); release and hud tests updated
npm test: pass except the accepted generator perf test  npm run build: pass
Verify: 1 How to stars and difficulty lines; 2 menu footer reads Shape Legend v0.9.0 (build sha); 3 without ?dev=1 no long press panel, no stress taps, no #code on HUD; 4 with ?dev=1 all three work
Dependencies requested: none. Requests: none (version read via JSON import of package.json in menu.ts, not a vite define)
Known gaps: none
