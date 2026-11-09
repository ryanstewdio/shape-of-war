# Shipwright: capacitor

Create and check out branch feat/shipwright-capacitor before any edit. Never push main. You have explicit go ahead now: call add_repo for stoopstoop/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/stoopstoop/shape-of-war.git

Model: sonnet
Owned paths: package.json and package-lock.json (Capacitor packages and scripts only), capacitor.config.ts, android/, ios/ (if it can be generated here), .gitignore, scripts/ (new native build helpers), vite.config.ts (only if build:cap needs it), new docs/17-native-builds.md
Do not touch: src/ (Scribe renames strings in src/ui and Ledger builds src/economy in parallel), index.html, public/, tests/ other than new tests/native/
Read first: docs/16-public-plan.md (P1 technical approach, risks 8 and 9), package.json (build:cap), vite.config.ts

## Goal
P1 store launch: wrap the existing web game as Android and iOS apps with Capacitor, bundling dist/ locally (no remote URL). Purchases and age signals come later; this wave is the shell only.

## Acceptance
- Approved dependencies (Morpheus): @capacitor/core, @capacitor/cli, @capacitor/android, @capacitor/ios at the current stable major (8 expected; use the latest stable that supports Android API 36 and Xcode 26). Nothing else.
- capacitor.config.ts: appId com.shapelegend.game, appName "Shape Legend", webDir dist, no server.url. npm run build:cap builds with base ./ and runs cap sync.
- Android project generated and committed (android/), targetSdk and compileSdk 36, a sensible minSdk (state it), landscape locked, fullscreen immersive, no INTERNET permission unless Capacitor requires it (state which). If the Android SDK is available in your environment, build a debug APK and report the result; if not, say so.
- iOS: generate ios/ if possible here; otherwise leave exact Mac commands. Landscape only, status bar hidden, audio session suited to a game (state the setting).
- docs/17-native-builds.md: Mac prerequisites (Xcode 26 or later, Android Studio, JDK version, CocoaPods or Swift Package Manager as Capacitor needs), and exact commands to build and run on a phone, for Ryan to follow and for dispatcher shell jobs.
- The web build and GitHub Pages deploy are unchanged (npm run build output identical in behaviour, base /shape-of-war/).
- npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/shipwright-capacitor.md under 15 lines, including the dependency list with versions. Commit and push the branch. Stop.

## Rules
No em or en dashes. No analytics, ads or network SDKs.
