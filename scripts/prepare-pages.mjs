import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'dist');
const outputRoot = join(projectRoot, 'deploy-dist');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const directory of ['_expo', 'assets']) {
  await cp(join(sourceRoot, directory), join(outputRoot, directory), { recursive: true });
}

for (const file of [
  'index.html',
  'metadata.json',
  'conflictvol-logo-white.png',
  'conflictvol-logo.png',
  'conflictvol-logo.svg',
  'conflictvol-signal-map.png',
]) {
  await cp(join(sourceRoot, file), join(outputRoot, file));
}

console.log('Prepared clean GitHub Pages output in deploy-dist.');
