
/* ===================== MODO PERÍODO (fecha desde – hasta) ===================== */
const MAX_DIAS = 366;
const PER = { desde:null, hasta:null, token:0, P:null, A:null, B:null, medida:"real", err:null };
function trozos(d, h, n){ const out=[]; let a=d; while (a<=h) { const b0 = add(a, n-1), b = b0 < h ? b0 : h; out.push([a,b]); a = add(b,1); } return out; }
/* Consulta de ventas sobre un rango, partida en tramos y con las filas unidas. */
async function vq(input, d, h, n=MAX_DIAS){ const rs = await Promise.all(trozos(d,h,n).map(([a,b]) => morphi("ventas", { sucursal:SUC, desde:dmy(a), hasta:dmy(b), filtros:FILTRO, ...input }, b < state.hoy ? 72 : 0.25)));
  return rs.flatMap(r => r.filas || []); }
const noMozo = n => /ENCARGAD|PRUEBA|\bCAJA\b|ADMIN/i.test(String(n||""));
function diasDe(d, h){ const out=[]; for (let x=d; x<=h; x=add(x,1)) out.push(x); return out; }
function composicion(d, h){ const c = { habil:0, vie:0, sab:0, dom:0, fer:0, total:0 };
  for (const x of diasDe(d,h)) { c.total++; const w = dow(x); if (esFer(x)) c.fer++; else if (w===0) c.dom++; else if (w===6) c.sab++; else if (w===5) c.vie++; else c.habil++; } return c; }
const compTxt = c => `${c.total} días: ${c.habil} lun–jue, ${c.vie} viernes, ${c.sab} sábados, ${c.dom} domingos, ${c.fer} feriados`;

async function cargarPeriodo(d, h){
  const codes = CTE ? [...CTE.keys()] : [];
  const tareas = {
    dias:   vq({ agrupar:["dia"], limite:1000 }, d, h),
    ncDias: codes.length ? vq({ agrupar:["dia"], filtros:{ sucursal:["1"], comprobante:codes }, limite:1000 }, d, h) : Promise.resolve([]),
    com:    vq({ agrupar:["comprobante"], limite:200 }, d, h),
    hora:   vq({ agrupar:["hora","comprobante"], limite:1000 }, d, h),
    mozC:   vq({ agrupar:["mozo","comprobante"], limite:1000 }, d, h),
    diaMoz: vq({ agrupar:["dia","mozo"], limite:1000 }, d, h, 100),
    rub:    vq({ agrupar:["rubro"], items_de_combos:"sueltas", limite:60 }, d, h),
  };
  const keys = Object.keys(tareas); const res = await Promise.allSettled(Object.values(tareas)); const R = {}, E = {};
  keys.forEach((k,i) => { if (res[i].status==="fulfilled") R[k] = res[i].value; else E[k] = res[i].reason; });
  if (E.dias && E.com) throw E.dias;
  const out = { d, h, err:E, comp: composicion(d,h) };
  // Días
  const D = {}; for (const f of (R.dias||[])) D[f.dia] = { imp:+f.importe||0, tk:+f.tickets||0, cub:+f.cubiertos||0, nc:0 };
  for (const f of (R.ncDias||[])) if (D[f.dia]) D[f.dia].nc = +f.tickets||0;
  let real_ = 0, prov = false; const meses = new Set();
  for (const [f,x] of Object.entries(D)) { x.tkVal = CTE ? Math.max(0, x.tk - 2*x.nc) : null; const r = real(x.imp, f); x.real = r; if (r!=null) real_ += r; const ip = ipcDe(f); if (ip?.est) { prov = true; meses.add(ip.pedido); } }
  out.dias = D; out.real = real_; out.prov = prov; out.mesesProv = [...meses];
  out.jornadas = Object.values(D).filter(x=>x.imp>0).length;
  // Totales por tipo de comprobante
  out.tot = R.com ? agregaCom(R.com) : null;
  // Horas
  if (R.hora) { const g = {}; for (const x of R.hora) (g[+x.hora] ||= []).push(x); out.hora = {}; for (const [k,v] of Object.entries(g)) out.hora[k] = agregaCom(v);
    const hrs = Object.keys(out.hora).map(Number); const sum = hs => hs.reduce((o,x)=>{ o.imp+=out.hora[x].imp; o.tk+=(out.hora[x].tk||0); return o; }, { imp:0, tk:0 });
    out.alm = sum(hrs.filter(x=>x>=6&&x<18)); out.cen = sum(hrs.filter(x=>x>=18||x<6)); }
  // Mozos
  if (R.mozC) { const g = {}, nom = {}; for (const x of R.mozC) { (g[x.mozo] ||= []).push(x); nom[x.mozo] = x.mozo_nombre; }
    const jorn = {}, porDia = {};
    for (const x of (R.diaMoz||[])) { if ((+x.importe||0) <= 0) continue; (jorn[x.mozo] ||= new Set()).add(x.dia); if (!noMozo(x.mozo_nombre)) porDia[x.dia] = (porDia[x.dia]||0) + 1; }
    out.mozos = Object.entries(g).map(([cod, filas]) => { const a = agregaCom(filas); const j = jorn[cod]?.size || 0; const n = nombre(nom[cod]);
      return { cod, nombre: n || `Legajo ${cod}`, ...a, jornadas: j, real: null, esMozo: !noMozo(nom[cod]), activo: a.imp > 0 && j > 0 }; }).sort((p,q)=>q.imp-p.imp);
    const act = out.mozos.filter(m=>m.activo && m.esMozo);
    out.nMozos = act.length; out.mozoJornadas = Object.values(porDia).reduce((s,v)=>s+v,0); out.mozosPorDia = Object.keys(porDia).length ? out.mozoJornadas/Object.keys(porDia).length : null;
    out.diaMozOk = !E.diaMoz; }
  // Rubros
  if (R.rub) { const m = {}; for (const x of R.rub) { const k = x.rubro_nombre || x.rubro; m[k] = (m[k]||0) + (+x.importe||0); } out.rub = Object.entries(m).map(([n,imp])=>({ n, imp })).sort((a,b)=>b.imp-a.imp).slice(0,8); }
  // Clima
  const cl = { dias:0, lluviaCom:0, mm:0, tmax:0, tmin:0, vmax:0, tormenta:0, sinDato:0 };
  for (const f of diasDe(d,h)) { const w = REF.clima?.dias?.[f]; if (!w) { cl.sinDato++; continue; } cl.dias++; cl.mm += w.pp||0; cl.tmax += w.tmax; cl.tmin += w.tmin; cl.vmax = Math.max(cl.vmax, w.vmax);
    if (mmEn(w.h, COMM) >= 2) cl.lluviaCom++; if (w.cod >= 95 || COMM.some(x=>(w.h.cod[x]||0)>=95)) cl.tormenta++; }
  if (cl.dias) { cl.tmax /= cl.dias; cl.tmin /= cl.dias; }
  out.clima = cl;
  return out; }

