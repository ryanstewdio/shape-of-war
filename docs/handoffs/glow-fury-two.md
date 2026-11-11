HAND-OFF glow: fury-two  Branch: feat/glow-fury-two  Head: see git log (code and hand-off in one commit)
Files: src/render/bossHitFury.ts (new, pure), src/render/renderer.ts, src/render/hazardFx.ts (optional sweep alphaMul); tests/render/bossHitFury.test.ts (new, 14)
Hit: landed hit washes the whole body white 0.07 s (fill 0.5 plus outline, glow up), from view hitT or, until Swarm writes hitT, the hit events; one flash start per 0.18 s max. 'sim:bossHit' landed: 2 to 4 hue sparks; blocked: 1 small grey spark, no flash (rate capped 45 / 70 ms). Once 'sim:bossHit' arrives it owns the sparks over 'fx:hit'.
Fury: any guardian with view fury takes the Warden break shake, flash and red cross, enraged hot red pulse. Spikes Warden only (Warden look unchanged). Spindle beam arms cross to hot red and pulse; Ember enraged dashes add a short hot red spark trail.
npm test: 5260 pass, 1 fail (accepted generator perf timing)  npm run build: pass  v7 grep: clean
Verify on device: 1. Shoot any guardian: white flash and sparks, steady strobe under spread fire. 2. Shoot a closed core or fury break: one grey spark, no flash. 3. Spindle and Ember fury (once Swarm lands): red arms pulse, red dash sparks.
Dependencies: none. Requests: none. Gaps: Spindle and Ember fury untested on device until Swarm writes fury for them.
