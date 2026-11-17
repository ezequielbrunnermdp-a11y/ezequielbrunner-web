"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileArchive, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Button, cx, Input, Label, Notice, Select } from "./ui";

interface Summary {
  importId: string;
  conversationId: string;
  conversationTitle: string;
  totalParsed: number;
  inserted: number;
  duplicates: number;
  systemMessages: number;
  dateOrder: string;
  warnings: string[];
}

const ORDER_LABEL: Record<string, string> = { DMY: "día/mes/año", MDY: "mes/día/año", YMD: "año-mes-día" };

export function Uploader({ conversations, branches }: { conversations: { id: string; title: string }[]; branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  const pick = (f: File | undefined) => {
    setError(null);
    setResult(null);
    if (!f) return;
    if (!/\.(txt|zip)$/i.test(f.name)) return setError("Formato no soportado. Elegí el .txt o .zip que exporta WhatsApp.");
    if (f.size > 25 * 1024 * 1024) return setError("El archivo supera el máximo de 25 MB.");
    setFile(f);
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("Elegí un archivo.");
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("file", file);
    if (target !== "new") fd.set("conversation_id", target);
    try {
      const res = await fetch("/api/imports", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo importar.");
      setResult(json);
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          className={cx(
            "relative grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
            drag ? "border-accent bg-accent/[0.06]" : "border-line-strong bg-bg/40 hover:border-accent/50",
          )}
        >
          {file ? (
            <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-surface-2 p-3 text-left ring-1 ring-inset ring-white/10">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                {/\.zip$/i.test(file.name) ? <FileArchive className="size-5" /> : <FileText className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted tabular">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" aria-label="Quitar archivo">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20"><UploadCloud className="size-5" /></span>
              <p className="text-sm font-medium">Arrastrá el archivo exportado o <button type="button" className="text-accent underline-offset-4 hover:underline" onClick={() => input.current?.click()}>elegilo</button></p>
              <p className="mt-1 text-xs text-muted">.txt o .zip de WhatsApp (Android o iPhone) · máx. 25 MB · los adjuntos no se guardan</p>
            </>
          )}
          <input ref={input} type="file" accept=".txt,.zip,text/plain,application/zip" className="sr-only" aria-label="Archivo de chat" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="target">Conversación</Label>
            <Select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">Nueva (o detectar por título)</option>
              {conversations.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>
          {target === "new" && (
            <div>
              <Label htmlFor="title" hint="opcional">Título</Label>
              <Input id="title" name="title" placeholder="Se toma del nombre del archivo" />
            </div>
          )}
          {target === "new" && (
            <div>
              <Label htmlFor="branch_id" hint="opcional">Sucursal</Label>
              <Select id="branch_id" name="branch_id" defaultValue="">
                <option value="">Varias / sin sucursal</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="date_order">Formato de fecha</Label>
            <Select id="date_order" name="date_order" defaultValue="auto">
              <option value="auto">Detectar automáticamente</option>
              <option value="DMY">Día/mes/año</option>
              <option value="MDY">Mes/día/año</option>
              <option value="YMD">Año-mes-día</option>
            </Select>
          </div>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Button type="submit" variant="primary" disabled={busy || !file} aria-busy={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" />Procesando…</> : "Importar"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="rounded-2xl bg-ok/[0.05] p-5 ring-1 ring-inset ring-ok/25 animate-fade-up" role="status">
          <div className="flex items-center gap-2 text-sm font-medium text-ok"><CheckCircle2 className="size-4" />Importación completa · {result.conversationTitle}</div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Leídos", result.totalParsed],
              ["Nuevos", result.inserted],
              ["Duplicados omitidos", result.duplicates],
              ["De sistema", result.systemMessages],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-bg/50 p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 text-xl font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Formato de fecha: {ORDER_LABEL[result.dateOrder] ?? result.dateOrder}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-warn">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
          <div className="mt-4">
            <Link href={`/conversations/${result.conversationId}`} className="text-sm font-medium text-accent hover:underline">
              Ver conversación y analizar →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
