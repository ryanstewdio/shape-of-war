HAND-OFF glow: r6-shards
Branch: feat/glow-r6-shards  Head: see git log
Files changed: src/render/leaverLook.ts, src/render/renderer.ts, tests/render/leaverLook.test.ts, docs/handoffs/glow-r6-shards.md
Tests added: 4 in tests/render/leaverLook.test.ts (sweep timing, band polygon, 6 Hz pulse, glint count and corners)
npm test: pass except tests/levelgen/generator.test.ts "generation is fast" (743 ms vs 500 ms, accepted perf exception, not touched)  npm run build: pass
How to verify on device:
1. Reach a Leaver and kill it so it splits into shards.
2. Each shard keeps its solid colour; a bright band sweeps across it every 0.6 s.
3. One or two star glints pop on shard corners, out of step between shards.
4. Brightness pulses about 15 percent at 6 Hz, offset per shard, so a group sparkles.
Dependencies requested: none
Requests (changes outside my ownership): none
Known gaps:
- Band and glints draw on one shared overlay Graphics (shardG), capped at 48 shards.
- Band and glint use the shard tint mixed toward the palette white; glint centre is the shared 0xffffff of drawGlint.
- The old 35 percent shardFlicker is no longer used by the renderer (export and tests kept).
- No add_repo tool in this session; pushed with plain git.
