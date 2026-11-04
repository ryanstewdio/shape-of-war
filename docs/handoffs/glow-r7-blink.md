# Handoff: glow r7-blink

Branch: feat/glow-r7-blink
Session: https://claude.ai/code/session_018Gwqi51ZJTt4CFzkBS4j41

## What changed
- src/render/leaverLook.ts: shardPulseAlpha now swings 0.45 to 1.0 and shardPulse (glow width) 0.6x to 1.4x on a 0.5 s sine, phase offset per shard. The renderer already calls both through the palette and applyNeon path, so the blink is live with no renderer edit.
- New pure helper shardFlash(age): 1 for the last 0.15 s of the 0.5 s hold, else 0. New consts SHARD_PULSE_SEC, SHARD_ALPHA_LO, SHARD_GLOW_LO/HI, SHARD_HOLD_TOTAL, SHARD_FLASH_SEC. Removed SHARD_PULSE_HZ and SHARD_PULSE_DEPTH (no other users).
- tests/render/leaverLook.test.ts: blink range and offset test, flash window test (11 tests pass in file).

## Test and build
npm test: 326 files pass, 1 fails: generator "200 levels under 500 ms" (759 ms, the accepted perf exception). npm run build: pass. v7 shim grep: clean.

## Requests (outside my ownership)
- src/render/renderer.ts ~4829: use shardFlash(w.t[i]) to mix the shard tint to white (palette white) and bump alpha to 1 during the flash. Not wired, so the white flash is not visible yet.
