HAND-OFF glow: hit-feel  Branch: feat/glow-hit-feel  Head: see git log
Files: src/render/bossHitFury.ts, renderer.ts, particles.ts, particlePool.ts (sparkSize); tests/render/bossHitFury.test.ts (+5)
Hit: flash fill 0.5 to 0.8, glow 0.6 to 1.4, outline 1.6x to 2.4x; landed sparks 2x size, 1.3x life; flash gap 0.18 s and blocked grey spark unchanged.
Cracks: glow underlay and edge/stub widths scale with 1 - hp/maxHp, plus a 0.25 s pulse per landed hit (hitT). Drawn for the main body only; split parts have no cracks drawn today.
npm test: all pass except accepted generator perf timing; build pass; v7 grep clean. Verify on device: shoot a cracked guardian, cracks brighten as hp falls and pulse per hit.
