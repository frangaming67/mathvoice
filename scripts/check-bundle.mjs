import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import process from 'node:process';
import console from 'node:console';

// These budgets detect growth, not runtime speed or assistive-technology performance.
const files = await readdir('dist/assets');
let total = 0;
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const contents = await readFile(join('dist/assets', file));
  total += contents.length;
  if (/^index-/.test(file) && gzipSync(contents).length > 320 * 1024)
    throw new Error(`El paquete inicial ${file} supera 320 KiB comprimidos.`);
}
if (total > 3.5 * 1024 * 1024) throw new Error('El JavaScript de producción supera 3.5 MiB.');
console.log(
  `Presupuesto aprobado: ${(total / 1024).toFixed(0)} KiB de JavaScript en total; entrada menor a 320 KiB gzip.`,
);
process.exitCode = 0;