function rangosPeriodo(d, h){ const a1 = mismaFecha(d).f, a2 = mismaFecha(h).f; return { A:[a1, a2], B:[add(d,-364), add(h,-364)] }; }
async function runPer(){
  const d = $("desde").value, h0 = $("hasta").value; const tk = ++PER.token;
  try { localStorage.setItem("pdp-desde", d); localStorage.setItem("pdp-hasta", h0); } catch {}
  PER.P = PER.A = PER.B = null; PER.err = null; PER.aviso = null;
  if (!d || !h0) { PER.err = "Elegí la fecha desde y la fecha hasta."; renderPer(); return; }
  let h = h0; const ayer = add(state.hoy,-1);
  if (d > h) { PER.err = "La fecha desde es posterior a la fecha hasta."; renderPer(); return; }
  if (h > ayer) { h = ayer; PER.aviso = `Se analizan días cerrados: el período se corta en ayer (${dmy(ayer)}).`; }
  if (d > h) { PER.err = "El período no tiene días cerrados todavía. Para fechas futuras usá el modo Un día (proyección)."; renderPer(); return; }
  if (diff(h,d)+1 > MAX_DIAS) { PER.err = `El período puede tener hasta ${MAX_DIAS} días.`; renderPer(); return; }
  PER.desde = d; PER.hasta = h; const R = rangosPeriodo(d,h); PER.rA = R.A; PER.rB = R.B;
  renderPer();
  if (!MCP) return;
  try { await loadComprobantes(); } catch (e) { CTE_ERR = e; }
  const ok = () => tk === PER.token;
  const go = (k, [a,b]) => cargarPeriodo(a,b).then(r => { if (!ok()) return; PER[k] = r; mcpEstado = "ok"; renderPer(); })
    .catch(e => { if (!ok()) return; PER[k] = { error:e }; if (["needs_reauth","server_not_connected","not_in_manifest","approval_required","consent_required","blocked_by_policy"].includes(e?.code)) { mcpEstado="error"; bannerError(e); } renderPer(); });
  await Promise.allSettled([go("P",[d,h]), go("A",R.A), go("B",R.B)]);
}

/* ---------- Render período ---------- */
const PROL = { P:{ t:"Período consultado", c:"--s-d" }, A:{ t:"Mismas fechas · año anterior", c:"--s-a" }, B:{ t:"Mismos días de la semana · año anterior", c:"--s-b" } };
const rangoTxt = (a,b) => a===b ? dmy(a) : `${dmy(a)} – ${dmy(b)}`;
function renderPer(){
  const st = $("status"); st.replaceChildren(mcpEstado==="ok" ? el("span",{class:"ok",text:"● Morphi conectado (solo lectura)"}) : mcpEstado==="cargando" ? el("span",{class:"wait",text:"● Consultando Morphi…"}) : el("span",{class:"err",text:"● Morphi sin datos"}));
  if (CTE_ERR) st.append(el("span",{class:"err",text:"Tipos de comprobante no disponibles: tickets válidos sin verificar"}));
  if (REF.clima) st.append(el("span",{text:`Clima hasta ${dmy(Object.keys(REF.clima.dias).pop())}`}));
  const head = $("p-head"); head.replaceChildren();
  if (PER.err) { head.append(el("div",{class:"date",style:"font-size:1.3rem",text:PER.err})); ["p-cards","p-report","p-var","p-ipc","p-mozos","p-chart","p-week","p-cats"].forEach(id => $(id).replaceChildren()); return; }
  const d = PER.desde, h = PER.hasta; if (!d) return;
  head.append(el("span",{class:"eyebrow",text:"Período consultado"}), el("div",{class:"date",text:`${dmy(d)} – ${dmy(h)}`}), el("div",{class:"fg2",text: compTxt(composicion(d,h))}));
  if (PER.aviso) head.append(el("div",{class:"src",text:PER.aviso}));
  if (PER.rA[0].endsWith("-02-28") && d.endsWith("-02-29") || PER.rA[1].endsWith("-02-28") && h.endsWith("-02-29")) head.append(el("div",{class:"src",text:"El 29 de febrero no existe en el año anterior: ese extremo se toma como 28/02."}));
  renderPerCards(); renderPerReport(); renderPerVar(); renderPerIPC(); renderPerMozos(); renderPerChart(); renderPerWeek(); renderPerCats(); }

