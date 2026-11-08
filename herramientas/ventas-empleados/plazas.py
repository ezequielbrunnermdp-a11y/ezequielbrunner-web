#!/usr/bin/env python3
"""Puerto de Palos: ranking comercial de camareros y asignación de plazas.

Uso:  python3 plazas.py datos.json salida/
Lee los datos de Morphi ya consultados (formato abajo) y escribe en salida/:
  asunto.txt, correo.html, correo.txt, resumen.json

Misma fórmula que la página (pestaña Ranking de Puerto de Palos):
  - indicadores: facturación por cubierto, ticket promedio y unidades c/100 cubiertos de
    postres, parrilladas de mariscos, degustaciones de pescados y frituras mixtas;
  - en cada indicador el mejor saca 100 y el resto en proporción; total = promedio ponderado;
  - ranking principal: al menos minCubSemana cubiertos por semana (proporcional a los días);
  - unidades cobradas = vendidas − renglones sin cargo (regalos, invitaciones).

Formato de datos.json (todas las filas salen de mcp__Morphi__ventas):
{
 "fecha": "aaaa-mm-dd",                       # día de la asignación (hoy)
 "cfg": {...} | null,                         # config/ranking-ppalos de la página, si existe
 "ventanas": {                                # "actual" (últimos N días trabajados), "anterior"
   "actual": {"desde": "aaaa-mm-dd", "hasta": "aaaa-mm-dd", "dias": 7,   # (corrida un día trabajado) y "ayer"
     "base": [[mozo, nombre, importe, tickets, cubiertos], ...],          # agrupar [mozo]
     "postres": [[mozo, unidades], ...],                                  # agrupar [mozo], filtro producto = postres
     "postres_sc": [[mozo, unidades], ...],                               # idem con renglones sin_cargo
     "estrategicos": [[mozo, producto, importe, unidades], ...],          # agrupar [mozo, producto], 248/214/019
     "estrategicos_sc": [[mozo, producto, unidades], ...]},               # idem sin_cargo
   "anterior": {...}, "ayer": {...}},
 "turnos": {"mediodia": [[mozo, cubiertos], ...],                         # agrupar [mozo] con hora del ticket
            "noche": [[mozo, cubiertos], ...]},                           # (si hay 2 rangos, pasar las filas de ambos)
 "disponibilidad": {"mediodia": {"disponibles": [mozos] | null, "manual": {plaza: [m1, m2]} | null,
                                 "confirmada": bool}, "noche": {...}} | null
}
"""
import json, sys, os, html, datetime

DEFAULT = {
    "pesos": {"ppc": 25, "tp": 15, "postres": 20, "parri": 15, "degus": 15, "frit": 10},
    "minCubSemana": 20,
    "productos": {"parri": ["248"], "degus": ["214"], "frit": ["019"]},
    "turnos": {"mediodia": [6, 18], "noche": [19, 5]},
    "plazas": ["Galería", "Español", "Argentino", "VIP", "Lateral"],
    "diasVentana": 7,
}
IND = [("ppc", "Facturación por cubierto", True), ("tp", "Ticket promedio", True),
       ("postres", "Postres", False), ("parri", "Parrilladas de mariscos", False),
       ("degus", "Degustaciones de pescados", False), ("frit", "Frituras mixtas", False)]
STRAT = ["parri", "degus", "frit"]
MEDAL = ["🥇", "🥈", "🥉", "", ""]


def cfg_from(raw):
    c = json.loads(json.dumps(DEFAULT))
    if isinstance(raw, dict):
        for k, v in (raw.get("pesos") or {}).items():
            if k in c["pesos"] and isinstance(v, (int, float)) and 0 <= v <= 100:
                c["pesos"][k] = v
        if isinstance(raw.get("minCubSemana"), (int, float)):
            c["minCubSemana"] = raw["minCubSemana"]
        for k in STRAT:
            v = (raw.get("productos") or {}).get(k)
            if isinstance(v, list):
                c["productos"][k] = [str(x) for x in v]
        if isinstance(raw.get("plazas"), list) and raw["plazas"]:
            c["plazas"] = [str(x) for x in raw["plazas"]][:5]
        if isinstance(raw.get("diasVentana"), int) and 1 <= raw["diasVentana"] <= 60:
            c["diasVentana"] = raw["diasVentana"]
        if isinstance(raw.get("turnos"), dict):
            c["turnos"].update({k: v for k, v in raw["turnos"].items() if k in c["turnos"]})
    return c


