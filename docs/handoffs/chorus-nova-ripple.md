# Handoff: chorus nova-ripple

Branch: feat/chorus-nova-ripple
- rippleSfx.ts: removed the warn alert and the 'sim:rippleWarn' listener. 'sim:ripple' now calls playRipple(gain), gain 0.10 to 0.20 by strength.
- rippleSynth.ts: sine thump 70 to 50 Hz (0.35 s) then band passed noise sweeping 1800 to 220 Hz over 1.5 s, after a 0.12 s delay so it trails the well explosion. Through the sfx master and the one shot voice cap.
- Gain sits under boss cues (thump peak at most 0.2). src/audio/synth.ts: comment only.
- tests/audio/rippleSfx.test.ts rewritten, 6 tests: no cue on rippleWarn, cue on ripple, gain rises, length, dispose.
- npm test: only the accepted generator perf test failed (660 ms vs 500). npm run build passes.
- Requests: Fable removes the 'sim:rippleWarn' event and RIPPLE_WARN_SEC at merge (tests still emit it to prove silence).
- Remote: origin was empty; added https://github.com/stoopstoop/shape-of-war.git. add_repo is not a tool here.
