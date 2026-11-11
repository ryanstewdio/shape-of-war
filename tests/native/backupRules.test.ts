import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const base = 'android/app/src/main/';
const read = (p: string): string => readFileSync(base + p, 'utf8');
const manifest = read('AndroidManifest.xml');
const dataRules = read('res/xml/data_extraction_rules.xml');
const fullRules = read('res/xml/backup_rules.xml');

const excluded = [
  'app_webview/Default/Service Worker',
  'app_webview/Default/Cache',
  'app_webview/Default/Code Cache',
];

describe('android backup rules', () => {
  it('keeps allowBackup true and references both rule files', () => {
    expect(manifest).toContain('android:allowBackup="true"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
  });

  it.each([
    ['data_extraction_rules cloud-backup', dataRules.split('<cloud-backup>')[1]?.split('</cloud-backup>')[0] ?? ''],
    ['data_extraction_rules device-transfer', dataRules.split('<device-transfer>')[1]?.split('</device-transfer>')[0] ?? ''],
    ['backup_rules', fullRules],
  ])('%s excludes the offline cache and keeps progress', (_n, body) => {
    for (const p of excluded) expect(body).toContain(`<exclude domain="root" path="${p}" />`);
    expect(body).toContain('<exclude domain="cache" path="." />');
    expect(body).not.toMatch(/path="app_webview\/Default\/(Local Storage|IndexedDB)/);
  });
});