def nombre(s):
    """'GABRIEL CONRADO RODRIGUEZ' -> 'Gabriel Conrado Rodriguez'."""
    return " ".join(w.capitalize() for w in str(s or "").split())


def money(v):
    if v is None:
        return "—"
    return "$ " + f"{round(v):,}".replace(",", ".")


def dec1(v):
    return "—" if v is None else f"{v:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")


def num(v):
    return f"{round(v or 0):,}".replace(",", ".")


def build(win, cfg):
    """Mozos de una ventana con sus unidades cobradas."""
    m = {}
    for code, name, imp, tk, cub in win.get("base", []):
        if not code:
            continue
        m[code] = {"code": code, "name": nombre(name), "importe": imp or 0, "tickets": tk or 0,
                   "cubiertos": cub or 0, "u": {"postres": 0, "parri": 0, "degus": 0, "frit": 0}}
    def ens(code):
        return m.setdefault(code, {"code": code, "name": code, "importe": 0, "tickets": 0, "cubiertos": 0,
                                   "u": {"postres": 0, "parri": 0, "degus": 0, "frit": 0}})
    sc = {}
    for code, u in win.get("postres_sc", []):
        sc[code] = sc.get(code, 0) + (u or 0)
    tot = {}
    for code, u in win.get("postres", []):
        tot[code] = tot.get(code, 0) + (u or 0)
    for code, u in tot.items():
        ens(code)["u"]["postres"] += max(0, u - sc.get(code, 0))
    cat = {p: k for k in STRAT for p in cfg["productos"][k]}
    agg, fsc = {}, {}
    for code, prod, imp, u in win.get("estrategicos", []):
        a = agg.setdefault((code, str(prod)), [0, 0]); a[0] += imp or 0; a[1] += u or 0
    for code, prod, u in win.get("estrategicos_sc", []):
        fsc[(code, str(prod))] = fsc.get((code, str(prod)), 0) + (u or 0)
    for (code, prod), (imp, u) in agg.items():
        if prod in cat and imp > 0:
            ens(code)["u"][cat[prod]] += max(0, u - fsc.get((code, prod), 0))
    return list(m.values())


def metrics(m):
    c = m["cubiertos"]
    return {"ppc": m["importe"] / c if c > 0 else None, "tp": m["importe"] / m["tickets"] if m["tickets"] > 0 else None,
            **{k: (100 * m["u"][k] / c if c > 0 else None) for k in ("postres", "parri", "degus", "frit")}}


def score(lst, cfg, dias):
    min_cub = max(1, round(cfg["minCubSemana"] * dias / 7))
    for m in lst:
        m["v"] = metrics(m)
    elig = [m for m in lst if m["cubiertos"] >= min_cub and m["importe"] > 0 and m["tickets"] > 0]
    falta = [m for m in lst if m not in elig and m["importe"] > 0 and m["cubiertos"] > 0]
    mx = {k: max([m["v"][k] or 0 for m in elig] or [0]) for k, _, _ in IND}
    ok = {k: mx[k] > 0 and cfg["pesos"].get(k, 0) > 0 for k, _, _ in IND}
    wsum = sum(cfg["pesos"][k] for k in ok if ok[k])
    for m in elig:
        m["s"] = {k: (100 * (m["v"][k] or 0) / mx[k] if mx[k] > 0 else None) for k, _, _ in IND}
        m["score"] = sum(cfg["pesos"][k] * m["s"][k] for k in ok if ok[k]) / wsum if wsum else 0
    elig.sort(key=lambda m: (-m["score"], -m["importe"]))
    for i, m in enumerate(elig):
        m["pos"] = i + 1
    T = {"importe": sum(m["importe"] for m in elig), "tickets": sum(m["tickets"] for m in elig),
         "cubiertos": sum(m["cubiertos"] for m in elig),
         "u": {k: sum(m["u"][k] for m in elig) for k in ("postres", "parri", "degus", "frit")}}
    return {"elig": elig, "falta": falta, "min": min_cub, "team": metrics(T), "teamT": T, "ok": ok}


def asignar(orden, plazas):
    """orden: camareros de mejor a peor. Devuelve filas por plaza y pendientes."""
    filas = [{"plaza": p, "principal": None, "segundo": None} for p in plazas]
    pend = []
    for i, m in enumerate(orden):
        if i < len(plazas):
            filas[i]["principal"] = m
        elif i < 2 * len(plazas):
            filas[i - len(plazas)]["segundo"] = m
        else:
            pend.append(m)
    return filas, pend


