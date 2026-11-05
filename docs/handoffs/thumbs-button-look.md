HAND-OFF thumbs: button-look
Branch: feat/thumbs-button-look  Head: see git log (code and this hand-off in one commit)
Files changed: src/input/{stack,buttons,reach,index}.ts, src/input/buttonLook.ts (new), src/ui/hud.ts, src/ui/hudFrame.ts; tests/input/{buttons,reach,visuals}.test.ts, tests/input/buttonLook.test.ts (new, 13), tests/ui/hudButtons.test.ts (new, 12), tests/ui/hudFrame.test.ts
Look: bomb and super both 56 px discs in 64 px hit circles, one vertical line, 12 px gap. Fill 25 percent in the palette colour (bomb key, yellow for super) at the applyNeon saturation, 2 px neon rim, a ring of 4 px pixel cells. Pressed 50 percent; no bombs or charging super dims (charging super keeps its sweep). Pixel font label above each, 2 px cells: BOMB and HOMING / TURBO / DETONATE; main shows BOOM for Detonate (Ryan's call, DETONATE is wider than the 68 px column). The old "SUPER: X" line and its hint are gone.
npm test: 4717 pass, 1 fail (accepted generator perf timing)  npm run build: pass  v7 grep: clean
Layout cost: stack centre now 50 px in from the right edge (was 44) so DETONATE fits; on the cover the stack sits 8 px lower so the super label fits under pause. Cover rest zone 51 px tall (was 59), 11 px at worst insets (REST_MIN_H lowered 16 to 8). Ring clearance unchanged (24 px). Bomb stretch 149.9 px, super 224.2 px on the cover.
How to verify on device:
1. Cover and main, start a level: both buttons the same size, one above the other, tinted discs with a dotted pixel ring, BOMB over the bomb and the super name over the super.
2. Use all bombs: bomb disc dims. Super dims while charging with the charged sweep lit, full tint when ready.
3. Change Neon in settings: button colours follow.
Dependencies requested: none
Requests (changes outside my ownership): main.ts: call hud.setHeld(held bomb, held super) once per frame from touch.buttonVisuals() (the held flags), so the 50 percent pressed look shows. Until wired the press look stays off.
Known gaps: cover lives and bombs text keeps its old offset under the bomb, leaving a 36 px gap where the hint was (Ledger territory). Main labels are column clamped, so they sit up to 2 px off the button centre.