function rangoDe(k){ return k==="P" ? [PER.desde, PER.hasta] : k==="A" ? PER.rA : PER.rB; }
function perCard(k){ const x = PER[k], meta = PROL[k], [a,b] = rangoDe(k);
  const card = el("article",{class:"panel cmp",style:`--sc:var(${meta.c})`});
  card.append(el("div",{class:"k"}, el("span",{class:"swatch"}), el("span",{class:"eyebrow",text:meta.t})));
  card.append(el("div",{style:"display:flex;flex-direction:column;gap:4px"}, el("div",{class:"when",text:rangoTxt(a,b)}), el("span",{class:"src",text:compTxt(composicion(a,b))})));
  const v = el("div",{style:"display:flex;flex-direction:column;gap:4px"}, el("span",{class:"eyebrow",text:"Facturación total (bruta, con IVA)"}));
  if (!MCP) { v.append(el("div",{class:"empty",text:noMcpTxt()})); card.append(v); return card; }
  if (!x) { v.append(el("div",{class:"big"}, el("span",{class:"skel"}))); card.append(v); return card; }
  if (x.error) { v.append(el("div",{class:"empty",text:errorTxt(x.error)})); card.append(v); return card; }
  const t = x.tot; const imp = t ? t.imp : Object.values(x.dias).reduce((s,y)=>s+y.imp,0);
  v.append(el("div",{class:"big",text:money(imp)}), el("span",{class:"src",text:`≈ ${money(x.real)} en pesos de ${mesTxt(REF.ipcBase)}${x.prov?" (provisorio)":""}`}));
  card.append(v);
  if (!x.jornadas) { card.append(el("div",{class:"empty",text:"Sin ventas registradas en el período."})); return card; }
  const kp = (val,l) => el("div",{class:"kpi"}, el("span",{class:"v",text:val}), el("span",{class:"l",text:l}));
  card.append(el("div",{class:"kpis"},
    kp(t?.tk!=null ? int(t.tk) : "—","Tickets válidos"), kp(money(t?.tp),"Ticket promedio"), kp(int(t?.cub),"Cubiertos"),
    kp(int(x.jornadas),"Jornadas con ventas"), kp(money(imp/x.jornadas),"Promedio por jornada"), kp(t?.tk!=null ? dec(t.tk/x.jornadas) : "—","Tickets por jornada"),
    kp(CTE && t ? `${t.nc.n} · ${moneyK(t.nc.imp)}` : "—","Notas de crédito"), kp(CTE && t ? `${t.anul.n} · ${moneyK(t.anul.imp)}` : "—","Anulaciones preticket"),
    kp(x.nMozos!=null ? int(x.nMozos) : "—","Mozos distintos con ventas")));
  if (x.alm) card.append(el("div",{class:"shifts"},
    el("div",{class:"shift"}, el("span",{class:"l",text:"Almuerzo (hasta 18 h)"}), el("span",{class:"v",text:money(x.alm.imp)}), el("span",{class:"w",text:`${int(x.alm.tk)} tickets · ${x.alm.tk?money(x.alm.imp/x.alm.tk):"—"} promedio`})),
    el("div",{class:"shift"}, el("span",{class:"l",text:"Cena (desde 18 h)"}), el("span",{class:"v",text:money(x.cen.imp)}), el("span",{class:"w",text:`${int(x.cen.tk)} tickets · ${x.cen.tk?money(x.cen.imp/x.cen.tk):"—"} promedio`}))));
  const c = x.clima; const wx = el("div",{class:"wx"});
  if (!c.dias) wx.append(el("div",{class:"cond"}, el("span",{class:"muted",text:"Sin datos de clima para estas fechas."})));
  else { wx.append(el("div",{class:"cond"}, el("b",{text:`${c.lluviaCom} de ${c.dias} días con lluvia en horario comercial`}), el("span",{class:"tag",text:"Reanálisis ERA5 · modelo"})));
    wx.append(kp(`${tc(c.tmin)}° / ${tc(c.tmax)}°`,"Mín. / máx. promedio"), kp(`${dec(c.mm)} mm`,"Lluvia acumulada"), kp(`${Math.round(c.vmax)} km/h`,"Viento máx."), kp(int(c.tormenta),"Días con tormenta"));
    if (c.sinDato) wx.append(el("span",{class:"src",style:"grid-column:1/-1",text:`${c.sinDato} días sin dato de clima en el archivo.`})); }
  card.append(wx); return card; }
function renderPerCards(){ $("p-cards").replaceChildren(perCard("P"), perCard("A"), perCard("B")); }

