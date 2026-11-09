HAND-OFF shipwright: capacitor
Branch: feat/shipwright-capacitor
Dependencies (all 8.6.0, caret): @capacitor/core, @capacitor/android, @capacitor/ios; dev: @capacitor/cli. Nothing else.
Shell: capacitor.config.ts (com.shapelegend.game, "Shape Legend", webDir dist, no server.url). `npm run build:cap` = tsc, vite build --base=./, cap sync. Web `npm run build` unchanged.
Android: android/ committed. compile/target SDK 36, minSdk 24, sensorLandscape, fullscreen sticky immersive. INTERNET permission removed (not needed for bundled assets); manifest has no permissions.
Android APK: not built, no Android SDK in this environment (JDK 21 and Gradle present). Run `cd android && ./gradlew assembleDebug` on a machine with SDK 36.
iOS: ios/ generated (Swift Package Manager, no CocoaPods), landscape only, status bar hidden, AVAudioSession .playback so WebAudio ignores the silent switch. Not compiled here (needs Mac, Xcode 26).
Docs: docs/17-native-builds.md (prerequisites, exact commands). Tests: tests/native/capacitor-config.test.ts.
npm test: 4855 pass, 2 fail: generator perf (629 ms vs 500, accepted exception) and tests/qa/noAssets (see Requests). npm run build: pass (before build:cap).
Requests: allow native launcher and splash PNGs under android/ and ios/ in tests/qa/noAssets.test.ts (platform templates need them; I did not edit tests/qa); add the repo to the cloud session with push access (add_repo was not available to me); icons and splash for the new name; interruption and background audio handling later.
Known gaps: no signing or release builds; service worker still registers inside the app; the game is untested on a device.
