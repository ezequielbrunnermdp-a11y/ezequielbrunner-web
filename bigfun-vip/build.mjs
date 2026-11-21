// BIG FUN – build sin dependencias.
// Copia src/ a dist/ y genera la configuración del cliente a partir de variables de entorno:
//   VIP_CLIENT_ID       identificador único (ej.: cliente1). Define la clave de guardado.
//   VIP_CLIENT_NAME     texto visible (ej.: CLIENTE VIP 1).
//   VIP_INITIAL_CREDIT  crédito inicial en pesos enteros (por defecto 300000).
//   VIP_LOW_BALANCE     umbral de "saldo bajo" en pesos enteros (por defecto 50000).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");
const outName = process.env.VIP_OUT_DIR || "dist";

function fail(msg) {
  console.error("\n[build] ERROR: " + msg + "\n");
  process.exit(1);
}
if (!/^dist(-[a-z0-9-]+)?$/.test(outName)) fail("VIP_OUT_DIR debe llamarse dist o dist-algo.");
const out = join(here, outName);

function int(name, def) {
  const raw = (process.env[name] ?? "").trim();
  if (raw === "") return def;
  if (!/^\d+$/.test(raw)) fail(`${name} debe ser un número entero sin puntos ni signos (recibido: "${raw}")`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) fail(`${name} fuera de rango`);
  return n;
}

const clientId = (process.env.VIP_CLIENT_ID || "").trim();
if (!clientId) fail("Falta la variable VIP_CLIENT_ID (ej.: cliente1).");
if (!/^[a-z0-9-]{1,40}$/.test(clientId)) fail("VIP_CLIENT_ID solo admite minúsculas, números y guiones.");
const clientName = (process.env.VIP_CLIENT_NAME || "").trim() || clientId.toUpperCase();
const config = {
  clientId,
  clientName,
  initialCredit: int("VIP_INITIAL_CREDIT", 300000),
  lowBalance: int("VIP_LOW_BALANCE", 50000),
};

// Huella del contenido + configuración: invalida la caché cuando algo cambia.
const hash = createHash("sha256");
(function walk(dir) {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else hash.update(f).update(readFileSync(p));
  }
})(src);
hash.update(JSON.stringify(config));
const buildId = hash.digest("hex").slice(0, 10);
config.buildId = buildId;

// Limpia solo la carpeta de salida propia (dist o dist-*) dentro de este proyecto.
if (existsSync(out) && dirname(out) === here && basename(out).startsWith("dist")) {
  rmSync(out, { recursive: true });
}
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
for (const f of ["index.html", "sw.js"]) {
  const p = join(out, f);
  writeFileSync(p, readFileSync(p, "utf8")
    .replaceAll("%%CLIENT_NAME%%", esc(clientName))
    .replaceAll("%%BUILD_ID%%", buildId));
}

writeFileSync(join(out, "config.js"),
  "/* Generado por build.mjs: no editar. */\nwindow.BIGFUN_CONFIG = Object.freeze(" + JSON.stringify(config, null, 2) + ");\n");

writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify({
  name: `BIG FUN · ${clientName}`,
  short_name: `BIG FUN ${clientName.replace(/^CLIENTE\s+/i, "")}`.slice(0, 20),
  description: "Control de consumos VIP",
  lang: "es-AR",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0b0b0c",
  theme_color: "#0b0b0c",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));

console.log(`[build] ${clientName} (${clientId}) · crédito $${config.initialCredit.toLocaleString("es-AR")} · build ${buildId} → ${outName}/`);
