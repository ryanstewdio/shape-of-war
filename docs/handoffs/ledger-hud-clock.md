# Hand-off ledger: hud-clock
Branch: feat/ledger-hud-clock. Files: src/ui/objective.ts (clockView, warnStep, labels without time), src/ui/hudFrame.ts (clock box), src/ui/hud.ts (setClock, neon frame, pulse), src/main.ts (emitHud only), tests/ui/hudClock.test.ts (new, 24), tests/ui/objective.test.ts and hud.test.ts (labels, boss row).
What: framed pixel font clock, cover above the objective bar, main at the left end of the objective area. Countdown on scoreInTime and survive; time played, smaller, on destroy and boss levels; hidden in Endless and Free Play (their line keeps its clock). Yellow plus one pulse at 1:00, orange plus one pulse at 0:30, red with larger digits and a pulse every second from 0:10 (one 180 ms pulse a second at most). 'ui:timeWarn' fires at 60, 30, 10 to 1 off the objective sim clock, once per second, never in a burst.
Main boss row is now left aligned under the narrowed bar (it used to be centred), so it stays clear of the clock and the lives box.
npm test: all pass except the accepted generator perf test. npm run build: pass. v7 grep: clean.
Device check:
1. Cover and inner screens: play a survive level. The clock sits above the bar (cover) or left of it (inner), and the bar reads "Survive" with no time.
2. At 1:00 the clock turns yellow and pulses once. At 0:30 it turns orange and pulses. From 0:10 it is red and larger and pulses every second.
3. Pause at 0:08 and resume: the warning for that second does not play twice. Play a scoreInTime level: once the target is met, the time left is still easy to read.
4. Play a destroy or boss level: a small white time played clock shows. Endless shows no clock box.
Known gaps: none of the screens has been checked on a device yet. Note: an uncommitted docs/DECISIONS.md change was already on main and is left out.
