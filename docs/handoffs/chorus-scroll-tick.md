HAND-OFF chorus: scroll-tick
Branch: feat/chorus-scroll-tick  Head: see git log
Files changed: src/audio/scrollTick.ts, src/audio/scrollTickSynth.ts, src/audio/synth.ts, tests/audio/scrollTick.test.ts, docs/handoffs/chorus-scroll-tick.md
Tests added: tests/audio/scrollTick.test.ts (7)
How to verify on device:
1. Open an info screen that scrolls and drag slowly: a quiet blip every 48 px.
2. Scroll top to bottom: pitch climbs one octave in pentatonic steps.
3. Fling fast: no more than 8 ticks per second.
4. Mute or set effects volume 0: silent.
Design: installScrollTick(bus, backend, now?) returns { dispose }. Rate cap uses a clock in seconds, injectable for tests.
Tick: 25 ms square, peak 0.02 (uiTap is 0.05), through the sfx master via sfxGraph, so silent when the context is not running.
Dependencies requested: none
Requests: none
Known gaps: tick is not counted against the voice cap (25 ms, max 8 per second).
