"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { DEPARTAMENTOS_PBA, FUEROS } from "@/lib/taxonomy";

type Hit = {
  id: string; caratula: string; numero: string | null; receptoria: string | null; departamento: string | null; organismo: string | null;
  fuero: string | null; estado_procesal: string | null; reservada: boolean; documentos: number;
  coincidencias: { nombre: string; rol: string; identificador: string | null }[];
};
type Fuente = { fuente: string; consultada: boolean; detalle: string; url?: string };
type Homonimo = { nombre: string; motivo: string; causas: { id: string; caratula: string; rol: string; identificador: string | null }[] };

const input = "w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-gold-500";

export default function Buscador() {
  const [f, setF] = useState({ q: "", numero: "", receptoria: "", departamento: "", organismo: "", fuero: "" });
  const [res, setRes] = useState<{ resultados: Hit[]; homonimos: Homonimo[]; fuentes: Fuente[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ claude: { configurado: boolean; modelo: string }; busqueda: string; jurisprudenciaWeb: boolean } | null>(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v.trim()));
    const r = await fetch(`/api/cases?${qs}`);
    setBusy(false);
    if (r.status === 401) return (window.location.href = "/login");
    setRes(await r.json());
  }
  useEffect(() => {
    buscar();
    fetch("/api/status").then((r) => (r.ok ? r.json() : null)).then(setStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="font-serif text-3xl text-white">Buscador judicial</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-400">
          Busque por nombre, apellido o razón social, carátula, número de expediente o receptoría, departamento judicial, organismo y fuero. Coincidencias parciales e insensibles a tildes.
        </p>
        <form onSubmit={buscar} className="mt-6 grid gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5 md:grid-cols-6">
          <div className="md:col-span-6">
            <input className={`${input} text-base`} placeholder="Nombre, apellido, razón social o carátula (p. ej. “Gómez c/ Transportes”)" value={f.q} onChange={set("q")} />
          </div>
          <input className={`${input} md:col-span-2`} placeholder="N° de expediente" value={f.numero} onChange={set("numero")} />
          <input className={`${input} md:col-span-2`} placeholder="N° de receptoría" value={f.receptoria} onChange={set("receptoria")} />
          <select className={`${input} md:col-span-2`} value={f.fuero} onChange={set("fuero")}>
            <option value="">Todos los fueros</option>
            {FUEROS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={`${input} md:col-span-3`} value={f.departamento} onChange={set("departamento")}>
            <option value="">Todos los departamentos judiciales</option>
            {DEPARTAMENTOS_PBA.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input className={`${input} md:col-span-2`} placeholder="Organismo (juzgado, tribunal…)" value={f.organismo} onChange={set("organismo")} />
          <button className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400 disabled:opacity-50" disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button>
        </form>

        {res && (
          <section className="mt-5 rounded-xl border border-ink-700 bg-ink-900 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Fuentes consultadas en esta búsqueda</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {res.fuentes.map((x) => (
                <li key={x.fuente} className="flex gap-3">
                  <span className={`mt-0.5 h-5 shrink-0 rounded px-1.5 text-[11px] font-semibold leading-5 ${x.consultada ? "bg-emerald-900/60 text-emerald-300" : "bg-ink-700 text-ink-300"}`}>{x.consultada ? "CONSULTADA" : "NO CONSULTADA"}</span>
                  <span><span className="text-ink-100">{x.fuente}.</span> <span className="text-ink-400">{x.detalle}</span>{x.url && <> <a className="text-gold-400 underline" href={x.url} target="_blank" rel="noreferrer">Abrir sitio oficial</a></>}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {res && res.homonimos.length > 0 && (
          <section className="mt-5 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4">
            <h2 className="text-sm font-semibold text-amber-300">Posibles homónimos</h2>
            {res.homonimos.map((h) => (
              <div key={h.nombre} className="mt-2 text-sm">
                <span className="font-medium text-white">{h.nombre}</span> — <span className="text-amber-200/80">{h.motivo}</span>
                <ul className="ml-4 list-disc text-ink-300">
                  {h.causas.map((c) => <li key={c.id}><Link className="hover:text-white" href={`/causas/${c.id}`}>{c.caratula}</Link> ({c.rol}{c.identificador ? `, ${c.identificador}` : ", sin identificador"})</li>)}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section className="mt-6">
          {res?.resultados.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-600 p-8 text-center text-sm text-ink-400">
              No hay causas incorporadas que coincidan. <Link href="/causas/nueva" className="text-gold-400 underline">Incorporar una causa</Link> con la documentación obtenida legítimamente (MEV, copias, cliente).
            </div>
          )}
          <ul className="space-y-3">
            {res?.resultados.map((h) => (
              <li key={h.id}>
                <Link href={`/causas/${h.id}`} className="block rounded-xl border border-ink-700 bg-ink-900 p-4 transition hover:border-gold-500">
                  <div className="flex items-start justify-between gap-4">
                    <div className="font-serif text-lg text-white">{h.caratula}</div>
                    {h.reservada && <span className="rounded bg-red-900/50 px-2 text-xs text-red-300">RESERVADA</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-400">
                    <span>Expte. {h.numero ?? "—"}</span><span>Receptoría {h.receptoria ?? "—"}</span><span>{h.departamento ?? "Depto. —"}</span><span>{h.organismo ?? "Organismo —"}</span><span>{h.fuero ?? "Fuero —"}</span><span>{h.documentos} documento(s)</span>
                  </div>
                  {h.coincidencias.length > 0 && <div className="mt-2 text-xs text-gold-400">Coincide: {h.coincidencias.map((c) => `${c.nombre} (${c.rol})`).join(" · ")}</div>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {status && (
          <footer className="mt-10 border-t border-ink-700 pt-4 text-xs text-ink-400">
            Integraciones activas: Claude {status.claude.configurado ? `✓ (${status.claude.modelo})` : "✗ sin configurar"} · Recuperación {status.busqueda} · Jurisprudencia web {status.jurisprudenciaWeb ? "✓ dominios oficiales" : "✗ deshabilitada"} · MEV ✗ (importación manual)
          </footer>
        )}
      </main>
    </div>
  );
}
