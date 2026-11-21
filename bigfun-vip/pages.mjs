// Genera la versión para GitHub Pages (alternativa gratuita a Netlify):
//   ../docs/cliente1/  y  ../docs/cliente2/
// GitHub Pages publica la carpeta docs/ del repositorio en
//   https://<usuario>.github.io/<repositorio>/cliente1/   (y /cliente2/)
// Los dos clientes comparten dominio, pero cada uno guarda en su propia clave
// (bigfun-vip:v1:cliente1 / cliente2), así que saldos e historiales siguen separados.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const clients = [
  { id: "cliente1", name: "CLIENTE VIP 1" },
  { id: "cliente2", name: "CLIENTE VIP 2" },
];

mkdirSync(docs, { recursive: true });
writeFileSync(join(docs, ".nojekyll"), "");
for (const c of clients) {
  const outName = "dist-pages-" + c.id;
  execFileSync("node", ["build.mjs"], {
    cwd: here, stdio: "inherit",
    env: { ...process.env, VIP_CLIENT_ID: c.id, VIP_CLIENT_NAME: c.name, VIP_INITIAL_CREDIT: "300000", VIP_OUT_DIR: outName },
  });
  const target = join(docs, c.id);
  if (existsSync(target) && dirname(target) === docs && basename(target) === c.id) rmSync(target, { recursive: true });
  cpSync(join(here, outName), target, { recursive: true });
  console.log(`[pages] docs/${c.id}/ listo`);
}
