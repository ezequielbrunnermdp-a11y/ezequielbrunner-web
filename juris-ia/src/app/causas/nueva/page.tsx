"use client";
import { useState } from "react";
import { Header } from "@/components/Header";
import { DEPARTAMENTOS_PBA, FUEROS } from "@/lib/taxonomy";

const input = "w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-gold-500";
const ROLES = ["actor", "demandado", "tercero", "perito", "testigo", "letrado", "otro"];
const ORIGENES = {
  mev_consulta_personal: "Consulta personal en la MEV con mi usuario",
  copia_expediente: "Copia del expediente (física o digital)",
  documentacion_cliente: "Documentación aportada por el cliente",
  otro: "Otro origen legítimo",
};

export default function NuevaCausa() {
  const [f, setF] = useState({ caratula: "", numero: "", receptoria: "", departamento: "", organismo: "", fuero: "", objeto: "", estado_procesal: "", origen: "mev_consulta_personal", autorizacion_acceso: "" });
  const [reservada, setReservada] = useState(false);
  const [licitud, setLicitud] = useState(false);
  const [partes, setPartes] = useState([{ nombre: "", rol: "actor", identificador: "" }, { nombre: "", rol: "demandado", identificador: "" }]);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, reservada, declaracion_licitud: licitud || undefined, partes: partes.filter((p) => p.nombre.trim()) }),
    });
    const j = await res.json();
    if (!res.ok) return setError(j.error);
    window.location.href = `/causas/${j.id}`;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-serif text-3xl text-white">Incorporar causa</h1>
          <p className="mt-1 text-sm text-ink-400">Registre los datos de la causa. Después podrá incorporar documentos (PDF, DOCX, HTML, TXT, imágenes) y el listado de movimientos.</p>
        </div>
        <section className="grid gap-3 rounded-xl border border-ink-700 bg-ink-900 p-5 md:grid-cols-2">
          <input className={`${input} md:col-span-2`} placeholder="Carátula *" value={f.caratula} onChange={set("caratula")} required />
          <input className={input} placeholder="N° de expediente" value={f.numero} onChange={set("numero")} />
          <input className={input} placeholder="N° de receptoría" value={f.receptoria} onChange={set("receptoria")} />
          <select className={input} value={f.departamento} onChange={set("departamento")}><option value="">Departamento judicial</option>{DEPARTAMENTOS_PBA.map((x) => <option key={x}>{x}</option>)}</select>
          <select className={input} value={f.fuero} onChange={set("fuero")}><option value="">Fuero</option>{FUEROS.map((x) => <option key={x}>{x}</option>)}</select>
          <input className={`${input} md:col-span-2`} placeholder="Organismo (p. ej. Juzgado Civil y Comercial N° 3)" value={f.organismo} onChange={set("organismo")} />
          <input className={input} placeholder="Objeto (p. ej. daños y perjuicios)" value={f.objeto} onChange={set("objeto")} />
          <input className={input} placeholder="Estado procesal" value={f.estado_procesal} onChange={set("estado_procesal")} />
        </section>
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Partes</h2>
          {partes.map((p, i) => (
            <div key={i} className="mb-2 grid grid-cols-12 gap-2">
              <input className={`${input} col-span-6`} placeholder="Nombre o razón social" value={p.nombre} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
              <select className={`${input} col-span-3`} value={p.rol} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, rol: e.target.value } : x)))}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              <input className={`${input} col-span-3`} placeholder="DNI / CUIT" value={p.identificador} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, identificador: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="text-sm text-gold-400" onClick={() => setPartes([...partes, { nombre: "", rol: "otro", identificador: "" }])}>+ Agregar parte</button>
        </section>
        <section className="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-5 text-sm">
          <h2 className="font-semibold text-white">Origen y legitimidad del acceso</h2>
          <select className={input} value={f.origen} onChange={set("origen")}>{Object.entries(ORIGENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="flex items-start gap-2"><input type="checkbox" checked={reservada} onChange={(e) => setReservada(e.target.checked)} className="mt-1" /> La causa es reservada (familia, menores, salud, etc.)</label>
          {reservada && <input className={input} placeholder="Fundamento de la autorización de acceso (p. ej. letrado apoderado de la parte actora) *" value={f.autorizacion_acceso} onChange={set("autorizacion_acceso")} required />}
          <label className="flex items-start gap-2"><input type="checkbox" checked={licitud} onChange={(e) => setLicitud(e.target.checked)} className="mt-1" required />
            <span>Declaro que obtuve la documentación de forma legítima, que tengo derecho a acceder a ella y que su tratamiento se ajusta a la Ley 25.326 de Protección de Datos Personales.</span></label>
        </section>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="rounded-md bg-gold-500 px-5 py-2 font-semibold text-ink-950 hover:bg-gold-400">Crear causa</button>
      </form>
    </div>
  );
}