/* Comparaciones del período: P vs A, P vs B, B vs A */
function perPares(){ return [{ x:"P", y:"A", lbl:"Período vs. mismas fechas" }, { x:"P", y:"B", lbl:"Período vs. mismos días de la semana" }, { x:"B", y:"A", lbl:"Mismos días semanales vs. mismas fechas" }]; }
const perVal = k => { const x = PER[k]; return x && !x.error && x.tot && x.jornadas ? { imp:x.tot.imp, tk:x.tot.tk, tp:x.tot.tp, real:x.real, prov:x.prov, j:x.jornadas, cub:x.tot.cub } : null; };
function renderPerVar(){ const t = $("p-var"); t.replaceChildren();
  t.append(el("thead",{}, el("tr",{}, ...["Comparación","Facturación","Referencia","Diferencia $","Diferencia %","Tickets","Dif. tickets","Ticket prom.","Dif. ticket prom.","Prom. por jornada"].map((h,i)=>el("th",{class:i===0?"l":null,text:h})))));
  const tb = el("tbody"); t.append(tb);
  for (const p of perPares()) { const x = perVal(p.x), y = perVal(p.y); const [xa,xb] = rangoDe(p.x), [ya,yb] = rangoDe(p.y);
    const tr = el("tr",{}, el("td",{class:"l"}, p.lbl, el("div",{class:"sm",text:`${rangoTxt(xa,xb)} vs. ${rangoTxt(ya,yb)}`})));
    if (!x || !y) { tr.append(el("td",{class:"num muted",colspan:"9",text: !MCP ? noMcpTxt() : (PER[p.x]?.error||PER[p.y]?.error) ? "Sin datos de Morphi para uno de los períodos" : (PER[p.x]&&PER[p.y]) ? "Un período sin ventas: no se compara" : "Esperando datos…"})); tb.append(tr); continue; }
    tr.append(el("td",{class:"num",text:money(x.imp)}), el("td",{class:"num",text:money(y.imp)}), el("td",{class:"num "+cls(x.imp-y.imp),text:moneyS(x.imp-y.imp)}), el("td",{class:"num "+cls(dlt(x.imp,y.imp)),text:pct(dlt(x.imp,y.imp))}),
      el("td",{class:"num",text:int(x.tk)}), el("td",{class:"num "+cls(dlt(x.tk,y.tk)),text: x.tk==null||y.tk==null ? "—" : `${intS(x.tk-y.tk)} (${pct(dlt(x.tk,y.tk))})`}), el("td",{class:"num",text:money(x.tp)}), el("td",{class:"num "+cls(dlt(x.tp,y.tp)),text:pct(dlt(x.tp,y.tp))}),
      el("td",{class:"num "+cls(dlt(x.imp/x.j,y.imp/y.j)),text:pct(dlt(x.imp/x.j, y.imp/y.j))}));
    tb.append(tr); }
  $("p-var-note").textContent = "Importes nominales. «Prom. por jornada» compara la facturación promedio de los días con ventas, útil cuando los períodos tienen distinta cantidad de jornadas abiertas."; }

/* Inflación entre períodos: cada día se lleva a pesos del último IPC publicado con el IPC de su mes; la inflación entre períodos es la relación de los deflactores implícitos. */
function renderPerIPC(){ const t = $("p-ipc"); t.replaceChildren();
  if (!REF.ipc) { t.append(el("tbody",{}, el("tr",{}, el("td",{class:"l muted",text:"No se pudo leer la serie del IPC publicada con la página."})))); return; }
  t.append(el("thead",{}, el("tr",{}, ...["Comparación","Inflación entre períodos","Referencia nominal","Referencia ajustada","Facturación","Variación real","Var. real ticket prom.","Var. real por jornada"].map((h,i)=>el("th",{class:i===0?"l":null,text:h})))));
  const tb = el("tbody"); t.append(tb); let prov = false;
  for (const p of perPares()) { const x = perVal(p.x), y = perVal(p.y); const [xa,xb] = rangoDe(p.x), [ya,yb] = rangoDe(p.y);
    const tr = el("tr",{}, el("td",{class:"l"}, p.lbl, el("div",{class:"sm",text:`${rangoTxt(xa,xb)} vs. ${rangoTxt(ya,yb)}`})));
    if (!x || !y || !x.real || !y.real) { tr.append(el("td",{class:"num muted",colspan:"7",text: !MCP ? noMcpTxt() : "Esperando datos…"})); tb.append(tr); continue; }
    const pv = x.prov || y.prov; if (pv) prov = true; const star = pv ? " *" : "";
    const inf = (x.imp/x.real)/(y.imp/y.real) - 1; const yAj = y.imp*(1+inf);
    tr.append(el("td",{class:"num",text:pct(inf)+star}), el("td",{class:"num",text:money(y.imp)}), el("td",{class:"num",text:money(yAj)}), el("td",{class:"num",text:money(x.imp)}),
      el("td",{class:"num "+cls(dlt(x.real,y.real)),text:pct(dlt(x.real,y.real))+star}), el("td",{class:"num "+cls(dlt(x.real/x.tk,y.real/y.tk)),text:(x.tk&&y.tk?pct(dlt(x.real/x.tk,y.real/y.tk)):"—")+star}),
      el("td",{class:"num "+cls(dlt(x.real/x.j,y.real/y.j)),text:pct(dlt(x.real/x.j,y.real/y.j))+star}));
    tb.append(tr); }
  const mp = [...new Set([PER.P,PER.A,PER.B].flatMap(x=>x?.mesesProv||[]))];
  $("p-ipc-note").textContent = `Método: cada día se lleva a pesos de ${mesTxt(REF.ipcBase)} con el nivel del IPC de su mes (importe × IPC ${mesTxt(REF.ipcBase)} ÷ IPC del mes). La inflación entre períodos es la relación entre los índices implícitos de cada período (nominal ÷ real), ponderados por las ventas de cada día; no se suman tasas mensuales. Referencia ajustada = referencia × (1 + inflación entre períodos).` + (prov ? ` * Provisorio: ${mp.map(mesTxt).join(", ")} sin IPC publicado; se usó el último índice disponible. El ajuste exacto queda pendiente.` : ""); }

