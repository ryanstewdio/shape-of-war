HAND-OFF glow: ember-flame  Branch: feat/glow-ember-flame
Files: src/render/emberFury.ts (new, pure), renderer.ts, bossHitFury.ts, hazardFx.ts; tests/render/emberFury.test.ts (new, 8), bossHitFury and hazardFx tests updated
Ember fury: blue flame pulsing blue, purple, white at 1.5 Hz (bossBlue, bossViolet), noise flickered tongue edges, same-colour dash sparks; break crosses orange to blue; other guardians and Warden unchanged.
Cracks: width multiplier capped at 1.6x (was 2.6x), glow alpha raised so brightness grows more than width. Spindle: sweepArms cap 3 raised to 8, all arms tinted.
npm test: all pass; build pass; v7 grep clean. Verify on device: enrage Ember (blue pulsing flame), crack a guardian (thinner cracks), enrage Spindle (4 red arms).
