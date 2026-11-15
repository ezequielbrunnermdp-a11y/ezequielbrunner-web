"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Header } from "./Header";
import { Viewer, type ViewerTarget } from "./Viewer";
import { ChatPanel } from "./ChatPanel";
import { ReportRunner, ReportView, useReports } from "./Reports";
import { CitedMarkdown, CitasList } from "./CitedMarkdown";
import type { Causa, Cita, Doc, Party } from "./types";
import { CATEGORIAS, TIPOS_DOCUMENTO, categoriaDeTipo, tipoLabel, type Perspectiva } from "@/lib/taxonomy";

type CaseData = { causa: Causa; documentos: Doc[]; partes: Party[]; relacionadas: { id: string; caratula: string; motivo: string }[]; faltantes: string[] };
const TABS = ["Expediente", "Cronología", "Pruebas", "Análisis", "Estrategia", "Jurisprudencia", "Informes", "Datos e importación"] as const;
type Tab = (typeof TABS)[number];

export function CaseWorkspace({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("Expediente");
  const [docId, setDocId] = useState<string | null>(null);
  const [target, setTarget] = useState<ViewerTarget | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetch(`/api/cases/${caseId}`);
    if (r.status === 401) return (window.location.href = "/login");
    const j = await r.json();
    if (!r.ok) return setError(j.error);
    setData(j);
  }, [caseId]);
  useEffect(() => { reload(); }, [reload]);
  // Mientras haya documentos con clasificación pendiente, refrescar.
  useEffect(() => {
    if (!data?.documentos.some((d) => d.clasificacion_origen === "pendiente" && !d.status_detail?.includes("no disponible"))) return;
    const t = setTimeout(reload, 6000);
    return () => clearTimeout(t);
  }, [data, reload]);

  const open = useCallback((t: Omit<ViewerTarget, "nonce">) => {
    setDocId(t.documentId);
    setTarget({ ...t, nonce: Date.now() });
    setTab("Expediente");
    setChatExpanded(false);
  }, []);
  const onCita = useCallback((c: Cita) => {
    if (c.kind === "web" && c.url) return window.open(c.url, "_blank", "noopener");
    if (c.document_id) open({ documentId: c.document_id, page: c.page, highlight: c.cited_text });
  }, [open]);

  if (error) return <div className="min-h-screen"><Header /><p className="p-8 text-red-400">{error}</p></div>;
  if (!data) return <div className="min-h-screen"><Header /><p className="p-8 text-ink-400">Cargando…</p></div>;
  const doc = data.documentos.find((d) => d.id === docId) ?? null;
  const c = data.causa;

  return (
    <div className="flex h-screen flex-col">
      <Header>
        <div className="truncate font-serif text-white">{c.caratula}</div>
        <div className="truncate text-[11px] text-ink-400">Expte. {c.numero ?? "—"} · {c.organismo ?? "organismo —"} · {c.departamento ?? "depto. —"} · {c.fuero ?? "fuero —"}{c.reservada ? " · RESERVADA" : ""}</div>
      </Header>
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-700 bg-ink-900 px-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? "border-gold-500 text-white" : "border-transparent text-ink-400 hover:text-white"}`}>{t}</button>
        ))}
      </nav>

      {tab === "Expediente" && (
        <div className="flex min-h-0 flex-1">
          {!chatExpanded && (
            <>
              <aside className="w-72 shrink-0 overflow-y-auto border-r border-ink-700 bg-ink-900 scroll-thin">
                <DocsPanel caseId={caseId} data={data} selected={docId} onSelect={(id) => open({ documentId: id })} reload={reload} />
              </aside>
              <section className="min-w-0 flex-1 bg-ink-950">
                <Viewer doc={doc} target={target} caseId={caseId} onOpen={open} />
              </section>
            </>
          )}
          <aside className={chatExpanded ? "min-w-0 flex-1" : "w-[440px] shrink-0 border-l border-ink-700"}>
            <ChatPanel caseId={caseId} onCita={onCita} expanded={chatExpanded} onToggleExpand={() => setChatExpanded(!chatExpanded)} />
          </aside>
        </div>
      )}
      <div className={tab === "Expediente" ? "hidden" : "min-h-0 flex-1 overflow-y-auto scroll-thin"}>
        <div className="mx-auto max-w-5xl px-4 py-6">
          {tab === "Cronología" && <Timeline caseId={caseId} onOpen={open} />}
          {tab === "Pruebas" && <Pruebas caseId={caseId} docs={data.documentos} onOpen={open} onCita={onCita} />}
          {tab === "Análisis" && <Analisis caseId={caseId} data={data} onCita={onCita} />}
          {tab === "Estrategia" && <Estrategia caseId={caseId} onCita={onCita} />}
          {tab === "Jurisprudencia" && <Jurisprudencia caseId={caseId} causa={c} onCita={onCita} />}
          {tab === "Informes" && <Informes caseId={caseId} onCita={onCita} />}
          {tab === "Datos e importación" && <Datos caseId={caseId} data={data} reload={reload} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Panel izquierdo: documentos ---------------- */
function DocsPanel({ caseId, data, selected, onSelect, reload }: { caseId: string; data: CaseData; selected: string | null; onSelect: (id: string) => void; reload: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setUploading(true);
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    const r = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: fd });
    const j = await r.json();
    setUploading(false);
    if (!r.ok) setLog([j.error]);
    else setLog(j.results.map((x: { filename: string; error?: string; duplicate: boolean; pages: number; warnings: string[] }) => x.error ? `✗ ${x.filename}: ${x.error}` : `${x.duplicate ? "=" : "✓"} ${x.filename} (${x.pages} pág.) ${x.warnings.join(" ")}`));
    reload();
  }

  const groups = new Map<string, Doc[]>();
  for (const d of data.documentos) {
    const k = CATEGORIAS[categoriaDeTipo(d.tipo)];
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  return (
    <div className="p-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`block cursor-pointer rounded-lg border border-dashed p-3 text-center text-xs ${drag ? "border-gold-400 bg-gold-500/10" : "border-ink-600 hover:border-gold-500"}`}>
        <input type="file" multiple hidden accept=".pdf,.docx,.txt,.html,.htm,.png,.jpg,.jpeg,.webp" onChange={(e) => e.target.files && upload(e.target.files)} />
        {uploading ? "Procesando documentos (extracción y OCR)…" : "Incorporar documentos — arrastre o haga clic (PDF, DOCX, HTML, TXT, imágenes)"}
      </label>
      {log.length > 0 && <ul className="mt-2 space-y-1 text-[11px] text-ink-300">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}

      {data.faltantes.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-700/50 bg-amber-950/30 p-2 text-[11px] text-amber-200">
          <div className="font-semibold">Documentación posiblemente faltante</div>
          {data.faltantes.join(" · ")}. El expediente incorporado puede no estar completo.
        </div>
      )}

      {[...groups.entries()].map(([g, docs]) => (
        <div key={g} className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{g}</div>
          {docs.map((d) => (
            <button key={d.id} onClick={() => onSelect(d.id)} className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left ${selected === d.id ? "bg-ink-700" : "hover:bg-ink-800"}`}>
              <div className="truncate text-sm text-white">{d.titulo || d.filename}</div>
              <div className="flex flex-wrap gap-x-2 text-[10px] text-ink-400">
                <span>{tipoLabel(d.tipo)}</span><span>{d.fecha ?? "s/f"}</span><span>{d.page_count} pág.</span>
                {d.clasificacion_origen === "pendiente" && (d.status_detail?.includes("no disponible") || d.status_detail?.includes("fallida") || d.status_detail?.includes("No se pudo")
                  ? <span className="text-ink-300">clasificar manualmente</span>
                  : <span className="text-sky-400">clasificando…</span>)}
                {d.paginas_ocr > 0 && <span className="text-amber-400">OCR {d.paginas_ocr}</span>}
                {d.paginas_sin_texto > 0 && <span className="text-red-400">sin texto {d.paginas_sin_texto}</span>}
              </div>
            </button>
          ))}
        </div>
      ))}
      {!data.documentos.length && <p className="mt-4 text-xs text-ink-400">Todavía no hay documentos incorporados.</p>}
    </div>
  );
}

