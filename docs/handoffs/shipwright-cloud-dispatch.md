# Shipwright hand off: cloud dispatch

Branch: chore/cloud-dispatch (from main 8a312ef)
Session: https://claude.ai/code/session_018Gwqi51KevzKtDahLjTxuF

## What changed
- `scripts/dispatcher.mjs` gains two job types. Agent and shell jobs and the shell allowlist are unchanged.
  - `cloud`: validates model (opus or sonnet), that the brief exists under docs/briefs/, and that the branch is not main. It then runs `env -u ANTHROPIC_API_KEY claude --model <model> --cloud "Read <brief> and carry it out exactly. Create the branch it names before any edit. Never push main."` from the repo root, so the session bills the logged in Max account. `result.json` gets `sessionUrl` (the View URL, query string dropped) and `resume`. If the command is still attached after 60 s (`CLOUD_WALL_MS`) it is killed, and with a URL printed the job still passes (`killedAfterUrl: true`).
  - `watch`: every 2 min (`WATCH_POLL_MS`) it runs `git ls-remote --heads origin <branch>`, then fetches and runs `git cat-file -e origin/<branch>:<handoff>`. When the hand off is found, `landed: true`, `headSha` and `originMain`, exit 0. After `timeoutMin` (default 90), `landed: false`, exit 1. Watch jobs never count against MAX_PARALLEL.
- `node scripts/dispatcher.mjs --selftest`: 20 checks on URL parsing, validation, argv and parallel counting. It runs before the startup checks, so no API key is needed. The repo has no tests/scripts pattern, so this follows the brief's fallback.
- `.agents/README.md` documents both types, the new result fields and the two settings.

## Restart to pick it up
In the Shape of War terminal: Ctrl C the dispatcher (jobs running at that moment land in failed/ as interrupted; requeue them with a new seq), `git pull`, then `npm run dispatcher`. ANTHROPIC_API_KEY stays exported for agent jobs; cloud jobs drop it themselves.

## Job examples
`.agents/queue/0101-swarm-boss-abilities.json`:
`{ "type": "cloud", "nickname": "swarm", "slug": "boss-abilities", "model": "opus", "brief": "docs/briefs/swarm-boss-abilities.md", "branch": "feat/swarm-boss-abilities" }`
`.agents/queue/0102-fable-watch-boss-abilities.json`:
`{ "type": "watch", "nickname": "fable", "slug": "watch-boss-abilities", "branch": "feat/swarm-boss-abilities", "handoff": "docs/handoffs/swarm-boss-abilities.md", "timeoutMin": 90 }`

## Tests
- `--selftest`: 20 of 20 passed.
- End to end in a scratch repo with a fake `claude` that stays attached and a local bare remote:
  - The cloud job ran with ANTHROPIC_API_KEY unset and `--model` before `--cloud`, recorded the stripped URL and Resume line, and was killed after the wall clock with exit 0.
  - A watch job claimed beside it with MAX_PARALLEL 1 recorded `landed: true` with the pushed head and origin main.
  - A watch on a branch that never lands timed out with exit 1.
- npm test: 3071 passed, 1 skipped, 1 todo. npm run build: pass.

## Risks
- The parse expects lines starting "View" and "Resume" (any case, ANSI stripped), with a fallback to the first claude.ai URL. If the CLI wording changes, `sessionUrl` is null and the job fails loudly.
- A watch fetch can race a shell merge in the main checkout; a failed poll is logged and retried.
- Not run against the real `claude --cloud` from the Mac; the first real job is the live check.
