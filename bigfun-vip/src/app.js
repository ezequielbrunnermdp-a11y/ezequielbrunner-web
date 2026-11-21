/* BIG FUN – Control de consumos VIP: pantalla y guardado. */
(function () {
  "use strict";

  var CFG = window.BIGFUN_CONFIG;
  var Core = window.BigFunCore;
  var Catalog = window.BigFunCatalog;
  var money = Core.formatMoney;

  var KEY = "bigfun-vip:v1:" + CFG.clientId;
  var KEY_PREV = KEY + ":anterior";

  var $ = function (id) { return document.getElementById(id); };
  var state = null;
  var storageOk = true;

  /* ---------------- Guardado ---------------- */

  function readKey(k) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? Core.parseBackup(raw, CFG.clientId) : null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    var s = readKey(KEY) || readKey(KEY_PREV);
    if (s) return s;
    s = Core.createState(CFG);
    save(s);
    return s;
  }

  /* Guarda y verifica releyendo. Conserva también la versión anterior por seguridad. */
  function save(s) {
    try {
      var raw = JSON.stringify(s);
      var current = localStorage.getItem(KEY);
      if (current) localStorage.setItem(KEY_PREV, current);
      localStorage.setItem(KEY, raw);
      storageOk = localStorage.getItem(KEY) === raw;
    } catch (e) {
      storageOk = false;
    }
    $("storageWarning").hidden = storageOk;
    return storageOk;
  }

  /* Aplica una operación de Core y la guarda antes de mostrarla. */
  function commit(result) {
    if (!result.ok) return result;
    var previous = state;
    state = result.state;
    if (!save(state)) {
      state = previous;
      save(state);
      return { ok: false, error: "NO_GUARDADO" };
    }
    render();
    return result;
  }

  /* ---------------- Pantalla principal ---------------- */

  var cardEls = {};
  var rendered = false;

  function buildCatalog() {
    var cats = $("cats");
    var main = $("catalog");
    Catalog.CATEGORIES.forEach(function (cat) {
      var items = Catalog.PRODUCTS.filter(function (p) { return p.category === cat.id; });
      if (!items.length) return;

      var chip = document.createElement("a");
      chip.href = "#cat-" + cat.id;
      chip.textContent = cat.name;
      cats.appendChild(chip);

      var section = document.createElement("section");
      section.className = "cat";
      section.id = "cat-" + cat.id;
      var h = document.createElement("h2");
      h.className = "cat__title";
      h.textContent = cat.name;
      section.appendChild(h);

      var grid = document.createElement("div");
      grid.className = "grid";
      items.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "card";
        b.setAttribute("data-id", p.id);
        b.innerHTML =
          '<img class="card__img" loading="lazy" decoding="async" width="400" height="400" alt="">' +
          '<span class="card__tag" hidden>SALDO INSUFICIENTE</span>' +
          '<span class="card__body"><span class="card__name"></span><span class="card__price"></span></span>';
        var img = b.querySelector("img");
        img.src = p.image;
        img.alt = p.name;
        b.querySelector(".card__name").textContent = p.name;
        b.querySelector(".card__price").textContent = money(p.price);
        b.addEventListener("click", function () { onCard(p); });
        grid.appendChild(b);
        cardEls[p.id] = b;
      });
      section.appendChild(grid);
      main.appendChild(section);
    });
  }

  function render() {
    var bal = Core.balance(state);
    var used = Core.consumed(state);
    var low = bal > 0 && bal <= CFG.lowBalance;
    var empty = bal <= 0;

    var balEl = $("balance");
    if (rendered && balEl.textContent !== money(bal)) {
      balEl.classList.remove("pulse");
      void balEl.offsetWidth;
      balEl.classList.add("pulse");
    }
    balEl.textContent = money(bal);
    $("consumed").textContent = money(used);
    $("miniBalance").textContent = money(bal);

    ["panel", "mini"].forEach(function (id) {
      $(id).classList.toggle("is-low", low);
      $(id).classList.toggle("is-empty", empty);
    });
    var alert = $("alert");
    alert.hidden = !(low || empty);
    alert.textContent = empty ? "CRÉDITO AGOTADO" : "SALDO BAJO";

    Catalog.PRODUCTS.forEach(function (p) {
      var el = cardEls[p.id];
      var blocked = p.price > bal;
      el.classList.toggle("is-blocked", blocked);
      el.querySelector(".card__tag").hidden = !blocked;
      el.querySelector(".card__tag").textContent = empty ? "CRÉDITO AGOTADO" : "SALDO INSUFICIENTE";
      el.disabled = empty;
      el.setAttribute("aria-label", p.name + ", " + money(p.price) + (blocked ? ", saldo insuficiente" : ""));
    });

    if (!$("history").hidden) renderHistory();
    rendered = true;
  }

  /* ---------------- Confirmación de consumo ---------------- */

  var pending = null;   // { product, qty }
  var busy = false;     // evita registros duplicados
  var quietUntil = 0;   // ignora toques fantasma justo después de cerrar un diálogo

  function onCard(p) {
    if (busy || Date.now() < quietUntil || !$("confirm").hidden) return;
    var bal = Core.balance(state);
    if (bal <= 0) return toast("Crédito agotado", true);
    if (p.price > bal) return toast("Saldo insuficiente · " + p.name + " " + money(p.price), true);
    pending = { product: p, qty: 1 };
    $("cImg").src = p.image;
    $("cImg").alt = p.name;
    $("cName").textContent = p.name;
    $("cPrice").textContent = money(p.price);
    renderConfirm();
    openOverlay("confirm");
  }

  function renderConfirm() {
    var p = pending.product;
    var bal = Core.balance(state);
    var total = p.price * pending.qty;
    var fits = total <= bal;
    $("qtyVal").textContent = pending.qty;
    $("cTotal").textContent = money(total);
    $("cAfter").textContent = fits ? "Saldo después: " + money(bal - total) : "Saldo disponible: " + money(bal);
    $("cError").hidden = fits;
    $("cQuestion").hidden = !fits;
    $("cOk").disabled = !fits || busy;
    $("qtyMinus").disabled = pending.qty <= 1;
    $("qtyPlus").disabled = pending.qty >= Core.MAX_QTY || p.price * (pending.qty + 1) > bal;
  }

  function changeQty(d) {
    if (!pending || busy) return;
    pending.qty = Math.max(1, Math.min(Core.MAX_QTY, pending.qty + d));
    renderConfirm();
  }

  function confirmConsumption() {
    if (!pending || busy) return;
    busy = true;
    $("cOk").disabled = true;
    var p = pending.product;
    var qty = pending.qty;
    var r = commit(Core.addConsumption(state, p, qty));
    pending = null;
    closeOverlay("confirm");
    if (r.ok) {
      toast("Consumo registrado · " + (qty > 1 ? qty + " × " : "") + p.name + " · Saldo " + money(Core.balance(state)));
      if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    } else {
      toast(errorText(r.error), true);
    }
    setTimeout(function () { busy = false; }, 350);
  }

  function errorText(code) {
    return {
      SALDO_INSUFICIENTE: "Saldo insuficiente",
      SIN_SALDO: "Crédito agotado",
      CANTIDAD_INVALIDA: "Cantidad inválida",
      PRECIO_INVALIDO: "Precio inválido",
      NO_GUARDADO: "No se pudo guardar. No se registró el consumo.",
      YA_ANULADO: "Ese consumo ya estaba anulado",
      PERIODO_CERRADO: "No se puede anular: pertenece a un crédito anterior",
      NO_ENCONTRADO: "Consumo no encontrado"
    }[code] || "No se pudo completar";
  }

  /* ---------------- Historial ---------------- */

  function renderHistory() {
    var list = $("hList");
    list.innerHTML = "";
    var movs = state.movements;
    if (!movs.length) {
      var li0 = document.createElement("li");
      li0.className = "hist__empty";
      li0.textContent = "Todavía no hay consumos.";
      list.appendChild(li0);
    }
    movs.forEach(function (m) {
      var li = document.createElement("li");
      if (m.type === "reinicio") {
        li.className = "is-reset";
        li.textContent = "— Crédito reiniciado " + Core.localDate(m.at) + " " + Core.localTime(m.at) +
          " · saldo previo " + money(m.balanceBefore) + " —";
        list.appendChild(li);
        return;
      }
      var main = document.createElement("div");
      main.className = "hist__main";
      var line = document.createElement("div");
      line.className = "hist__line";
      var sub = document.createElement("div");
      sub.className = "hist__sub";
      var name = (m.qty > 1 ? m.qty + " × " : "") + m.name;

      if (m.type === "consumo") {
        line.textContent = Core.localTime(m.at) + " – " + name + " – " + money(m.amount);
        sub.textContent = m.qty > 1 ? m.qty + " × " + money(m.unitPrice) : Core.localDate(m.at);
        if (m.voidedAt) {
          li.className = "is-void";
          sub.textContent = "ANULADO a las " + Core.localTime(m.voidedAt);
        }
      } else {
        li.className = "is-void-entry";
        line.textContent = Core.localTime(m.at) + " – Anulación: " + name + " – +" + money(m.amount);
        sub.textContent = "Se devolvió el importe al saldo";
      }
      main.appendChild(line);
      main.appendChild(sub);
      li.appendChild(main);

      if (m.type === "consumo" && !m.voidedAt && m.period === state.period) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn--danger";
        b.textContent = "Anular";
        b.addEventListener("click", function () { askVoid(m); });
        li.appendChild(b);
      }
      list.appendChild(li);
    });
    $("hConsumed").textContent = money(Core.consumed(state));
    $("hBalance").textContent = money(Core.balance(state));
  }

  function askVoid(m) {
    ask("¿Anular consumo?",
      Core.localTime(m.at) + " – " + (m.qty > 1 ? m.qty + " × " : "") + m.name + " – " + money(m.amount) +
      ". Se devolverá el importe al saldo y quedará registrado como anulado.",
      "ANULAR").then(function (yes) {
      if (!yes) return;
      var r = commit(Core.voidConsumption(state, m.id));
      toast(r.ok ? "Consumo anulado · Saldo " + money(Core.balance(state)) : errorText(r.error), !r.ok);
    });
  }

  function askReset() {
    ask("Reiniciar crédito",
      "El saldo volverá a " + money(state.initialCredit) + ". El historial actual se conserva como ciclo cerrado.",
      "CONTINUAR").then(function (yes) {
      if (!yes) return;
      return ask("¿Confirmás el reinicio?",
        "Segunda confirmación. Saldo actual: " + money(Core.balance(state)) + " → nuevo saldo: " + money(state.initialCredit) + ".",
        "SÍ, REINICIAR").then(function (yes2) {
        if (!yes2) return;
        var r = commit(Core.resetCredit(state));
        toast(r.ok ? "Crédito reiniciado: " + money(Core.balance(state)) : errorText(r.error), !r.ok);
      });
    });
  }

  /* ---------------- Exportar / importar ---------------- */

  function stamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  function exportCsv() {
    download("bigfun-" + CFG.clientId + "-consumos-" + stamp() + ".csv", "text/csv;charset=utf-8", Core.toCSV(state));
    toast("CSV generado");
  }

  function exportJson() {
    var backup = {
      schema: Core.SCHEMA + "-backup",
      exportedAt: new Date().toISOString(),
      balance: Core.balance(state),
      consumed: Core.consumed(state),
      state: state
    };
    download("bigfun-" + CFG.clientId + "-respaldo-" + stamp() + ".json", "application/json", JSON.stringify(backup, null, 2));
    toast("Respaldo JSON generado");
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var s;
      try {
        s = Core.parseBackup(String(reader.result), CFG.clientId);
      } catch (e) {
        return toast(e.message, true);
      }
      ask("¿Importar respaldo?",
        "Reemplaza los datos de este teléfono. Respaldo: saldo " + money(Core.balance(s)) + ", " +
        Core.currentConsumptions(s).length + " consumos. Actual: saldo " + money(Core.balance(state)) + ".",
        "IMPORTAR").then(function (yes) {
        if (!yes) return;
        var r = commit({ ok: true, state: s });
        toast(r.ok ? "Respaldo importado · Saldo " + money(Core.balance(state)) : errorText(r.error), !r.ok);
      });
    };
    reader.onerror = function () { toast("No se pudo leer el archivo", true); };
    reader.readAsText(file);
  }

  /* ---------------- Diálogos y avisos ---------------- */

  var openCount = 0;
  function openOverlay(id) {
    $(id).hidden = false;
    openCount++;
    document.body.classList.add("locked");
  }
  function closeOverlay(id) {
    if ($(id).hidden) return;
    $(id).hidden = true;
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.classList.remove("locked");
    quietUntil = Date.now() + 350;
  }

  var askResolve = null;
  function ask(title, text, okLabel) {
    $("aTitle").textContent = title;
    $("aText").textContent = text;
    $("aOk").textContent = okLabel || "CONFIRMAR";
    openOverlay("ask");
    return new Promise(function (resolve) { askResolve = resolve; });
  }
  function answer(v) {
    if (!askResolve) return;
    var r = askResolve;
    askResolve = null;
    closeOverlay("ask");
    r(v);
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.toggle("is-error", !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 2600 : 1800);
  }

  /* ---------------- Inicio ---------------- */

  function init() {
    document.querySelectorAll("[data-client-name]").forEach(function (el) { el.textContent = CFG.clientName; });
    buildCatalog();
    state = load();
    render();

    $("cCancel").addEventListener("click", function () { pending = null; closeOverlay("confirm"); });
    $("cOk").addEventListener("click", confirmConsumption);
    $("qtyMinus").addEventListener("click", function () { changeQty(-1); });
    $("qtyPlus").addEventListener("click", function () { changeQty(1); });
    $("confirm").addEventListener("click", function (e) {
      if (e.target === this && !busy) { pending = null; closeOverlay("confirm"); }
    });

    $("openHistory").addEventListener("click", function () { renderHistory(); openOverlay("history"); });
    $("closeHistory").addEventListener("click", function () { closeOverlay("history"); });
    $("exportCsv").addEventListener("click", exportCsv);
    $("exportJson").addEventListener("click", exportJson);
    $("importJson").addEventListener("change", function () {
      if (this.files && this.files[0]) importJson(this.files[0]);
      this.value = "";
    });
    $("resetCredit").addEventListener("click", askReset);

    $("aCancel").addEventListener("click", function () { answer(false); });
    $("aOk").addEventListener("click", function () { answer(true); });

    // Otra pestaña del mismo teléfono modificó los datos: recargar.
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY || !e.newValue) return;
      try { state = Core.parseBackup(e.newValue, CFG.clientId); render(); } catch (err) {}
    });
    // Al volver a la página (bloqueo, cambio de app) se relee lo guardado.
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        var s = readKey(KEY);
        if (s && s.updatedAt !== state.updatedAt) { state = s; render(); }
      }
    });

    // Barra compacta con el saldo al bajar por el catálogo.
    var mini = $("mini");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        mini.classList.toggle("show", !entries[0].isIntersecting);
      }).observe($("panel"));
    }

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  init();
})();