/* ---------------- Cronología ---------------- */
type Evento = { id: string; fecha: string | null; tipo: string; categoria: string; parte: string | null; descripcion: string; origen: string; document_id: string | null; filename: string | null; titulo: string | null };
function Timeline({ caseId, onOpen }: { caseId: string; onOpen: (t: { documentId: string }) => void }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<Set<string>>(new Set(Object.keys(CATEGORIAS)));
  useEffect(() => { fetch(`/api/cases/${caseId}/timeline`).then((r) => r.json()).then((j) => setEventos(j.eventos)); }, [caseId]);
  const toggle = (k: string) => { const s = new Set(filtro); s.has(k) ? s.delete(k) : s.add(k); setFiltro(s); };
  const visibles = eventos.filter((e) => filtro.has(e.categoria));
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Cronología procesal</h2>
      <p className="mt-1 text-sm text-ink-400">Actuaciones identificadas en los documentos (clasificación automática, revisable) y en los listados de movimientos importados.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(CATEGORIAS).map(([k, v]) => (
          <button key={k} onClick={() => toggle(k)} className={`rounded-full border px-3 py-1 text-xs ${filtro.has(k) ? "border-gold-500 bg-gold-500/15 text-gold-400" : "border-ink-600 text-ink-400"}`}>{v}</button>
        ))}
      </div>
      <ol className="relative mt-6 border-l border-ink-600 pl-6">
        {visibles.map((e) => (
          <li key={e.id} className="mb-5">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-gold-500" />
            <div className="text-xs text-gold-400">{e.fecha ?? "Sin fecha"} · {tipoLabel(e.tipo)}{e.parte ? ` · ${e.parte}` : ""}</div>
            <div className="mt-0.5 text-sm text-ink-100">{e.descripcion}</div>
            <div className="mt-1 text-[11px] text-ink-400">
              Origen: {e.origen === "documento" ? "documento" : e.origen === "listado_movimientos" ? "listado de movimientos importado (sin documento adjunto)" : e.origen}
              {e.document_id && <> · <button className="text-gold-400 underline" onClick={() => onOpen({ documentId: e.document_id! })}>{e.titulo || e.filename}</button></>}
            </div>
          </li>
        ))}
        {!visibles.length && <li className="text-sm text-ink-400">No hay actuaciones registradas para los filtros elegidos.</li>}
      </ol>
    </div>
  );
}

