import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function build(mode: string, extra: string[]): string[] {
  const out = mkdtempSync(join(tmpdir(), `sow-${mode}-`));
  try {
    execFileSync('npx', ['vite', 'build', '--mode', mode, '--outDir', out, '--emptyOutDir', ...extra], { stdio: 'pipe' });
    const files = readdirSync(out, { recursive: true }).map(String);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    return [...files, html.includes('registerSW') || html.includes('serviceWorker') ? 'HTML_REGISTERS_SW' : ''];
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
const swFile = /(^|\/)(sw\.js|registerSW\.js|workbox-[^/]*\.js)$/;

describe('build output', () => {
  it('native build ships no service worker', () => {
    const files = build('native', ['--base=./']);
    expect(files.filter((f) => swFile.test(f) || f === 'HTML_REGISTERS_SW')).toEqual([]);
  }, 120_000);
  it('web build keeps its service worker', () => {
    const files = build('production', []);
    expect(files.some((f) => /(^|\/)sw\.js$/.test(f))).toBe(true);
  }, 120_000);
});
