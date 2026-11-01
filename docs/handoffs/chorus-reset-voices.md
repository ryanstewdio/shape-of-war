# Handoff: chorus reset-voices

Branch: feat/chorus-reset-voices
Session: https://claude.ai/code/session_018Gwqi3DRs1ce9APdy9rK7s

## What changed
- src/audio/gw2.ts: new RESET_FADE (0.1 s). stopAll now fades every sustained voice (saw buzz, whirlpool roars, shield hum) over 100 ms and clears the saw handle, the nova map and the shield map.
- stopAll runs on game:start, game:quit, game:over and now on ui:screen to any screen other than play.
- Pause and resume are not handled on purpose: live voices stay tracked, so resume keeps exactly those still valid. Voices end only by their own events or a reset.

## Files touched
- src/audio/gw2.ts
- tests/audio/gw2.test.ts
- docs/handoffs/chorus-reset-voices.md

## Tests added (5, in tests/audio/gw2.test.ts)
- game:start, game:quit: all loops stopped with a 100 ms fade, maps empty (ids restart).
- ui:screen menu stops all, ui:screen play does not.
- pause and resume keep a live roar, which a well kill then stops.

## Test and build
- npm test: 261 files, 3688 passed, 1 todo. No failures, no perf exception hit.
- npm run build: pass. v7 grep prints nothing.

## Risks
- I could not reproduce the leak on a device. The old code already stopped loops on game:start and game:quit, so the likely gaps were retry paths that emit only ui:screen, and the 400 ms release. If the noise persists, suspect a loop started after the reset event.
- Pause does not mute loops here; if they sound during pause, that needs a backend pause hook (a request, not done).
- The brief's add_repo step has no tool in this session; not run.

## Contracts for other roles
- No event changes. Anyone leaving play must emit ui:screen with a non-play screen, or game:quit.

## Device check for Ryan
Start a level with whirlpool wells and let the roar build. Pause, wait, resume: the roar should continue. Then die or choose retry, and also quit to the menu. In each case the roar, saw buzz and shield hum should fade out within a fraction of a second and the new level or menu should be silent until a new well appears.
