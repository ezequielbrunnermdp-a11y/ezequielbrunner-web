// Pruebas de cálculo, seguridad del saldo, anulación, reinicio, respaldo y CSV.
// Ejecutar: node tests/core.test.js
const assert = require("node:assert/strict");
const Core = require("../src/core.js");
const { PRODUCTS, CATEGORIES } = require("../src/catalog.js");

const P = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const cfg1 = { clientId: "cliente1", clientName: "CLIENTE VIP 1", initialCredit: 300000 };
const cfg2 = { clientId: "cliente2", clientName: "CLIENTE VIP 2", initialCredit: 300000 };
let n = 0;
function test(name, fn) { fn(); n++; console.log("  ✓ " + name); }
const ok = (r) => { assert.equal(r.ok, true, "esperaba ok, error: " + r.error); return r.state; };

console.log("BIG FUN · pruebas de lógica");

test("catálogo completo con precios exactos", () => {
  const expected = {
    heineken: 10000, imperial: 8000,
    fernet: 12000, campari: 12000, aperol: 12000, cinzano: 12000, gancia: 12000, cubalibre: 12000, whisky: 12000,
    jager: 20000,
    gintonic: 12000, beefeater: 19000, tanqueray: 21000, bombay: 25000, absolut: 17000, sernova: 12000, jwred: 17000, jwblack: 25000,
    chandon: 55000, baronb: 850000,
    agua: 5000, gaseosa: 5000, speed: 6000,
  };
  assert.equal(PRODUCTS.length, Object.keys(expected).length);
  for (const [id, price] of Object.entries(expected)) {
    assert.equal(P[id].price, price, id);
    assert.ok(Number.isInteger(P[id].price));
  }
  assert.equal(CATEGORIES.length, 6);
  PRODUCTS.forEach((p) => assert.ok(CATEGORIES.some((c) => c.id === p.category), p.id));
});

test("estado inicial: $300.000 disponibles, $0 consumido", () => {
  const s = Core.createState(cfg1);
  assert.equal(Core.balance(s), 300000);
  assert.equal(Core.consumed(s), 0);
  assert.equal(Core.formatMoney(Core.balance(s)), "$300.000");
  assert.equal(Core.formatMoney(0), "$0");
});

test("ejemplo del pedido: 300.000 − Heineken − Fernet = 278.000", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.heineken, 1));
  s = ok(Core.addConsumption(s, P.fernet, 1));
  assert.equal(Core.balance(s), 278000);
  assert.equal(Core.formatMoney(Core.balance(s)), "$278.000");
});

test("historial de ejemplo: Heineken + Fernet + Speed = 28.000 / saldo 272.000", () => {
  let s = Core.createState(cfg1);
  for (const id of ["heineken", "fernet", "speed"]) s = ok(Core.addConsumption(s, P[id], 1));
  assert.equal(Core.consumed(s), 28000);
  assert.equal(Core.balance(s), 272000);
  const m = s.movements[0];
  assert.deepEqual([m.name, m.unitPrice, m.qty, m.amount, m.type], ["Heineken", 10000, 1, 10000, "consumo"]);
  assert.ok(!isNaN(Date.parse(m.at)));
});

test("varias unidades: 3 × Heineken = $30.000", () => {
  let s = Core.createState(cfg1);
  const r = Core.addConsumption(s, P.heineken, 3);
  s = ok(r);
  assert.equal(r.movement.amount, 30000);
  assert.equal(r.movement.qty, 3);
  assert.equal(Core.balance(s), 270000);
});

test("cantidades inválidas se rechazan", () => {
  const s = Core.createState(cfg1);
  for (const q of [0, -1, 1.5, NaN, 100, "x"]) {
    assert.equal(Core.addConsumption(s, P.agua, q).error, "CANTIDAD_INVALIDA", String(q));
  }
});

test("operación no modifica el estado original (sin descuento hasta confirmar)", () => {
  const s = Core.createState(cfg1);
  Core.addConsumption(s, P.heineken, 1);
  assert.equal(Core.balance(s), 300000);
  assert.equal(s.movements.length, 0);
});

test("Baron B ($850.000) supera el saldo: bloqueado", () => {
  const s = Core.createState(cfg1);
  const r = Core.addConsumption(s, P.baronb, 1);
  assert.equal(r.ok, false);
  assert.equal(r.error, "SALDO_INSUFICIENTE");
  assert.equal(Core.balance(s), 300000);
});

test("nunca queda negativo; se puede llegar exacto a $0 y luego todo se bloquea", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.chandon, 5)); // 275.000
  assert.equal(Core.balance(s), 25000);
  assert.equal(Core.addConsumption(s, P.chandon, 1).error, "SALDO_INSUFICIENTE");
  assert.equal(Core.addConsumption(s, P.agua, 6).error, "SALDO_INSUFICIENTE"); // 30.000 > 25.000
  s = ok(Core.addConsumption(s, P.agua, 5)); // 25.000
  assert.equal(Core.balance(s), 0);
  for (const p of PRODUCTS) assert.equal(Core.addConsumption(s, p, 1).error, "SIN_SALDO");
});

