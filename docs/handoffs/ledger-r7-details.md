# Hand-off Ledger: r7-details

Branch: feat/ledger-r7-details. Gate R6 (Ryan), results 3.75: expanded Details was cramped against its border.

## What changed
- `.sow-details-body` in src/ui/dom.ts is now a bordered two column grid: 16 px padding, 10 px row gap, 16 px column gap, labels dim on the left, values right aligned on the right.
- Each `.sow-kv` row uses `display: contents`, so the DOM is unchanged (row of label and value) and both screens share it (intro and results use createDetails).
- Columns are `minmax(0, max-content) minmax(0, 1fr)` and text uses `overflow-wrap: anywhere`, so long values wrap inside the border on the cover screen.

## Tests
- New: tests/ui/r7Details.test.ts (3 tests: grid CSS, flattened rows and wrapping, every row labelled).
- npm test: 4643 passed, 1 failed (levelgen "200 levels under 500 ms", the accepted perf exception). npm run build passes. The v7 grep prints nothing.

## Device check
1. Finish a level, tap Details on results: padded bordered grid, values clear of the border.
2. Same on the intro card, and on the cover screen with a long seed or level code (wraps).

## Known gaps
- Not checked on a device. Push depends on repo access (see the final message).
