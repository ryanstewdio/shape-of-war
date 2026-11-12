# Hand off Ledger: capture-mode

- URL: `<build>/?dev=1&capture=1` plus any scene knob (`&boss=`, `&level=`, `&seed=`, `&trough=`). Without dev=1 (or VITE_SOW_DEV=1) the gate strips it and nothing changes.
- Hides: stick knobs (the sticks still work), corner build label, viewport label (even with ?debug=1 or after an error), HUD dev level code, dev fight timer toast and results fight line. The two finger long press that opens the dev panel is never installed. Sim, input, storage and player UI are unchanged.
- Layout cause: All and None sit in `.sow-choice-btns`, whose shared `flex: 1 1 240px` turned into a 240 px height inside the column `.sow-fp-enemies` box.
- Fix: `.sow-fp-enemies .sow-choice-btns { flex: 0 0 auto }`, so they are 44 px like every other chip; an invisible `::after` band (4 px past the padding box, so 2 px past the border) makes the touch target 48 px. Nothing else on the screen moves.
- Checked in headless Chromium on a production build at 1280x720, 915x412 and 1080x900: All and None measured 240 px before, 44 px after (other chips 44 px), with a 48 px tap band found by elementFromPoint.
- Files: src/ui/capture.ts (new), src/ui/devGate.ts, src/main.ts, src/ui/dom.ts, tests/ui/capture.test.ts, tests/ui/fpShortcuts.test.ts, tests/ui/polishD.test.ts and tests/ui/release.test.ts (source pins follow `view`, still dev only).
- Tests added: capture.test.ts (11: isCapture, gate strip, stick circles on and off, devView, main glue), fpShortcuts.test.ts (4: CSS rules and 48 px target).
- npm run build passes. npm test: 397 of 398 files pass; tests/levelgen/generator.test.ts "200 levels under 500 ms" fails on this 4 core container at about 600 ms, on untouched main too (not mine, levelgen untouched).