def main(src, out):
    D = json.load(open(src, encoding="utf-8"))
    cfg = cfg_from(D.get("cfg"))
    fecha = datetime.date.fromisoformat(D["fecha"])
    W = D["ventanas"]
    act = score(build(W["actual"], cfg), cfg, W["actual"]["dias"])
    ant = score(build(W["anterior"], cfg), cfg, W["anterior"]["dias"]) if W.get("anterior") else None
    ayer = score(build(W["ayer"], cfg), cfg, W["ayer"]["dias"]) if W.get("ayer") else None
    pos_ant = {m["code"]: m["pos"] for m in (ant["elig"] if ant else [])}
    pos_ayer = {m["code"]: m for m in (ayer["elig"] if ayer else [])}
    names = {m["code"]: m["name"] for m in act["elig"] + act["falta"]}
    disp = D.get("disponibilidad") or {}
    alertas, turnos_out = [], {}
    TL = {"mediodia": "Mediodía", "noche": "Noche"}
    for t in ("mediodia", "noche"):
        pres = {}
        for code, cub in (D.get("turnos") or {}).get(t, []):
            pres[code] = pres.get(code, 0) + (cub or 0)
        d = disp.get(t) or {}
        disponibles = d.get("disponibles")
        cand = [m for m in act["elig"] if pres.get(m["code"], 0) > 0]
        if disponibles is not None:
            no = [m for m in cand if m["code"] not in disponibles]
            cand = [m for m in cand if m["code"] in disponibles]
            if no:
                alertas.append(f"{TL[t]}: no se asigna a {', '.join(x['name'] for x in no)} (marcados como no disponibles).")
        filas, pend = asignar(cand, cfg["plazas"])
        sin_datos = [names.get(c, c) for c, cub in pres.items() if cub > 0 and c not in {m['code'] for m in act['elig']}]
        vacias = [f["plaza"] for f in filas if not f["principal"]]
        if vacias:
            alertas.append(f"{TL[t]}: plazas sin cubrir: {', '.join(vacias)}.")
        if pend:
            alertas.append(f"{TL[t]}: quedan sin asignar (más de 2 por plaza): {', '.join(m['name'] for m in pend)}.")
        if sin_datos:
            alertas.append(f"{TL[t]}: {', '.join(sin_datos)} trabajaron en el turno pero no llegan a {act['min']} cubiertos en la ventana: sin datos suficientes, no se asignan.")
        manual = d.get("manual") if d.get("confirmada") else None
        turnos_out[t] = {"filas": filas, "pend": pend, "condicionada": disponibles is None, "manual": manual}
    for m in act["falta"]:
        alertas.append(f"{m['name']}: {num(m['cubiertos'])} {'cubierto' if m['cubiertos'] == 1 else 'cubiertos'} en la ventana (mínimo {act['min']}). Fuera del ranking por datos insuficientes.")

    # ---------- correo ----------
    f_txt = fecha.strftime("%d/%m/%Y")
    asunto = f"Puerto de Palos | Ranking y asignación de plazas – {f_txt}"
    wa, wb = W["actual"]["desde"], W["actual"]["hasta"]
    dmy = lambda s: f"{s[8:10]}/{s[5:7]}/{s[0:4]}"
    TD = 'style="padding:6px 8px;border-bottom:1px solid #e3e7eb;text-align:right;white-space:nowrap"'
    TDL = 'style="padding:6px 8px;border-bottom:1px solid #e3e7eb;text-align:left"'
    TH = 'style="padding:6px 8px;text-align:right;font-size:11px;color:#5b6a78;text-transform:uppercase;border-bottom:2px solid #cfd6dd"'
    THL = TH.replace("text-align:right", "text-align:left")
    e = html.escape
    H = [f'<div style="font-family:Arial,Helvetica,sans-serif;color:#14202b;max-width:760px">',
         f'<h2 style="margin:0 0 4px">Puerto de Palos · Asignación de plazas · {e(f_txt)}</h2>',
         f'<p style="margin:0 0 14px;color:#5b6a78;font-size:13px">Ranking acumulado de los últimos {W["actual"]["dias"]} días trabajados ({dmy(wa)} al {dmy(wb)}), día operativo por apertura de caja. Datos de Morphi, base Puerto de Palos.</p>']
    for t, lbl in (("mediodia", "Mediodía"), ("noche", "Noche")):
        T_ = turnos_out[t]
        H.append(f'<h3 style="margin:18px 0 6px">Turno {lbl}</h3>')
        if T_["condicionada"]:
            H.append('<p style="margin:0 0 8px;padding:8px 10px;background:#fdf0d9;color:#7a4800;font-size:13px"><b>Propuesta condicionada a disponibilidad.</b> Morphi no informa francos ni horarios: se proponen quienes atendieron este turno en la ventana. Validar antes de aplicar.</p>')
        if T_["manual"]:
            H.append('<p style="margin:0 0 8px;font-size:13px"><b>El encargado confirmó una asignación manual para hoy</b> (no cambia el ranking): ' +
                     e("; ".join(f"{p}: {', '.join(names.get(c, c) for c in cs)}" for p, cs in T_["manual"].items())) + '</p>')
        H.append(f'<table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th {THL}>Plaza</th><th {THL}>Camarero principal</th><th {THL}>Segundo camarero</th></tr>')
        for i, f in enumerate(T_["filas"]):
            cellm = lambda m: f'{e(m["name"])} <span style="color:#5b6a78">({dec1(m["score"])} pts · {m["pos"]}º)</span>' if m else '<span style="color:#b3261e">Sin cubrir</span>'
            seg = cellm(f["segundo"]) if f["segundo"] else "—"
            H.append(f'<tr><td {TDL}><b>{MEDAL[i]} {e(f["plaza"])}</b></td><td {TDL}>{cellm(f["principal"])}</td><td {TDL}>{seg}</td></tr>')
        H.append('</table>')
    H.append('<h3 style="margin:22px 0 6px">Ranking comercial</h3>')
    H.append(f'<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:13px"><tr><th {TH}>#</th><th {THL}>Camarero</th><th {TH}>Puntaje</th><th {TH}>Cambio</th><th {TH}>Ayer</th><th {TH}>Cubiertos</th><th {TH}>Ticket prom.</th><th {TH}>$/cubierto</th><th {TH}>Postres</th><th {TH}>Parrilladas</th><th {TH}>Degust.</th><th {TH}>Frituras</th></tr>')
    txt_rank = []
    for m in act["elig"]:
        pa = pos_ant.get(m["code"])
        if pa is None:
            cambio = "nuevo"
        elif pa == m["pos"]:
            cambio = "="
        else:
            cambio = ("▲ " if pa > m["pos"] else "▼ ") + str(abs(pa - m["pos"]))
        ay = pos_ayer.get(m["code"])
        ay_txt = f'{ay["pos"]}º ({dec1(ay["score"])})' if ay else "—"
        col = "#1d7a3a" if cambio.startswith("▲") else "#b3261e" if cambio.startswith("▼") else "#5b6a78"
        u = m["u"]
        H.append(f'<tr><td {TD}>{m["pos"]}</td><td {TDL}>{e(m["name"])}</td><td {TD}><b>{dec1(m["score"])}</b></td><td {TD}><span style="color:{col}">{cambio}</span></td><td {TD}>{ay_txt}</td><td {TD}>{num(m["cubiertos"])}</td><td {TD}>{money(m["v"]["tp"])}</td><td {TD}>{money(m["v"]["ppc"])}</td>' +
                 "".join(f'<td {TD}>{num(u[k])} <span style="color:#5b6a78">({dec1(m["v"][k])})</span></td>' for k in ("postres", "parri", "degus", "frit")) + '</tr>')
        txt_rank.append(f'{m["pos"]}. {m["name"]} – {dec1(m["score"])} pts ({cambio}) – {num(m["cubiertos"])} cub. – ticket {money(m["v"]["tp"])} – postres {num(u["postres"])}, parrilladas {num(u["parri"])}, degustaciones {num(u["degus"])}, frituras {num(u["frit"])}')
    tv, TT = act["team"], act["teamT"]
    H.append(f'<tr style="background:#eef2f5"><td {TD}></td><td {TDL}><b>Equipo</b></td><td {TD}></td><td {TD}></td><td {TD}></td><td {TD}>{num(TT["cubiertos"])}</td><td {TD}>{money(tv["tp"])}</td><td {TD}>{money(tv["ppc"])}</td>' +
             "".join(f'<td {TD}>{num(TT["u"][k])} <span style="color:#5b6a78">({dec1(tv[k])})</span></td>' for k in ("postres", "parri", "degus", "frit")) + '</tr></table></div>')
    H.append('<p style="font-size:12px;color:#5b6a78;margin:6px 0 0">Entre paréntesis: unidades cada 100 cubiertos. "Cambio": contra el ranking de la ventana anterior (un día trabajado antes). "Ayer": puesto en la última jornada sola.</p>')
    if alertas:
        H.append('<h3 style="margin:22px 0 6px">Alertas</h3><ul style="margin:0;padding-left:18px;font-size:14px">' + "".join(f"<li>{e(a)}</li>" for a in alertas) + '</ul>')
    # conclusión
    def mejor(m):
        r = [(m["v"][k] / tv[k], n) for k, n, _ in IND if tv.get(k) and m["v"][k] is not None]
        return max(r) if r else None
    def peor(m):
        r = [(m["v"][k] / tv[k], n) for k, n, _ in IND if tv.get(k) and m["v"][k] is not None]
        return min(r) if r else None
    concl = []
    top = act["elig"][:3]
    if top:
        concl.append("Mejores resultados: " + "; ".join(
            f'{m["name"]} ({dec1(m["score"])} pts' + (f', fuerte en {mejor(m)[1].lower()}, {round(100*(mejor(m)[0]-1)):+d} % sobre el equipo' if mejor(m) and mejor(m)[0] > 1 else "") + ")" for m in top) + ".")
    low = [m for m in act["elig"][3:] if peor(m) and peor(m)[0] < 0.9][-2:]
    if low:
        concl.append("Necesitan mejorar: " + "; ".join(f'{m["name"]} en {peor(m)[1].lower()} ({round(100*(peor(m)[0]-1)):+d} % contra el equipo)' for m in low) + ".")
    if act["falta"]:
        concl.append("Sin datos suficientes para evaluar: " + ", ".join(m["name"] for m in act["falta"]) + ".")
    H.append('<h3 style="margin:22px 0 6px">Conclusión</h3><p style="margin:0;font-size:14px;line-height:1.5">' + e(" ".join(concl) or "Sin camareros con datos suficientes en la ventana.") + '</p>')
    H.append(f'<p style="font-size:12px;color:#5b6a78;margin:18px 0 0">Puntaje 0–100: en cada indicador el mejor saca 100 y el resto en proporción; pesos: ' +
             ", ".join(f'{n.lower()} {num(cfg["pesos"][k])}' for k, n, _ in IND) + f'. Ranking principal: {cfg["minCubSemana"]} cubiertos por semana o más. No se cuentan productos cobrados $ 0. Turno por hora del ticket (mediodía {cfg["turnos"]["mediodia"][0]}–{cfg["turnos"]["mediodia"][1]} h, noche {cfg["turnos"]["noche"][0]}–{cfg["turnos"]["noche"][1]} h). La asignación manual de la página no modifica el ranking.</p></div>')

    T = [asunto, "", f"Ventana: {dmy(wa)} al {dmy(wb)} ({W['actual']['dias']} días trabajados).", ""]
    for t, lbl in (("mediodia", "MEDIODÍA"), ("noche", "NOCHE")):
        T.append(lbl + (" (propuesta condicionada a disponibilidad)" if turnos_out[t]["condicionada"] else ""))
        for f in turnos_out[t]["filas"]:
            T.append(f'  {f["plaza"]}: {f["principal"]["name"] if f["principal"] else "SIN CUBRIR"}' + (f' + {f["segundo"]["name"]}' if f["segundo"] else ""))
        T.append("")
    T += ["RANKING"] + txt_rank + [""] + (["ALERTAS"] + ["- " + a for a in alertas] + [""] if alertas else []) + ["CONCLUSIÓN", " ".join(concl)]

    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "asunto.txt"), "w", encoding="utf-8").write(asunto)
    open(os.path.join(out, "correo.html"), "w", encoding="utf-8").write("\n".join(H))
    open(os.path.join(out, "correo.txt"), "w", encoding="utf-8").write("\n".join(T))
    res = {"asunto": asunto, "ranking": [{"pos": m["pos"], "mozo": m["code"], "nombre": m["name"], "puntaje": round(m["score"], 1)} for m in act["elig"]],
           "plazas": {t: [{"plaza": f["plaza"], "principal": f["principal"]["name"] if f["principal"] else None, "segundo": f["segundo"]["name"] if f["segundo"] else None} for f in v["filas"]] for t, v in turnos_out.items()},
           "alertas": alertas}
    json.dump(res, open(os.path.join(out, "resumen.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
