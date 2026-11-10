# Shipwright: back-button

Create and check out branch feat/shipwright-back-button before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: package.json and package-lock.json (@capacitor/app only), new src/native/, tests/native/, android/ and ios/ (cap sync output only)
Do not touch: src/main.ts and src/ui/ (Morpheus wires the handler after the story work merges), vite.config.ts, index.html, .github/, everything else
Read first: capacitor.config.ts, docs/17-native-builds.md, @capacitor/app docs for backButton and exitApp

## Goal
On the Android app the back gesture closes the game. Ryan ruled 2026-11-10: in a level back pauses; on other screens it goes to the previous screen; on the main menu it shows "Press back again to exit" and a second back within 2 s exits.

## Acceptance
- Approved dependency (Morpheus): @capacitor/app at the version matching @capacitor/core 8.6.x. Nothing else.
- src/native/backButton.ts: installBackButton(handler: () => 'handled' | 'exit') returns an uninstall function; on the web (not native) it does nothing; on Android it listens for backButton and calls App.exitApp() only when the handler returns 'exit'. A pure helper for the double back rule (first back on the menu returns a 'confirm' state with a 2 s window, second back within it returns 'exit'), with tests using an injected clock.
- npx cap sync updates android/ and ios/; the Android debug build still succeeds if you can run it (say if you cannot).
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/shipwright-back-button.md under 12 lines, with the exact wiring call Morpheus should add in src/main.ts. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