/* ---------------- Pruebas ---------------- */
function Pruebas({ caseId, docs, onOpen, onCita }: { caseId: string; docs: Doc[]; onOpen: (t: { documentId: string }) => void; onCita: (c: Cita) => void }) {
  const pruebas = docs.filter((d) => categoriaDeTipo(d.tipo) === "prueba");
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Prueba</h2>
      <ul className="mt-4 divide-y divide-ink-700 rounded-xl border border-ink-700 bg-ink-900">
        {pruebas.map((d) => (
          <li key={d.id} className="p-3"><button onClick={() => onOpen({ documentId: d.id })} className="text-left">
            <div className="text-sm text-white">{d.titulo || d.filename}</div>
            <div className="text-xs text-ink-400">{tipoLabel(d.tipo)} · {d.fecha ?? "s/f"} · {d.parte ?? "parte no identificada"}</div>
            {d.resumen && <div className="mt-1 text-xs text-ink-300">{d.resumen} <span className="text-ink-400">(resumen automático)</span></div>}
          </button></li>
        ))}
        {!pruebas.length && <li className="p-4 text-sm text-ink-400">No hay piezas clasificadas como prueba. Revise la clasificación de los documentos o incorpore la prueba producida.</li>}
      </ul>
      <div className="mt-6"><ReportRunner caseId={caseId} kind="analisis_pruebas" label="Analizar la prueba" onCita={onCita} /></div>
    </div>
  );
}

/* ---------------- Análisis ---------------- */
function Analisis({ caseId, data, onCita }: { caseId: string; data: CaseData; onCita: (c: Cita) => void }) {
  const { reports, reload } = useReports(caseId);
  const prev = reports.filter((r) => r.kind === "analisis_integral");
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Análisis jurídico profundo</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-400">Claude lee el texto completo disponible del expediente ({data.documentos.length} documento(s)) y elabora un informe con identificación de la causa, historia procesal, análisis probatorio, análisis jurídico y escenarios, con citas verificables. Las conclusiones expresan su incertidumbre; no se asignan probabilidades numéricas.</p>
      <div className="mt-6"><ReportRunner big caseId={caseId} kind="analisis_integral" label="ANALIZAR EXPEDIENTE" onDone={reload} onCita={onCita} /></div>
      {prev.length > 0 && <h3 className="mt-10 text-sm font-semibold uppercase tracking-wider text-ink-400">Análisis anteriores</h3>}
      {prev.map((r) => <ReportView key={r.id} report={r} onCita={onCita} />)}
    </div>
  );
}

