# Shipwright: native-sw

Create and check out branch feat/shipwright-native-sw before any edit. Never push main. You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: vite.config.ts (PWA plugin options for the native build only; keep the base line and SOW_BASE as they are), package.json (build:cap script only), scripts/ (a native build helper if needed), android/ and ios/ (cap sync output), tests/native/
Do not touch: .github/workflows/, CLAUDE.md (a parallel branch edits it), src/ except a guard in the service worker registration path if the build option cannot do it, docs/ other than your hand off
Read first: vite.config.ts (vite-plugin-pwa), package.json build:cap, docs/17-native-builds.md

## Goal
Ryan installed a new Android debug build over an old one and saw the old game: the PWA service worker from the first install keeps serving its cached bundle inside the app's WebView. The native app bundles its files locally, so it needs no service worker.

## Acceptance
- The native build (npm run build:cap) ships no service worker: no sw.js, registerSW.js or workbox file in dist for the native build, and nothing registers one. The web build (npm run build) keeps its service worker exactly as today.
- An app that already has an old service worker installed drops it on first launch of the new build: on native, unregister any existing service worker registrations and clear its caches once, then reload (guard it so it runs only on the native platform and only when a registration exists).
- Tests: the native build output has no service worker files; the unregister guard does nothing on the web. npm test and npm run build pass on the branch (accepted generator perf exception aside); report whether npm run build:cap passes. Hand off at docs/handoffs/shipwright-native-sw.md under 10 lines. Commit and push the branch. Stop.

## Rules
TypeScript strict, no any. No em or en dashes.
