/* BIG FUN – Lógica de crédito (sin acceso a la pantalla ni al almacenamiento).
 * Todos los importes son pesos enteros: nunca se usan decimales. */
(function (root) {
  "use strict";

  var SCHEMA = "bigfun-vip";
  var VERSION = 1;
  var MAX_QTY = 99;

  function isMoney(n) {
    return typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  }

  function createState(config, now) {
    if (!isMoney(config.initialCredit) || config.initialCredit <= 0) {
      throw new Error("Crédito inicial inválido");
    }
    var ts = (now || new Date()).toISOString();
    return {
      schema: SCHEMA,
      version: VERSION,
      clientId: config.clientId,
      clientName: config.clientName,
      initialCredit: config.initialCredit,
      period: 1,
      seq: 0,
      createdAt: ts,
      updatedAt: ts,
      movements: []
    };
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function currentConsumptions(state) {
    return state.movements.filter(function (m) {
      return m.type === "consumo" && m.period === state.period;
    });
  }

  function consumed(state) {
    return currentConsumptions(state).reduce(function (sum, m) {
      return m.voidedAt ? sum : sum + m.amount;
    }, 0);
  }

  function balance(state) {
    return state.initialCredit - consumed(state);
  }

  function nextId(s) {
    s.seq += 1;
    return s.clientId + "-" + s.seq;
  }

  /* Registra un consumo. Devuelve { ok, state, movement } o { ok:false, error }.
   * Nunca deja el saldo negativo. */
  function addConsumption(state, product, qty, now) {
    qty = Number(qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, error: "CANTIDAD_INVALIDA" };
    if (!product || !isMoney(product.price) || product.price <= 0) return { ok: false, error: "PRECIO_INVALIDO" };
    var amount = product.price * qty;
    if (!Number.isSafeInteger(amount)) return { ok: false, error: "PRECIO_INVALIDO" };
    var available = balance(state);
    if (available <= 0) return { ok: false, error: "SIN_SALDO" };
    if (amount > available) return { ok: false, error: "SALDO_INSUFICIENTE" };

    var s = clone(state);
    var ts = (now || new Date()).toISOString();
    var mov = {
      id: nextId(s),
      type: "consumo",
      period: s.period,
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      qty: qty,
      amount: amount,
      at: ts,
      voidedAt: null,
      voidId: null
    };
    s.movements.push(mov);
    s.updatedAt = ts;
    return { ok: true, state: s, movement: mov };
  }

  /* Anula un consumo del período actual. El consumo queda marcado y se agrega
   * un movimiento de anulación: nada se borra. */
  function voidConsumption(state, consumptionId, now) {
    var target = null;
    state.movements.forEach(function (m) {
      if (m.id === consumptionId) target = m;
    });
    if (!target || target.type !== "consumo") return { ok: false, error: "NO_ENCONTRADO" };
    if (target.period !== state.period) return { ok: false, error: "PERIODO_CERRADO" };
    if (target.voidedAt) return { ok: false, error: "YA_ANULADO" };

    var s = clone(state);
    var ts = (now || new Date()).toISOString();
    var t = s.movements.filter(function (m) { return m.id === consumptionId; })[0];
    var mov = {
      id: nextId(s),
      type: "anulacion",
      period: s.period,
      refId: t.id,
      productId: t.productId,
      name: t.name,
      unitPrice: t.unitPrice,
      qty: t.qty,
      amount: t.amount,
      at: ts
    };
    t.voidedAt = ts;
    t.voidId = mov.id;
    s.movements.push(mov);
    s.updatedAt = ts;
    return { ok: true, state: s, movement: mov };
  }

  /* Reinicia el crédito: el historial anterior se conserva y queda cerrado. */
  function resetCredit(state, now) {
    var s = clone(state);
    var ts = (now || new Date()).toISOString();
    var mov = {
      id: nextId(s),
      type: "reinicio",
      period: s.period + 1,
      closedPeriod: s.period,
      consumedBefore: consumed(state),
      balanceBefore: balance(state),
      at: ts
    };
    s.period += 1;
    s.movements.push(mov);
    s.updatedAt = ts;
    return { ok: true, state: s, movement: mov };
  }

  /* Valida un respaldo JSON (texto u objeto) antes de importarlo. */
  function parseBackup(input, expectedClientId) {
    var obj = input;
    if (typeof input === "string") {
      try { obj = JSON.parse(input); } catch (e) { throw new Error("El archivo no es un JSON válido."); }
    }
    if (obj && obj.state && obj.schema === SCHEMA + "-backup") obj = obj.state;
    if (!obj || obj.schema !== SCHEMA) throw new Error("El archivo no es un respaldo de BIG FUN.");
    if (obj.version !== VERSION) throw new Error("Versión de respaldo no compatible.");
    if (expectedClientId && obj.clientId !== expectedClientId) {
      throw new Error("Este respaldo pertenece a otro cliente (" + (obj.clientName || obj.clientId) + ").");
    }
    if (!isMoney(obj.initialCredit) || obj.initialCredit <= 0) throw new Error("Crédito inicial inválido en el respaldo.");
    if (!Number.isInteger(obj.period) || obj.period < 1) throw new Error("Respaldo dañado (período).");
    if (!Number.isInteger(obj.seq) || obj.seq < 0) throw new Error("Respaldo dañado (secuencia).");
    if (!Array.isArray(obj.movements)) throw new Error("Respaldo dañado (movimientos).");
    var ids = {};
    obj.movements.forEach(function (m, i) {
      var where = " (movimiento " + (i + 1) + ")";
      if (!m || typeof m.id !== "string" || ids[m.id]) throw new Error("Respaldo dañado" + where + ".");
      ids[m.id] = true;
      if (["consumo", "anulacion", "reinicio"].indexOf(m.type) < 0) throw new Error("Tipo desconocido" + where + ".");
      if (isNaN(Date.parse(m.at))) throw new Error("Fecha inválida" + where + ".");
      if (m.type !== "reinicio") {
        if (!isMoney(m.unitPrice) || !Number.isInteger(m.qty) || m.qty < 1 || m.amount !== m.unitPrice * m.qty) {
          throw new Error("Importe inválido" + where + ".");
        }
      }
    });
    var b = balance(obj);
    if (!Number.isSafeInteger(b) || b < 0) throw new Error("El respaldo deja un saldo negativo.");
    return clone(obj);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function localDate(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function localTime(iso) {
    var d = new Date(iso);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function localTimeSec(iso) {
    var d = new Date(iso);
    return localTime(iso) + ":" + pad(d.getSeconds());
  }

  /* Formato monetario argentino: $300.000 (punto como separador de miles). */
  function formatMoney(n) {
    var neg = n < 0;
    var digits = String(Math.abs(Math.trunc(n)));
    var out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-$" : "$") + out;
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* CSV con separador ";" (Excel en español). Incluye el saldo luego de cada movimiento. */
  function toCSV(state) {
    var rows = [["Fecha", "Hora", "Cliente", "Ciclo", "Movimiento", "Producto", "Cantidad", "Precio unitario", "Importe", "Estado", "Saldo luego del movimiento", "ID", "Referencia"]];
    var running = state.initialCredit;
    state.movements.forEach(function (m) {
      var importe = "", estado = "", producto = m.name || "", cant = m.qty || "", unit = m.unitPrice != null ? m.unitPrice : "";
      if (m.type === "consumo") {
        running -= m.amount;
        importe = -m.amount;
        estado = m.voidedAt ? "Anulado " + localDate(m.voidedAt) + " " + localTime(m.voidedAt) : "Vigente";
      } else if (m.type === "anulacion") {
        running += m.amount;
        importe = m.amount;
        estado = "Anulación";
      } else {
        running = state.initialCredit;
        producto = "Reinicio de crédito";
        cant = ""; unit = "";
        estado = "Saldo previo " + m.balanceBefore;
      }
      rows.push([
        localDate(m.at), localTimeSec(m.at), state.clientName, m.period,
        { consumo: "Consumo", anulacion: "Anulación", reinicio: "Reinicio" }[m.type],
        producto, cant, unit, importe, estado, running, m.id, m.refId || ""
      ]);
    });
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n") + "\r\n";
  }

  var api = {
    SCHEMA: SCHEMA, VERSION: VERSION, MAX_QTY: MAX_QTY,
    createState: createState, balance: balance, consumed: consumed,
    currentConsumptions: currentConsumptions,
    addConsumption: addConsumption, voidConsumption: voidConsumption, resetCredit: resetCredit,
    parseBackup: parseBackup, toCSV: toCSV, formatMoney: formatMoney,
    localDate: localDate, localTime: localTime
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BigFunCore = api;
})(typeof self !== "undefined" ? self : this);
