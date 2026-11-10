# HAND-OFF Shipwright: back-button
Branch: feat/shipwright-back-button. Added src/native/backButton.ts, tests/native/backButton.test.ts (7 tests), @capacitor/app 8.1.2, cap sync output in android/ and ios/.
Dependency note: @capacitor/app has no 8.6.x release (plugins version apart from core). 8.1.2 is the latest Capacitor 8 line release.
npm test: all pass except the accepted generator perf test (generation is fast, 675 ms under load; it passes alone). npm run build: pass.
Android debug build: not verified. gradlew --offline assembleDebug failed here (no SDK or cached deps in this container).
Wiring for Morpheus in src/main.ts (import { installBackButton, createDoubleBack } from './native/backButton'):
  const menuBack = createDoubleBack(() => performance.now());
  installBackButton(() => { if (inLevel) { pause(); return 'handled'; } if (!onMainMenu) { goToPreviousScreen(); return 'handled'; } if (menuBack() === 'exit') return 'exit'; showToast('Press back again to exit'); return 'handled'; });
Known gaps: handler returns exit only after the second back; the toast and screen state come from Morpheus.
