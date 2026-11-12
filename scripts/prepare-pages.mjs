// Copies the Expo web export (dist) into deploy-dist for GitHub Pages.
import { cp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'dist');
const output = join(root, 'deploy-dist');

await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
await writeFile(join(output, '.nojekyll'), '');

console.log('Prepared GitHub Pages output in deploy-dist.');
