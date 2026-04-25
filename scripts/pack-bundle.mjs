#!/usr/bin/env node
// Assembles a portable Windows-friendly bundle from the built artifacts.
// Output: dist-bundle/openclaw/  (and openclaw-windows-x64.zip if `zip` is on PATH).
//
// Prereqs: `npm run build` has produced backend/dist and frontend/dist.

import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const out = join(repo, 'dist-bundle');
const bundle = join(out, 'openclaw');
const app = join(bundle, 'app');

console.log('==> wiping', out);
rmSync(out, { recursive: true, force: true });
mkdirSync(app, { recursive: true });

const requiredBuilds = [
  ['backend/dist', 'run `npm run build -w backend` first'],
  ['frontend/dist', 'run `npm run build -w frontend` first'],
];
for (const [p, hint] of requiredBuilds) {
  if (!existsSync(join(repo, p))) {
    console.error(`missing ${p} — ${hint}`);
    process.exit(1);
  }
}

console.log('==> copying backend/dist → app/');
cpSync(join(repo, 'backend', 'dist'), app, { recursive: true });

console.log('==> copying frontend/dist → app/public/');
cpSync(join(repo, 'frontend', 'dist'), join(app, 'public'), { recursive: true });

console.log('==> copying bundle/* → openclaw/');
for (const f of ['start.bat', 'stop.bat', 'README.txt']) {
  cpSync(join(repo, 'bundle', f), join(bundle, f));
}

const backendPkg = JSON.parse(
  execSync('node -e "console.log(require(\'fs\').readFileSync(\'backend/package.json\',\'utf8\'))"', {
    cwd: repo,
  }).toString(),
);

const prodPkg = {
  name: 'openclaw-app',
  version: backendPkg.version,
  private: true,
  type: 'module',
  main: 'index.js',
  dependencies: backendPkg.dependencies,
  engines: backendPkg.engines,
};
writeFileSync(join(app, 'package.json'), JSON.stringify(prodPkg, null, 2));

console.log('==> installing production deps in app/');
execSync('npm install --omit=dev --omit=optional --no-audit --no-fund --silent', {
  cwd: app,
  stdio: 'inherit',
});

const sizeMb = (path) => {
  let total = 0;
  const walk = (p) => {
    const s = statSync(p);
    if (s.isDirectory()) {
      for (const e of execSync(`ls -A "${p}"`).toString().split('\n').filter(Boolean)) {
        walk(join(p, e));
      }
    } else total += s.size;
  };
  walk(path);
  return (total / 1024 / 1024).toFixed(1);
};

console.log(`==> bundle ready at ${bundle} (${sizeMb(bundle)} MB)`);

if (process.env.SKIP_ZIP !== '1') {
  const zipPath = join(out, 'openclaw-windows-x64.zip');
  try {
    execSync(`cd "${out}" && zip -rq openclaw-windows-x64.zip openclaw`, { stdio: 'inherit' });
    console.log(`==> wrote ${zipPath} (${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB)`);
  } catch {
    console.log('==> skipping zip (no `zip` on PATH); CI handles archiving');
  }
}