function renderPerMozos(){ const box = $("p-mozos"); box.replaceChildren();
  const t = el("table"); t.append(el("thead",{}, el("tr",{}, ...["Período","Mozos con ventas","Mozos por jornada (prom.)","Mozo-jornadas","Tickets por mozo-jornada","Fact. real por mozo-jornada"].map((h,i)=>el("th",{class:i===0?"l":null,text:h})))));
  const tb = el("tbody"); t.append(tb);
  for (const k of ["P","A","B"]) { const x = PER[k]; const [a,b] = rangoDe(k);
    const tr = el("tr",{}, el("td",{class:"l"}, el("span",{style:`display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:8px;background:var(${PROL[k].c})`}), rangoTxt(a,b)));
    if (!MCP || !x || x.error || x.nMozos==null) { tr.append(el("td",{class:"muted",colspan:"5",text: !MCP ? noMcpTxt() : !x ? "Cargando…" : x.error ? errorTxt(x.error) : "Sin datos de mozos"})); tb.append(tr); continue; }
    const mj = x.mozoJornadas; tr.append(el("td",{class:"num",text:int(x.nMozos)}), el("td",{class:"num",text:dec(x.mozosPorDia)}), el("td",{class:"num",text:int(mj)}),
      el("td",{class:"num",text: mj && x.tot?.tk!=null ? dec(x.tot.tk/mj) : "—"}), el("td",{class:"num",text: mj ? money(x.real/mj) : "—"}));
    tb.append(tr); }
  box.append(el("div",{class:"tbl-wrap"}, t));
  box.append(el("p",{class:"note",text:"Mozo-jornada: cada día en que un mozo tuvo comprobantes por importe mayor a cero. Los usuarios cuyo nombre en Morphi indica encargado o prueba se listan aparte y no se cuentan como mozos. En un período no se calculan ventanas horarias por mozo."}));
  const x = PER.P; if (!x?.mozos) return;
  const tt = el("table"); tt.append(el("thead",{}, el("tr",{}, ...["Mozo","Jornadas con ventas","Tickets","Facturación","Fact. por jornada","Tickets por jornada","Ticket prom.","Cubiertos","NC / anul."].map((h,i)=>el("th",{class:i===0?"l":null,text:h})))));
  const b = el("tbody"); tt.append(b);
  for (const z of x.mozos) b.append(el("tr",{class: z.activo && z.esMozo ? null : "muted"},
    el("td",{class:"l",text: z.nombre + (!z.esMozo ? " (no es mozo según su nombre en Morphi)" : !z.activo ? " (sin ventas efectivas)" : "")}), el("td",{class:"num",text:int(z.jornadas)}), el("td",{class:"num",text:z.tk==null?"—":int(z.tk)}), el("td",{class:"num",text:money(z.imp)}),
    el("td",{class:"num",text:z.jornadas?money(z.imp/z.jornadas):"—"}), el("td",{class:"num",text:z.jornadas&&z.tk!=null?dec(z.tk/z.jornadas):"—"}), el("td",{class:"num",text:z.tk?money(z.imp/z.tk):"—"}), el("td",{class:"num",text:int(z.cub)}), el("td",{class:"num",text:CTE?`${z.nc.n} / ${z.anul.n}`:"—"})));
  box.append(el("div",{class:"mz-h",style:"margin-top:18px"}, el("span",{class:"swatch",style:"background:var(--s-d)"}), el("h3",{text:`Detalle por mozo · ${rangoTxt(PER.desde, PER.hasta)}`})), el("div",{class:"tbl-wrap"}, tt)); }

