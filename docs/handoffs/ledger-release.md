# Hand off: Ledger release (tester build polish, docs/14 items 1 to 4 and 6)

Branch: feat/ledger-release. Session: https://claude.ai/code/session_018Gwqi5qysBU1oTcYLM9DDE

## What changed
- Name: "Shapes of War" in the document title, the iOS home screen title meta, manifest name and short_name, the menu, boot and splash title (GAME_TITLE). vite.config.ts has no name fields (manifest: false), so it is unchanged.
- Icons: original neon set (magenta hexagon, amber diamond, cyan triangle, white core) drawn as SVG in code and rasterised by Chromium, committed as 192, 512 and maskable PNGs in public/icons (palette PNGs, all under 20 KB). The generator script is not in the repo (scripts/ is not mine).
- Splash: src/ui/splash.ts, a DOM overlay with the neon title and one 1.2 s CSS glow pulse (sow-splash-pulse in dom.ts) above the boot screen. A tap skips it; the tap never falls through to "Tap to start".
- Menu footer: "v3 build <short sha> seed <run seed>" (footerLine in menu.ts). The sha comes from the existing __BUILD_ID__ define; "nogit" or a missing define gives "dev". Repainted on each menu open, so a typed seed shows.
- Dev gate: src/ui/devGate.ts. Without ?dev=1, main.ts reads an empty query and strips it from the address bar (history.replaceState) at the very start of boot, before the renderer, touch and devpanel read window.location. So ?boss, ?tilt, ?seed, ?level, ?debug, ?surface, ?glow, ?stress, ?particles and the bloom knobs all do nothing. The corner #sow-build label shows only with ?dev=1 (the footer replaces it). Show FPS stays off by default. The error label still shows after a script error.
- Difficulty: sow.settings.difficulty (easy, normal default, hard) in core/settings.ts, a "Difficulty" row (first choice row) on Settings, "Difficulty: Normal" on the intro card. main.ts passes it to createGame and createEndlessGame through ReleaseGameOptions = GameOptions & { difficulty: Difficulty }; read at each level start.
- Key registered in storageKeys.test.ts, storageKeysV3.test.ts and the docs/13 key table.

## Files touched
src/main.ts, src/core/settings.ts, src/ui/{devGate,splash}.ts (new), src/ui/{menu,intro,settings,dom}.ts, index.html, public/manifest.webmanifest, public/icons/*.png, docs/13 key table, tests/ui/{release,settings,results}.test.ts, tests/settings/difficulty.test.ts, tests/qa/storageKeys{,V3}.test.ts.

## Tests
New: tests/ui/release.test.ts (30: rename, footer, dev gate per knob, splash skip and timer, intro difficulty), tests/settings/difficulty.test.ts (9: persistence, model, row). Updated settings, results and storage key tests for the new field, name and key.
npm test: 3988 pass, 1 fail (the accepted "200 levels under 350 ms" perf test, 556 ms in this VM). npm run build: pass. tsc clean, v7 grep empty, no dashes added. tests/qa level snapshots untouched.

## Contracts for other roles
- Forge: add `difficulty?: Difficulty` to GameOptions; main.ts already passes it, so glue just drops the ReleaseGameOptions alias.
- Anyone adding a URL knob: read window.location.search after boot starts, or take the gated search from main.ts; it is empty without ?dev=1.

## Risks
- replaceState drops the query on a non dev URL, so a reload keeps it stripped (intended).
- Difficulty has no effect in play until Forge and Swarm read GameOptions.difficulty.
- TITLE_EMS went from 7.8 to 8.4 for the longer title; check the cover screen menu fits.

## Device check for Ryan
1. Open the Pages link on the Fold. You see a black screen with "Shapes of War" glowing in cyan for about one second, then "Tap to start". Reopen and tap during the glow: it skips straight to "Tap to start", and the game does not start.
2. Tap to start. The menu footer reads "v3 build" plus seven letters and digits, then "seed" and a number. No build label in the bottom right corner.
3. Open the link with ?seed=5&debug=1 added: the address bar loses the query, the seed is your normal one, there is no debug readout. Add &dev=1 too: seed 5 and the debug readouts return.
4. Settings: the first choice row is Difficulty with Easy, Normal (lit), Hard. Tap Hard, go back, start Adventure: the intro card says "Difficulty: Hard". Close and reopen the app: Hard is still lit.
5. Install to the home screen on Android and on an iPhone: the icon is the neon hexagon, diamond and triangle, and the label reads "Shapes of War".
