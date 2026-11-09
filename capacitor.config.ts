import type { CapacitorConfig } from '@capacitor/cli';

// Bundled local build only: no server.url, so the app never loads remote code.
const config: CapacitorConfig = {
  appId: 'com.shapelegend.game',
  appName: 'Shape Legend',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never', backgroundColor: '#000000' },
};

export default config;
