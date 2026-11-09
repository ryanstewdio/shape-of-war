# Native builds (Capacitor)

The store apps wrap the web game with Capacitor 8. The built `dist/` is bundled inside the app (no `server.url`), so the app loads no remote code. App id `com.shapelegend.game`, name "Shape Legend". The GitHub Pages build (`npm run build`, base `/shape-of-war/`) is unchanged.

## Settings

| Item | Value |
|---|---|
| Android compileSdk and targetSdk | 36 |
| Android minSdk | 24 (Capacitor 8 default; Android 7.0) |
| Android orientation | `sensorLandscape`, both landscape directions |
| Android window | Fullscreen, sticky immersive (bars hidden, edge swipe reveals), screen kept on, cutout shortEdges |
| Android permissions | None. Capacitor's template adds INTERNET, removed because the bundled app is served from the local asset loader and makes no network calls. Re-add it only if a later plugin needs it (store billing adds its own) |
| iOS deployment target | 15.0 |
| iOS orientation | Landscape left and right only, full screen required, status bar hidden |
| iOS audio session | `AVAudioSession` category `.playback` set in `AppDelegate`, so WebAudio plays with the silent switch on. Interruption and background handling is a later audio task (public plan risk 8) |
| iOS packages | Swift Package Manager (Capacitor 8 default). No CocoaPods needed |

## Prerequisites

### Any machine
- Node 22 and npm. Run `npm ci` once.

### Android (Mac, Windows or Linux)
- Android Studio (current stable) with SDK Platform 36 and Build-Tools 36 installed.
- JDK 21 (the Android Studio bundled JBR 21 works). Set `JAVA_HOME` to it.
- Set `ANDROID_HOME` to the SDK folder.
- USB debugging on the phone, or an API 36 emulator.

### iOS (Mac only)
- macOS that supports Xcode 26, and Xcode 26 or later (App Store uploads require the iOS 26 SDK).
- Xcode command line tools: `xcode-select --install`.
- An Apple ID for local runs; the Apple Developer Program for TestFlight and the store.

## Commands

All from the repo root.

```
npm ci
npm run build:cap          # typecheck, vite build --base=./, cap sync (copies dist into both projects)
```

### Android phone
```
npx cap run android        # pick the USB device; builds and installs a debug APK
npx cap open android       # or open in Android Studio and press Run
```
Debug APK without a device (shell jobs):
```
npm run build:cap
cd android && ./gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```
Install by cable: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

### iPhone
```
npx cap open ios           # opens ios/App/App.xcodeproj
```
In Xcode: select the App target, Signing and Capabilities, pick your team, choose the phone, press Run. First run on a phone needs Settings, General, VPN and Device Management, trust the developer. CLI alternative: `npx cap run ios`.

### After changing game code
Run `npm run build:cap` again; it re-syncs. Do not edit `android/app/src/main/assets/public` or `ios/App/App/public` (generated, git ignored).

## Notes
- `npm run build:cap` overwrites `dist/`. Run `npm run build` again before previewing the Pages build.
- The service worker registers inside the app and is harmless; the bundle is always local.
- Not done in this wave: icons and splash for the new name, signing and release builds, purchases, age signals.
