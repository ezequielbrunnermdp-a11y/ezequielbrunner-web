// Genera los paquetes de entrega en ./entrega:
//  - campus-el-condor-publicar.zip : contenido de dist/ con index.html en la raíz (para Cloudflare Pages)
//  - campus-el-condor-codigo-fuente.zip : código fuente sin node_modules ni dist
// Requiere el comando `zip` del sistema. Ejecutar después de `npm run build`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const out = join(root, 'entrega');
if (!existsSync(join(dist, 'index.html'))) { console.error('Falta dist/index.html: ejecutá primero npm run build.'); process.exit(1); }
mkdirSync(out, { recursive: true });

// Cloudflare Pages: 25 MiB por archivo.
const LIMIT = 25 * 1024 * 1024;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(dist);
const big = files.filter((f) => statSync(f).size > LIMIT);
if (big.length) { console.error('Archivos que superan 25 MiB (no se pueden publicar en Pages):\n' + big.join('\n')); process.exit(1); }

const pub = join(out, 'campus-el-condor-publicar.zip');
const src = join(out, 'campus-el-condor-codigo-fuente.zip');
rmSync(pub, { force: true }); rmSync(src, { force: true });
execFileSync('zip', ['-r', '-q', '-X', pub, '.'], { cwd: dist });
execFileSync('zip', ['-r', '-q', '-X', src, '.', '-x', 'node_modules/*', 'dist/*', 'entrega/*', '*.log'], { cwd: root });
console.log(`${files.length} archivos compilados verificados (ninguno supera 25 MiB).`);
console.log(`Listo:\n  ${pub}\n  ${src}`);