/* Gráfico diario: período vs. mismos días de la semana del año anterior (alineados día a día). */
function renderPerChart(){ const box = $("p-chart"); box.replaceChildren(); const P = PER.P, B = PER.B, M = PER.medida;
  $("p-legend").replaceChildren(el("span",{}, el("i",{style:"background:var(--s-d)"}), `Período ${rangoTxt(PER.desde,PER.hasta)}`), el("span",{}, el("i",{style:"background:var(--s-b)"}), `Mismos días semanales ${rangoTxt(...PER.rB)}`));
  if (!MCP) { box.append(el("div",{class:"empty",text:noMcpTxt()})); return; }
  if (!P || !B || P.error || B.error) { box.append(el("div",{class:"empty",text: (P?.error||B?.error) ? "Sin datos diarios para graficar." : "Cargando…"})); return; }
  const dias = diasDe(PER.desde, PER.hasta); const v = (X, f) => { const x = X.dias[f]; if (!x) return 0; return M==="real" ? (x.real||0) : (x.tkVal ?? x.tk); };
  const S = [{ X:P, c:css("--s-d"), f:i=>dias[i] }, { X:B, c:css("--s-b"), f:i=>add(dias[i],-364) }];
  const max = Math.max(1, ...dias.flatMap((_,i)=>S.map(s=>v(s.X, s.f(i)))));
  const W = Math.max(320, box.clientWidth||700), Ht = 250, m = { l:56, r:8, t:10, b:26 }; const iw=W-m.l-m.r, ih=Ht-m.t-m.b, gw=iw/dias.length;
  const bw = Math.max(1, Math.min(14, (gw-2)/2 - 1)); const nice = niceMax(max), y = x => m.t+ih-(Math.max(0,x)/nice)*ih;
  const svg = svgEl("svg",{viewBox:`0 0 ${W} ${Ht}`, role:"img", "aria-label":"Ventas diarias del período"}); const gr = svgEl("g",{class:"grid"}), ax = svgEl("g",{class:"axis"});
  for (let i=0;i<=4;i++){ const val=nice*i/4, yy=y(val); gr.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:yy,y2:yy})); const t=svgEl("text",{x:m.l-8,y:yy+4,"text-anchor":"end"}); t.textContent = M==="real" ? moneyK(val).replace("$ ","") : dec(val,0); ax.append(t); }
  svg.append(gr);
  const paso = Math.ceil(dias.length / Math.max(1, Math.floor(iw/42)));
  dias.forEach((f,i) => { const cx = m.l+gw*i+gw/2;
    if (i % paso === 0) { const t=svgEl("text",{x:cx,y:Ht-8,"text-anchor":"middle"}); t.textContent = f.slice(8,10)+"/"+f.slice(5,7); ax.append(t); }
    if (gw < 3) { const vp = v(P,f); if (vp>0) svg.append(svgEl("rect",{x:m.l+gw*i,y:y(vp),width:Math.max(1,gw),height:m.t+ih-y(vp),fill:S[0].c})); }
    else S.forEach((s,j) => { const val = v(s.X, s.f(i)); if (val<=0) return; const x = cx - (2*bw+2)/2 + j*(bw+2); svg.append(svgEl("path",{d:barPath(x,y(val),bw,m.t+ih),fill:s.c})); });
    if (esFer(f)) svg.append(svgEl("circle",{cx, cy:m.t+ih+4, r:2, fill:css("--accent")}));
    const hit = svgEl("rect",{x:m.l+gw*i,y:m.t,width:gw,height:ih,fill:"transparent"});
    const show = ev => { hideTip(box); const r = box.getBoundingClientRect(); const tp = el("div",{class:"tip"});
      for (const s of S) { const ff = s.f(i), x = s.X.dias[ff], w = REF.clima?.dias?.[ff];
        tp.append(el("b",{style:`color:${s.c}`,text:cap(corto(ff)) + (esFer(ff)?" · feriado":"")}));
        tp.append(el("div",{class:"r"}, el("span",{text:"Facturación"}), el("span",{class:"num",text: x ? money(x.imp) : "sin ventas"})));
        if (x) tp.append(el("div",{class:"r muted"}, el("span",{text:"Real · tickets"}), el("span",{class:"num",text:`${moneyK(x.real)} · ${int(x.tkVal ?? x.tk)}`})));
        if (w) tp.append(el("div",{class:"r muted"}, el("span",{text:"Clima"}), el("span",{text:`${condicion(w).t.toLowerCase()}, ${dec(mmEn(w.h,COMM))} mm en horario`}))); }
      box.append(tp); tp.style.left = Math.max(0, Math.min(ev.clientX-r.left+14, r.width-tp.offsetWidth))+"px"; tp.style.top = Math.max(0, ev.clientY-r.top-tp.offsetHeight-10)+"px"; };
    hit.addEventListener("pointerenter", show); hit.addEventListener("pointermove", show); hit.addEventListener("pointerleave", () => hideTip(box)); svg.append(hit); });
  svg.append(svgEl("line",{x1:m.l,x2:W-m.r,y1:m.t+ih,y2:m.t+ih,stroke:css("--line-2")})); svg.append(ax); box.append(svg);
  $("p-chart-note").textContent = `Cada día se compara con el mismo día de la semana del año anterior (52 semanas antes). ${M==="real" ? `Facturación en pesos de ${mesTxt(REF.ipcBase)}.` : "Tickets válidos."} Los puntos bajo el eje marcan feriados. Tocá o pasá el cursor por un día para ver el detalle y el clima.`; }

/* Promedio real por día de la semana */
function renderPerWeek(){ const box = $("p-week"); box.replaceChildren(); const P = PER.P, B = PER.B;
  if (!MCP || !P || !B || P.error || B.error) { box.append(el("div",{class:"empty",text: !MCP ? noMcpTxt() : (P?.error||B?.error) ? "Sin datos." : "Cargando…"})); return; }
  const prom = (X) => { const g = Array.from({length:8},()=>({ s:0, n:0, tk:0 })); for (const [f,x] of Object.entries(X.dias)) { if (x.imp<=0) continue; const k = esFer(f) ? 7 : dow(f); g[k].s += x.real||0; g[k].tk += (x.tkVal ?? x.tk); g[k].n++; } return g; };
  const gp = prom(P), gb = prom(B); const orden = [1,2,3,4,5,6,0,7];
  const t = el("table"); t.append(el("thead",{}, el("tr",{}, ...["Día","Jornadas","Promedio real","Tickets prom.","Jornadas año ant.","Promedio real año ant.","Variación real"].map((h,i)=>el("th",{class:i===0?"l":null,text:h})))));
  const tb = el("tbody"); t.append(tb);
  for (const k of orden) { const p = gp[k], b = gb[k]; if (!p.n && !b.n) continue; const vp = p.n ? p.s/p.n : null, vb = b.n ? b.s/b.n : null;
    tb.append(el("tr",{}, el("td",{class:"l",text: k===7 ? "Feriados" : cap(plural(k))}), el("td",{class:"num",text:int(p.n)}), el("td",{class:"num",text:money(vp)}), el("td",{class:"num",text:p.n?dec(p.tk/p.n):"—"}),
      el("td",{class:"num",text:int(b.n)}), el("td",{class:"num",text:money(vb)}), el("td",{class:"num "+cls(dlt(vp,vb)),text:pct(dlt(vp,vb))}))); }
  box.append(el("div",{class:"tbl-wrap"}, t), el("p",{class:"note",text:`Promedio por jornada con ventas, en pesos de ${mesTxt(REF.ipcBase)}. Año anterior: mismos días de la semana (${rangoTxt(...PER.rB)}). Los feriados se separan de su día de la semana.`})); }

