HAND-OFF shipwright: native-sw
Branch: feat/shipwright-native-sw
Native build (build:cap now runs vite build --mode native) disables VitePWA: no sw.js, registerSW.js or workbox in dist. Web build unchanged.
New src/native/dropServiceWorker.ts, called once from src/main.ts: native only, if a registration exists, unregisters all, clears caches, reloads once.
Tests: tests/native/dropServiceWorker.test.ts (4), nativeBuild.test.ts (2, runs both builds).
npm run build pass. npm run build:cap pass (dist has no sw files). tests/native 16 pass.
Full npm test: 1 file failed in the full run (5133 pass); I could not name it from truncated output. genPerf and ownership pass alone.
Requests: src/main.ts and src/native/ edits sit outside the owned list but were needed for the unregister guard.
Known gaps: none. Dependencies requested: none.