/* ---------------- Estrategia ---------------- */
function Estrategia({ caseId, onCita }: { caseId: string; onCita: (c: Cita) => void }) {
  const [p, setP] = useState<Perspectiva>("actor");
  const { reports, reload } = useReports(caseId);
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Asistente de estrategia procesal</h2>
      <p className="mt-1 text-sm text-ink-400">Los argumentos generados son hipótesis de trabajo para la postura elegida: no son conclusiones judiciales.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {([["actor", "Analizar desde la posición del actor"], ["demandado", "Analizar desde la posición del demandado"], ["neutral", "Realizar análisis neutral"]] as const).map(([k, v]) => (
          <button key={k} onClick={() => setP(k)} className={`rounded-md border px-3 py-2 text-sm ${p === k ? "border-gold-500 bg-gold-500/15 text-gold-400" : "border-ink-600 text-ink-300"}`}>{v}</button>
        ))}
      </div>
      <div className="mt-5"><ReportRunner key={p} caseId={caseId} kind="estrategia" perspectiva={p} label="Generar análisis estratégico" onDone={reload} onCita={onCita} /></div>
      {reports.filter((r) => r.kind === "estrategia").map((r) => <ReportView key={r.id} report={r} onCita={onCita} />)}
    </div>
  );
}

/* ---------------- Jurisprudencia ---------------- */
function Jurisprudencia({ caseId, causa, onCita }: { caseId: string; causa: Causa; onCita: (c: Cita) => void }) {
  const [f, setF] = useState({ hechos: "", materia: causa.objeto ?? "", tribunal: "", normativa: "", argumentos: "" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ disponible: boolean; motivo?: string; markdown?: string; citas?: Cita[]; fuentes: { nombre: string; url: string }[]; consulta: string } | null>(null);
  const inp = "w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-gold-500";
  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await fetch("/api/jurisprudencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, caseId }) });
    setRes(await r.json()); setBusy(false);
  }
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Consulta de jurisprudencia</h2>
      <p className="mt-1 text-sm text-ink-400">Cada antecedente debe vincularse a su fuente oficial. No se muestran precedentes sin fuente verificable.</p>
      <form onSubmit={buscar} className="mt-4 grid gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5 md:grid-cols-2">
        <textarea className={`${inp} h-24 md:col-span-2`} placeholder="Hechos jurídicamente relevantes *" value={f.hechos} onChange={(e) => setF({ ...f, hechos: e.target.value })} required />
        <input className={inp} placeholder="Materia" value={f.materia} onChange={(e) => setF({ ...f, materia: e.target.value })} />
        <input className={inp} placeholder="Tribunal (p. ej. SCBA, Cámara Civil y Comercial de Mar del Plata)" value={f.tribunal} onChange={(e) => setF({ ...f, tribunal: e.target.value })} />
        <input className={inp} placeholder="Normativa (p. ej. art. 1757 CCyCN)" value={f.normativa} onChange={(e) => setF({ ...f, normativa: e.target.value })} />
        <input className={inp} placeholder="Argumentos" value={f.argumentos} onChange={(e) => setF({ ...f, argumentos: e.target.value })} />
        <button disabled={busy} className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-50">{busy ? "Buscando en fuentes oficiales…" : "Buscar antecedentes"}</button>
      </form>
      {res && (
        <div className="mt-5 space-y-4">
          {!res.disponible && <div className="rounded-md border border-ink-600 bg-ink-850 p-3 text-sm text-ink-300">{res.motivo}</div>}
          {res.markdown && <div className="rounded-xl border border-ink-700 bg-ink-900 p-5"><CitedMarkdown markdown={res.markdown} citas={res.citas ?? []} onCita={onCita} /><CitasList citas={res.citas ?? []} onCita={onCita} /></div>}
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm">
            <div className="mb-2 text-xs uppercase tracking-wider text-ink-400">Búsqueda manual en fuentes oficiales</div>
            <div className="mb-2 text-ink-300">Consulta sugerida: <code className="rounded bg-ink-800 px-1">{res.consulta}</code></div>
            <ul className="space-y-1">{res.fuentes.map((x) => <li key={x.url}><a className="text-gold-400 underline" href={x.url} target="_blank" rel="noreferrer">{x.nombre}</a></li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Informes ---------------- */
function Informes({ caseId, onCita }: { caseId: string; onCita: (c: Cita) => void }) {
  const { reports, kinds, reload } = useReports(caseId);
  const [kind, setKind] = useState("resumen_ejecutivo");
  const [sel, setSel] = useState<string | null>(null);
  const options = Object.entries(kinds).filter(([k]) => !["analisis_integral", "estrategia"].includes(k));
  const r = reports.find((x) => x.id === sel);
  return (
    <div>
      <h2 className="font-serif text-2xl text-white">Documentos e informes</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <ReportRunner key={kind} caseId={caseId} kind={kind} label="Generar informe" onDone={(x) => { reload(); setSel(x.id); }} onCita={onCita} />
      </div>
      <h3 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-400">Informes generados</h3>
      <ul className="mt-2 divide-y divide-ink-700 rounded-xl border border-ink-700 bg-ink-900">
        {reports.map((x) => (
          <li key={x.id} className="flex items-center gap-3 p-3 text-sm">
            <button className="flex-1 text-left text-white hover:text-gold-400" onClick={() => setSel(sel === x.id ? null : x.id)}>{kinds[x.kind] ?? x.kind}</button>
            <span className="text-xs text-ink-400">{new Date(x.created_at).toLocaleString("es-AR")}</span>
            <a className="text-xs text-gold-400" href={`/api/reports/${x.id}?format=pdf`}>PDF</a>
            <a className="text-xs text-gold-400" href={`/api/reports/${x.id}?format=docx`}>Word</a>
          </li>
        ))}
        {!reports.length && <li className="p-4 text-sm text-ink-400">Todavía no hay informes.</li>}
      </ul>
      {r && <ReportView report={r} onCita={onCita} />}
    </div>
  );
}

/* ---------------- Datos e importación ---------------- */
function Datos({ caseId, data, reload }: { caseId: string; data: CaseData; reload: () => void }) {
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState<{ items: { fecha: string; descripcion: string; tipo: string }[]; descartadas: string[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [np, setNp] = useState({ nombre: "", rol: "actor", identificador: "" });
  const [docEdit, setDocEdit] = useState<Record<string, Partial<Doc>>>({});

  async function previsualizar() {
    const r = await fetch(`/api/cases/${caseId}/movements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto, preview: true }) });
    setPreview(await r.json());
  }
  async function importar() {
    const r = await fetch(`/api/cases/${caseId}/movements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    const j = await r.json();
    setMsg(`${j.importados} movimiento(s) importado(s).`); setPreview(null); setTexto("");
  }
  async function party(partyId: string, action: "confirmar" | "eliminar") {
    await fetch(`/api/cases/${caseId}/parties`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId, action }) });
    reload();
  }
  async function addParty(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/cases/${caseId}/parties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(np) });
    setNp({ nombre: "", rol: "actor", identificador: "" }); reload();
  }
  async function saveDoc(id: string) {
    const body = docEdit[id];
    if (!body) return;
    await fetch(`/api/documents/${id}/pages`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setDocEdit({ ...docEdit, [id]: undefined as never }); reload();
  }
  const inp = "rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-sm outline-none focus:border-gold-500";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl text-white">Importar listado de movimientos</h2>
        <p className="mt-1 text-sm text-ink-400">Pegue el listado de trámites tal como lo copió de la MEV (consultada personalmente con su usuario) u otra fuente: una línea por movimiento que comience con la fecha (dd/mm/aaaa). Se muestran antes de importar.</p>
        <textarea className="mt-3 h-40 w-full rounded-md border border-ink-700 bg-ink-850 p-3 font-mono text-xs outline-none focus:border-gold-500" placeholder={"15/03/2024  AGREGA CONTESTACIÓN DE DEMANDA\n02/04/2024  PROVEÍDO - SE ABRE A PRUEBA"} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="mt-2 flex gap-2"><button onClick={previsualizar} className="rounded-md border border-ink-600 px-3 py-1.5 text-sm">Previsualizar</button>{preview && preview.items.length > 0 && <button onClick={importar} className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-ink-950">Importar {preview.items.length}</button>}</div>
        {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}
        {preview && (
          <div className="mt-3 rounded-md border border-ink-700 bg-ink-900 p-3 text-xs">
            {preview.items.map((m, i) => <div key={i} className="border-b border-ink-800 py-1"><span className="text-gold-400">{m.fecha}</span> · <span className="text-ink-400">{tipoLabel(m.tipo)}</span> · {m.descripcion}</div>)}
            {preview.descartadas.length > 0 && <div className="mt-2 text-amber-300">Líneas no reconocidas ({preview.descartadas.length}): {preview.descartadas.slice(0, 5).join(" | ")}</div>}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl text-white">Partes y sujetos procesales</h2>
        <ul className="mt-3 divide-y divide-ink-700 rounded-xl border border-ink-700 bg-ink-900 text-sm">
          {data.partes.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2.5">
              <span className="flex-1 text-white">{p.nombre} <span className="text-ink-400">({p.rol}{p.identificador ? `, ${p.identificador}` : ""})</span></span>
              {p.origen === "extraido_ia" ? <><span className="text-[11px] text-amber-400">extraída por IA</span><button className="text-xs text-gold-400" onClick={() => party(p.id, "confirmar")}>Confirmar</button></> : <span className="text-[11px] text-ink-400">verificada</span>}
              <button className="text-xs text-red-400" onClick={() => party(p.id, "eliminar")}>Quitar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={addParty} className="mt-2 flex flex-wrap gap-2">
          <input className={`${inp} flex-1`} placeholder="Nombre o razón social" value={np.nombre} onChange={(e) => setNp({ ...np, nombre: e.target.value })} required />
          <select className={inp} value={np.rol} onChange={(e) => setNp({ ...np, rol: e.target.value })}>{["actor", "demandado", "tercero", "perito", "testigo", "letrado", "otro"].map((r) => <option key={r}>{r}</option>)}</select>
          <input className={inp} placeholder="DNI / CUIT" value={np.identificador} onChange={(e) => setNp({ ...np, identificador: e.target.value })} />
          <button className="rounded-md border border-ink-600 px-3 text-sm">Agregar</button>
        </form>
      </section>

      <section>
        <h2 className="font-serif text-xl text-white">Clasificación de documentos</h2>
        <p className="mt-1 text-sm text-ink-400">La clasificación automática puede corregirse; la corrección manual prevalece.</p>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-ink-400"><tr><th className="p-1">Documento</th><th className="p-1">Tipo</th><th className="p-1">Fecha</th><th className="p-1">Título</th><th /></tr></thead>
          <tbody>
            {data.documentos.map((d) => {
              const e = docEdit[d.id] ?? {};
              return (
                <tr key={d.id} className="border-t border-ink-700">
                  <td className="p-1 text-xs text-ink-300">{d.filename}<div className="text-[10px] text-ink-400">{d.clasificacion_origen}{d.status_detail ? ` · ${d.status_detail}` : ""}</div></td>
                  <td className="p-1"><select className={inp} value={e.tipo ?? d.tipo} onChange={(x) => setDocEdit({ ...docEdit, [d.id]: { ...e, tipo: x.target.value } })}>{Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td className="p-1"><input type="date" className={inp} value={e.fecha ?? d.fecha ?? ""} onChange={(x) => setDocEdit({ ...docEdit, [d.id]: { ...e, fecha: x.target.value || null } })} /></td>
                  <td className="p-1"><input className={`${inp} w-full`} value={e.titulo ?? d.titulo ?? ""} onChange={(x) => setDocEdit({ ...docEdit, [d.id]: { ...e, titulo: x.target.value } })} /></td>
                  <td className="p-1">{docEdit[d.id] && <button className="text-xs text-gold-400" onClick={() => saveDoc(d.id)}>Guardar</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-serif text-xl text-white">Expedientes relacionados</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.relacionadas.map((r) => <li key={r.id}><Link className="text-gold-400 underline" href={`/causas/${r.id}`}>{r.caratula}</Link> <span className="text-ink-400">— {r.motivo}</span></li>)}
          {!data.relacionadas.length && <li className="text-ink-400">No se detectaron causas relacionadas entre las incorporadas.</li>}
        </ul>
      </section>
    </div>
  );
}
