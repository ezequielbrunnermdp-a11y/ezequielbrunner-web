// Prueba de punta a punta en Chromium (emulando un iPhone).
// Construye los dos clientes y los sirve en dos orígenes distintos, como dos sitios de Netlify.
// Ejecutar: node tests/e2e.js   (requiere Playwright instalado)
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium, devices } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SHOTS = process.env.SHOTS_DIR || "";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".json": "application/json" };

function build(id, name) {
  execFileSync("node", ["build.mjs"], { cwd: ROOT, stdio: "inherit",
    env: { ...process.env, VIP_CLIENT_ID: id, VIP_CLIENT_NAME: name, VIP_OUT_DIR: "dist-" + id } });
  return path.join(ROOT, "dist-" + id);
}
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, "127.0.0.1", () => resolve(srv));
  });
}

let n = 0;
async function step(name, fn) { await fn(); n++; console.log("  ✓ " + name); }

(async () => {
  const d1 = build("cliente1", "CLIENTE VIP 1");
  const d2 = build("cliente2", "CLIENTE VIP 2");
  const s1 = await serve(d1), s2 = await serve(d2);
  const url1 = `http://127.0.0.1:${s1.address().port}/`;
  const url2 = `http://127.0.0.1:${s2.address().port}/`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], acceptDownloads: true });
  let page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const balance = () => page.textContent("#balance");
  const consumedTxt = () => page.textContent("#consumed");
  async function buy(id, qty = 1) {
    await page.click(`.card[data-id="${id}"]`);
    await page.waitForSelector("#confirm:not([hidden])");
    for (let i = 1; i < qty; i++) await page.click("#qtyPlus");
    await page.click("#cOk");
    await page.waitForSelector("#confirm", { state: "hidden" });
    await page.waitForTimeout(400);
  }

  console.log("BIG FUN · prueba en navegador");
  await page.goto(url1);

  await step("pantalla inicial: BIG FUN, CLIENTE VIP 1, $300.000 / $0", async () => {
    assert.equal(await page.textContent(".brand"), "BIG FUN");
    assert.equal(await page.textContent(".client"), "CLIENTE VIP 1");
    assert.equal(await balance(), "$300.000");
    assert.equal(await consumedTxt(), "$0");
    assert.equal(await page.locator(".card").count(), 23);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "1-inicio.png") });
  });

  await step("todas las fotos cargan", async () => {
    const broken = await page.$$eval(".card__img", async (imgs) => {
      await Promise.all(imgs.map((i) => { i.loading = "eager"; return i.decode().catch(() => {}); }));
      return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src"));
    });
    assert.deepEqual(broken, []);
  });

  await step("confirmación: HEINEKEN · Precio $10.000 · cancelar no descuenta", async () => {
    await page.click('.card[data-id="heineken"]');
    await page.waitForSelector("#confirm:not([hidden])");
    assert.equal(await page.textContent("#cName"), "Heineken");
    assert.equal(await page.textContent("#cPrice"), "$10.000");
    assert.equal(await page.textContent("#qtyVal"), "1");
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "2-confirmar.png") });
    await page.click("#cCancel");
    await page.waitForTimeout(400);
    assert.equal(await balance(), "$300.000");
  });

  await step("Heineken + Fernet → $278.000 y aviso «Consumo registrado»", async () => {
    await buy("heineken");
    assert.match(await page.textContent("#toast"), /Consumo registrado/);
    assert.equal(await balance(), "$290.000");
    await buy("fernet");
    assert.equal(await balance(), "$278.000");
    assert.equal(await consumedTxt(), "$22.000");
  });

  await step("cantidad: 2 × Speed → $266.000", async () => {
    await buy("speed", 2);
    assert.equal(await balance(), "$266.000");
  });

  await step("toques repetidos en CONFIRMAR registran una sola vez", async () => {
    await page.click('.card[data-id="agua"]');
    await page.waitForSelector("#confirm:not([hidden])");
    await page.evaluate(() => { const b = document.getElementById("cOk"); for (let i = 0; i < 5; i++) b.click(); });
    await page.waitForTimeout(400);
    await page.click('.card[data-id="agua"]', { force: true }).catch(() => {});
    await page.waitForTimeout(100);
    if (await page.isVisible("#confirm")) await page.click("#cCancel");
    await page.waitForTimeout(400);
    assert.equal(await balance(), "$261.000");
  });

  await step("Baron B ($850.000) bloqueado con «Saldo insuficiente»", async () => {
    assert.equal(await page.isVisible('.card[data-id="baronb"] .card__tag'), true);
    await page.click('.card[data-id="baronb"]');
    await page.waitForTimeout(200);
    assert.equal(await page.isVisible("#confirm"), false);
    assert.match(await page.textContent("#toast"), /Saldo insuficiente/);
    assert.equal(await balance(), "$261.000");
  });

  await step("persistencia: recargar y abrir de nuevo conserva saldo e historial", async () => {
    await page.reload();
    assert.equal(await balance(), "$261.000");
    const p2 = await ctx.newPage();
    await page.close();
    await p2.goto(url1);
    assert.equal(await p2.textContent("#balance"), "$261.000");
    global.page2 = p2;
    page = p2;
  });
  const pg = global.page2;
  pg.on("pageerror", (e) => errors.push(e.message));

  await step("sitio 2 independiente: arranca en $300.000 y no afecta al 1", async () => {
    const q = await ctx.newPage();
    await q.goto(url2);
    assert.equal(await q.textContent(".client"), "CLIENTE VIP 2");
    assert.equal(await q.textContent("#balance"), "$300.000");
    await q.click('.card[data-id="chandon"]');
    await q.click("#cOk");
    await q.waitForTimeout(400);
    assert.equal(await q.textContent("#balance"), "$245.000");
    await pg.reload();
    assert.equal(await pg.textContent("#balance"), "$261.000");
    const keys1 = await pg.evaluate(() => Object.keys(localStorage));
    const keys2 = await q.evaluate(() => Object.keys(localStorage));
    assert.ok(keys1.every((k) => k.includes("cliente1")), keys1.join());
    assert.ok(keys2.every((k) => k.includes("cliente2")), keys2.join());
    await q.close();
  });

  await step("historial: líneas, totales y anulación registrada", async () => {
    await pg.click("#openHistory");
    const lines = await pg.$$eval(".hist__line", (els) => els.map((e) => e.textContent));
    assert.match(lines[0], /^\d\d:\d\d – Heineken – \$10\.000$/);
    assert.match(lines[1], /Fernet Branca – \$12\.000$/);
    assert.match(lines[2], /2 × Speed – \$12\.000$/);
    assert.equal(lines.length, 4);
    assert.equal(await pg.textContent("#hConsumed"), "$39.000");
    assert.equal(await pg.textContent("#hBalance"), "$261.000");
    // anular Fernet
    await pg.locator(".hist__list li").nth(1).locator("button").click();
    await pg.waitForSelector("#ask:not([hidden])");
    await pg.click("#aOk");
    await pg.waitForTimeout(300);
    assert.equal(await pg.textContent("#hBalance"), "$273.000");
    assert.equal(await pg.locator(".hist__list li.is-void").count(), 1);
    assert.equal(await pg.locator(".hist__list li.is-void-entry").count(), 1);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, "3-historial.png") });
  });

  let jsonPath;
  await step("exportar CSV y respaldo JSON", async () => {
    const [csvDl] = await Promise.all([pg.waitForEvent("download"), pg.click("#exportCsv")]);
    const csv = fs.readFileSync(await csvDl.path(), "utf8");
    assert.match(csvDl.suggestedFilename(), /^bigfun-cliente1-consumos-.*\.csv$/);
    assert.match(csv, /Fernet Branca;1;12000;-12000;Anulado/);
    const [jsDl] = await Promise.all([pg.waitForEvent("download"), pg.click("#exportJson")]);
    jsonPath = await jsDl.path();
    const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert.equal(j.balance, 273000);
  });

  await step("reiniciar crédito con doble confirmación", async () => {
    await pg.click("#resetCredit");
    await pg.click("#aCancel");                // primera: cancelar
    await pg.waitForTimeout(200);
    assert.equal(await pg.textContent("#hBalance"), "$273.000");
    await pg.click("#resetCredit");
    await pg.click("#aOk");                    // primera confirmación
    await pg.waitForTimeout(100);
    assert.match(await pg.textContent("#aTitle"), /Confirmás/);
    await pg.click("#aOk");                    // segunda confirmación
    await pg.waitForTimeout(300);
    assert.equal(await pg.textContent("#hBalance"), "$300.000");
    assert.equal(await pg.locator(".hist__list li.is-reset").count(), 1);
  });

  await step("importar respaldo JSON restaura el saldo", async () => {
    await pg.setInputFiles("#importJson", jsonPath);
    await pg.waitForSelector("#ask:not([hidden])");
    await pg.click("#aOk");
    await pg.waitForTimeout(300);
    assert.equal(await pg.textContent("#hBalance"), "$273.000");
    await pg.click("#closeHistory");
  });

  await step("respaldo de otro cliente rechazado en el sitio 2", async () => {
    const q = await ctx.newPage();
    await q.goto(url2);
    await q.click("#openHistory");
    await q.setInputFiles("#importJson", jsonPath);
    await q.waitForTimeout(300);
    assert.match(await q.textContent("#toast"), /otro cliente/);
    assert.equal(await q.textContent("#hBalance"), "$245.000");
    await q.close();
  });

  await step("saldo bajo destacado y saldo $0 deshabilita todo", async () => {
    // 273.000 → 4 Chandon (220.000) → 53.000
    await buy("chandon", 4);
    assert.equal(await pg.textContent("#balance"), "$53.000");
    assert.equal(await pg.isVisible("#alert"), false);
    await buy("imperial");                               // 45.000 → saldo bajo
    assert.equal(await pg.textContent("#balance"), "$45.000");
    assert.equal(await pg.textContent("#alert"), "SALDO BAJO");
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, "4-saldo-bajo.png") });
    // 45.000 = 9 aguas
    await pg.click('.card[data-id="agua"]');
    for (let i = 1; i < 12; i++) await pg.click("#qtyPlus", { force: true });
    assert.equal(await pg.textContent("#qtyVal"), "9");   // tope por saldo
    await pg.click("#cOk");
    await pg.waitForTimeout(400);
    assert.equal(await pg.textContent("#balance"), "$0");
    assert.equal(await pg.textContent("#alert"), "CRÉDITO AGOTADO");
    assert.equal(await pg.locator(".card:not([disabled])").count(), 0);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, "5-agotado.png"), fullPage: false });
    await pg.reload();
    assert.equal(await pg.textContent("#balance"), "$0");
  });

  await step("sin errores de JavaScript", async () => assert.deepEqual(errors, []));

  await browser.close();
  s1.close(); s2.close();
  console.log(`\n${n} pasos OK`);
})().catch((e) => { console.error(e); process.exit(1); });
