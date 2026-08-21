#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const targets = [
  join(root, 'apps/web/app/page.tsx'),
  join(root, 'apps/web/app/globals.css'),
  join(root, 'apps/web/app/layout.tsx'),
];
const findings = [];
for (const file of targets) {
  const text = await readFile(file, 'utf8');
  if (file.endsWith('globals.css')) {
    if (!text.includes(':focus-visible')) findings.push({ file, rule: 'visible-focus', message: 'A visible focus ring is required.' });
    if (!text.includes('prefers-reduced-motion')) findings.push({ file, rule: 'reduced-motion', message: 'Reduced-motion support is required.' });
    if (!text.includes('::-webkit-scrollbar')) findings.push({ file, rule: 'browser-surfaces', message: 'Scrollbar styling should be intentional.' });
    if (/text-[^;{]*gradient|background-clip:\s*text/.test(text)) findings.push({ file, rule: 'gradient-text', message: 'Gradient text is not part of WB visual language.' });
  }
  if (file.endsWith('layout.tsx') && (!text.includes('dir="rtl"') || !text.includes('lang="ar"'))) findings.push({ file, rule: 'rtl-language', message: 'Arabic RTL metadata is required.' });
}
const result = { status: findings.length ? 'failed' : 'passed', findings };
const output = join(root, 'reports/ui/impeccable-detector.json');
await mkdir(join(root, 'reports/ui'), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;
