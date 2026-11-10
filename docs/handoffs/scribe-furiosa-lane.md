# Hand-off scribe: furiosa-lane

Branch: docs/scribe-furiosa-lane
Session: https://claude.ai/code/session_018Gwqi4ag5DrRphT6ghCN4n

## Files touched
- AGENTS.md (new, repo root): Furiosa rules in the brief's order, sections 1 to 8.
- docs/runbooks/furiosa-templates.md (new): Template 1 (the issue) and Template 2 (Claude's PR review comment).
- CLAUDE.md: one section "Furiosa (Codex lane)", 4 bullet lines, placed just before the hand-off format section at the end.
- docs/handoffs/scribe-furiosa-lane.md (this file).

## Dash check
Perl dash check from .github/workflows/ci.yml run over AGENTS.md, docs/runbooks/furiosa-templates.md, CLAUDE.md and this file: no output, exit 0.

## Test and build
- `npm ci`: clean install.
- `CI=true npm test`: 368 test files passed; 5128 tests passed, 1 skipped, 2 todo.
- `npm run build`: passed (tsc and vite build, service worker emitted).
- No source files changed, so the PixiJS v7 grep is unaffected.

## Open questions
1. Section 4 bans "any frozen generator version under src/levelgen" in general terms. The versions live inside src/levelgen/generator.ts and sibling files rather than in separate files, so an issue that allows src/levelgen/generator.ts should say in Reserved names which versions are frozen.
2. The dash check in AGENTS.md section 7 uses `origin/main...HEAD`, the local equivalent of the ci.yml step with base ref main. Confirm that is the wording Claude wants Furiosa to run.
3. The CLAUDE.md section sits before "Hand-off format" so the hand-off template stays the last block. Move it below if "near the end" should mean the very end.