function renderPerCats(){ const box = $("p-cats"); box.replaceChildren();
  for (const k of ["P","B"]) { const x = PER[k]; const p = el("div",{class:"panel"}); p.append(el("div",{class:"panel-h"}, el("h3",{text:`Ventas por rubro · ${rangoTxt(...rangoDe(k))}`}), el("span",{class:"src",text:"Productos vendidos sueltos"})));
    if (!MCP || !x || x.error || !x.rub) p.append(el("div",{class:"empty",text: !MCP ? noMcpTxt() : !x ? "Cargando…" : "Sin datos por rubro."}));
    else { const mx = Math.max(...x.rub.map(r=>r.imp)); const hb = el("div",{class:"hbars"});
      for (const r of x.rub) hb.append(el("div",{class:"hb"}, el("span",{class:"n",title:r.n,text:String(r.n).toLowerCase()}), el("span",{class:"t"}, el("i",{style:`width:${(Math.max(0,r.imp)/mx*100).toFixed(1)}%;background:var(${PROL[k].c})`})), el("span",{class:"v",text:moneyK(r.imp)})));
      p.append(hb); }
    box.append(p); } }

/* Informe gerencial del período */
function renderPerReport(){ const box = $("p-report"); box.replaceChildren();
  const Q = (titulo, ...ps) => { const q = el("div",{class:"q"}, el("h3",{text:titulo})); for (const [lbl, txt] of ps.filter(Boolean)) { const p = el("p"); if (lbl) p.append(el("span",{class:"lbl "+lbl,text:{hecho:"Hecho",hip:"Hipótesis",corr:"Correlación",pend:"Pendiente"}[lbl]})); p.append(txt); q.append(p); } box.append(q); };
  const cP = composicion(PER.desde, PER.hasta), cA = composicion(...PER.rA), cB = composicion(...PER.rB);
  let ctx = `Período de ${cP.total} días (${compTxt(cP).split(": ")[1]}). Se compara con las mismas fechas del año anterior (${rangoTxt(...PER.rA)}) y con los mismos días de la semana (${rangoTxt(...PER.rB)}).`;
  const difComp = (c, o) => { const r = []; for (const [k,l] of [["fer","feriados"],["sab","sábados"],["dom","domingos"],["vie","viernes"]]) if (c[k]!==o[k]) r.push(`${c[k]} ${l} contra ${o[k]}`); return r; };
  const dA = difComp(cP, cA), dB = difComp(cP, cB);
  if (dA.length) ctx += ` Frente a las mismas fechas hay distinta composición de días (${dA.join(", ")}): esa comparación puede quedar sesgada.`;
  if (dB.length) ctx += ` Frente a los mismos días semanales difieren los feriados (${dB.join(", ")}).`;
  box.append(el("p",{class:"fg2",style:"font-size:.98rem;line-height:1.65",text:ctx}));
  if (!MCP) { box.append(el("p",{class:"muted",text:noMcpTxt()})); return; }
  const x = perVal("P"), b = perVal("B"), a = perVal("A");
  if (!x || !b) { box.append(el("p",{class:"muted",text: PER.P?.error ? errorTxt(PER.P.error) : "Esperando datos de Morphi…"})); return; }
  const inf = (X, Y) => (X.imp/X.real)/(Y.imp/Y.real) - 1; const prov = x.prov || b.prov || a?.prov;
  const vB = dlt(x.real, b.real), vA = a ? dlt(x.real, a.real) : null;
  Q("¿Se vendió más o menos en términos reales?", ["hecho", `Se vendió ${vB>=0?"más":"menos"}: ${pct(vB)} real contra los mismos días de la semana del año anterior (nominal ${pct(dlt(x.imp,b.imp))}, inflación entre períodos ${pct(inf(x,b))}).` + (vA!=null ? ` Contra las mismas fechas: ${pct(vA)} real.` : "") + ` Por jornada con ventas: ${pct(dlt(x.real/x.j, b.real/b.j))} real.` + (prov ? " Incluye meses sin IPC publicado: cálculo provisorio, el ajuste exacto queda pendiente." : "")]);
  if (x.tk!=null && b.tk!=null) Q("¿Se emitieron más o menos tickets?", ["hecho", `${int(x.tk)} tickets válidos contra ${int(b.tk)} (${intS(x.tk-b.tk)}, ${pct(dlt(x.tk,b.tk))})` + (a?.tk!=null ? ` y ${int(a.tk)} en las mismas fechas (${pct(dlt(x.tk,a.tk))}).` : ".") + (PER.P.tot ? ` Se descontaron ${PER.P.tot.nc.n} notas de crédito y ${PER.P.tot.anul.n} anulaciones.` : "")]);
  else Q("¿Se emitieron más o menos tickets?", ["pend","Tickets válidos sin verificar: no se pudo leer la tabla de comprobantes de Morphi."]);
  if (x.tk && b.tk) { const lt = Math.log(x.tk/b.tk), lp = Math.log((x.real/x.tk)/(b.real/b.tk)); const vt = dlt(x.tk,b.tk), vp = dlt(x.real/x.tk, b.real/b.tk);
    let txt = `Variación real ${pct(vB)} = tickets ${pct(vt)} × ticket promedio real ${pct(vp)}. `;
    if (Math.sign(lt)===Math.sign(lp) || Math.abs(lt)<0.005 || Math.abs(lp)<0.005) { const sh = Math.abs(lt)/((Math.abs(lt)+Math.abs(lp))||1); txt += sh>0.6 ? "El cambio vino sobre todo de la cantidad de tickets." : sh<0.4 ? "El cambio vino sobre todo del ticket promedio." : "Pesaron parecido la cantidad de tickets y el ticket promedio."; }
    else txt += lt>0 ? "Hubo más tickets, pero el ticket promedio real bajó." : "Hubo menos tickets, pero el ticket promedio real subió.";
    Q("¿El cambio vino de más tickets o de un ticket promedio mayor?", ["hecho", txt]); }
  const P = PER.P, Bx = PER.B;
  if (P.nMozos!=null) { const top = P.mozos.filter(z=>z.activo&&z.esMozo).slice(0,3).map(z=>`${z.nombre} (${moneyK(z.imp)}, ${z.jornadas} jornadas)`);
    Q("¿Cuántos mozos trabajaron y cuál fue su productividad?", ["hecho", `${P.nMozos} mozos distintos con ventas, ${dec(P.mozosPorDia)} por jornada en promedio, ${int(P.mozoJornadas)} mozo-jornadas. ${P.mozoJornadas && x.tk!=null ? `${dec(x.tk/P.mozoJornadas)} tickets y ${money(P.real/P.mozoJornadas)} reales por mozo-jornada.` : ""} Mayor facturación: ${top.join("; ")}.` + (Bx?.mozoJornadas ? ` Año anterior (mismos días semanales): ${dec(Bx.mozosPorDia)} mozos por jornada, ${b.tk!=null?dec(b.tk/Bx.mozoJornadas):"—"} tickets y ${money(Bx.real/Bx.mozoJornadas)} reales por mozo-jornada.` : "")],
      ["pend","Dotación real no verificada: Morphi no expone fichadas ni horarios. Se cuentan mozos con comprobantes asignados."]); }
  else Q("¿Cuántos mozos trabajaron y cuál fue su productividad?", ["pend","Esperando datos de mozos…"]);
  const cx = P.clima, cb = Bx?.clima;
  if (cx?.dias && cb?.dias) { const r = [];
    const pl = cx.lluviaCom/cx.dias, pb = cb.lluviaCom/cb.dias; if (Math.abs(pl-pb) >= 0.1) r.push(`${pl>pb?"más":"menos"} días con lluvia en horario comercial (${cx.lluviaCom} de ${cx.dias} contra ${cb.lluviaCom} de ${cb.dias})`);
    if (Math.abs(cx.tmax-cb.tmax) >= 2) r.push(`máximas promedio ${cx.tmax>cb.tmax?"más altas":"más bajas"} (${tc(cx.tmax)}° contra ${tc(cb.tmax)}°)`);
    Q("¿Hubo diferencias climáticas relevantes?", ["hecho", `Período: ${cx.lluviaCom} días con lluvia en horario comercial, ${dec(cx.mm)} mm acumulados, máximas promedio ${tc(cx.tmax)}°. Año anterior: ${cb.lluviaCom} días, ${dec(cb.mm)} mm, ${tc(cb.tmax)}°. ` + (r.length ? `Diferencias: ${r.join("; ")}.` : "Sin diferencias climáticas relevantes.") + " Datos de modelo."],
      r.some(s=>s.includes("lluvia")) && HIST && rainEffect().n>=8 ? ["corr", `En el historial, los días con lluvia en horario comercial facturaron en mediana ${pct(rainEffect().med-1)} frente a días similares sin lluvia (${rainEffect().n} casos). Contexto, no causa demostrada.`] : null); }
  if (P.mozoJornadas && Bx?.mozoJornadas && x.tk!=null && b.tk!=null) { const cP_ = x.tk/P.mozoJornadas, cB_ = b.tk/Bx.mozoJornadas, v = cP_/cB_ - 1;
    const j = v > 0.15 ? "más carga por mozo que el año anterior: la dotación pudo haber quedado ajustada" : v < -0.15 ? "menos carga por mozo que el año anterior: pudo haber más dotación de la necesaria" : "una carga por mozo similar a la del año anterior";
    Q("¿La dotación pareció adecuada para el nivel de actividad?", ["hecho", `${dec(cP_)} tickets por mozo-jornada contra ${dec(cB_)} en los mismos días semanales del año anterior (${pct(v)}).`], ["hip", `Sugiere ${j}. Sin fichadas no se puede confirmar cuántas personas trabajaron realmente.`]); }
  else Q("¿La dotación pareció adecuada para el nivel de actividad?", ["pend","Esperando datos…"], ["pend","Dotación real no verificada."]);
}