test("muchas operaciones: cálculo entero exacto", () => {
  let s = Core.createState(cfg1);
  let expected = 300000;
  const seq = ["imperial", "speed", "agua", "gaseosa", "heineken", "imperial", "speed"];
  for (let i = 0; i < 40; i++) {
    const p = P[seq[i % seq.length]];
    const r = Core.addConsumption(s, p, 1);
    if (p.price <= expected) { s = ok(r); expected -= p.price; } else assert.equal(r.ok, false);
    assert.equal(Core.balance(s), expected);
    assert.ok(Number.isSafeInteger(Core.balance(s)) && Core.balance(s) >= 0);
  }
});

test("anular devuelve el importe, no borra el movimiento y registra la anulación", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.heineken, 2));
  s = ok(Core.addConsumption(s, P.fernet, 1));
  const id = s.movements[0].id;
  s = ok(Core.voidConsumption(s, id));
  assert.equal(Core.balance(s), 288000);
  assert.equal(Core.consumed(s), 12000);
  assert.equal(s.movements.length, 3);
  assert.ok(s.movements[0].voidedAt);
  assert.equal(s.movements[2].type, "anulacion");
  assert.equal(s.movements[2].refId, id);
  assert.equal(Core.voidConsumption(s, id).error, "YA_ANULADO");
  assert.equal(Core.voidConsumption(s, s.movements[2].id).error, "NO_ENCONTRADO");
});

test("reiniciar: vuelve a $300.000, conserva historial y no permite anular el ciclo cerrado", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.chandon, 2));
  const oldId = s.movements[0].id;
  s = ok(Core.resetCredit(s));
  assert.equal(Core.balance(s), 300000);
  assert.equal(Core.consumed(s), 0);
  assert.equal(s.movements.length, 2);
  assert.equal(s.movements[1].balanceBefore, 190000);
  assert.equal(Core.voidConsumption(s, oldId).error, "PERIODO_CERRADO");
  s = ok(Core.addConsumption(s, P.agua, 1));
  assert.equal(Core.balance(s), 295000);
});

test("ids únicos y crecientes", () => {
  let s = Core.createState(cfg1);
  for (let i = 0; i < 5; i++) s = ok(Core.addConsumption(s, P.agua, 1));
  const ids = s.movements.map((m) => m.id);
  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(ids, ["cliente1-1", "cliente1-2", "cliente1-3", "cliente1-4", "cliente1-5"]);
});

test("respaldo JSON: ida y vuelta idéntica", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.heineken, 1));
  s = ok(Core.voidConsumption(s, s.movements[0].id));
  s = ok(Core.addConsumption(s, P.bombay, 2));
  const backup = JSON.stringify({ schema: "bigfun-vip-backup", state: s });
  const back = Core.parseBackup(backup, "cliente1");
  assert.deepEqual(back, s);
  assert.equal(Core.balance(back), 250000);
  assert.deepEqual(Core.parseBackup(JSON.stringify(s), "cliente1"), s); // estado sin envoltorio
});

test("respaldo de otro cliente o dañado se rechaza", () => {
  let s2 = Core.createState(cfg2);
  s2 = ok(Core.addConsumption(s2, P.agua, 1));
  assert.throws(() => Core.parseBackup(JSON.stringify(s2), "cliente1"), /otro cliente/);
  assert.throws(() => Core.parseBackup("{no json", "cliente1"), /JSON/);
  assert.throws(() => Core.parseBackup("{}", "cliente1"), /BIG FUN/);
  const bad = JSON.parse(JSON.stringify(s2));
  bad.movements[0].amount = 1;
  assert.throws(() => Core.parseBackup(JSON.stringify(bad), "cliente2"), /Importe/);
  const neg = JSON.parse(JSON.stringify(s2));
  neg.movements[0].qty = 100; neg.movements[0].unitPrice = 5000; neg.movements[0].amount = 500000;
  assert.throws(() => Core.parseBackup(JSON.stringify(neg), "cliente2"), /negativo/);
});

test("clientes independientes", () => {
  let a = Core.createState(cfg1);
  let b = Core.createState(cfg2);
  a = ok(Core.addConsumption(a, P.chandon, 1));
  assert.equal(Core.balance(a), 245000);
  assert.equal(Core.balance(b), 300000);
  b = ok(Core.addConsumption(b, P.agua, 1));
  assert.equal(Core.balance(a), 245000);
  assert.equal(Core.balance(b), 295000);
});

test("CSV: encabezado, separador ;, saldo corrido y anulaciones visibles", () => {
  let s = Core.createState(cfg1);
  s = ok(Core.addConsumption(s, P.heineken, 1));
  s = ok(Core.addConsumption(s, P.fernet, 2));
  s = ok(Core.voidConsumption(s, s.movements[1].id));
  const csv = Core.toCSV(s);
  assert.ok(csv.startsWith("﻿Fecha;Hora;"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4);
  assert.match(lines[1], /;Consumo;Heineken;1;10000;-10000;Vigente;290000;/);
  assert.match(lines[2], /;Consumo;Fernet Branca;2;12000;-24000;Anulado [^;]+;266000;/);
  assert.match(lines[3], /;Anulación;Fernet Branca;2;12000;24000;Anulación;290000;/);
});

test("formato monetario argentino", () => {
  assert.equal(Core.formatMoney(300000), "$300.000");
  assert.equal(Core.formatMoney(850000), "$850.000");
  assert.equal(Core.formatMoney(5000), "$5.000");
  assert.equal(Core.formatMoney(1234567), "$1.234.567");
  assert.equal(Core.formatMoney(999), "$999");
  assert.equal(Core.formatMoney(-10000), "-$10.000");
});

console.log(`\n${n} pruebas OK`);
