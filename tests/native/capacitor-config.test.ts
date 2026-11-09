import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('capacitor shell config', () => {
  const cfg = read('capacitor.config.ts');
  it('uses the agreed id, name and local dist', () => {
    expect(cfg).toContain("appId: 'com.shapelegend.game'");
    expect(cfg).toContain("appName: 'Shape Legend'");
    expect(cfg).toContain("webDir: 'dist'");
  });
  it('never loads a remote url', () => {
    expect(cfg).not.toMatch(/url\s*:/);
  });
  it('build:cap uses relative base and syncs', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    expect(scripts['build:cap']).toContain('--base=./');
    expect(scripts['build:cap']).toContain('cap sync');
    expect(scripts['build']).not.toContain('--base');
  });
});

describe('android shell', () => {
  it('targets API 36 and locks landscape with no permissions', () => {
    const vars = read('android/variables.gradle');
    expect(vars).toMatch(/compileSdkVersion = 36/);
    expect(vars).toMatch(/targetSdkVersion = 36/);
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('sensorLandscape');
    expect(manifest).not.toContain('uses-permission android');
  });
});

describe('ios shell', () => {
  it('is landscape only with hidden status bar', () => {
    const plist = read('ios/App/App/Info.plist');
    expect(plist).not.toContain('UIInterfaceOrientationPortrait');
    expect(plist).toContain('UIInterfaceOrientationLandscapeLeft');
    expect(plist).toMatch(/<key>UIStatusBarHidden<\/key>\s*<true\/>/);
  });
});
