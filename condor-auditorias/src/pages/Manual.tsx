import { useEffect, useState } from 'react';
import { BookOpen, Upload, FileText, EyeOff, Eye } from 'lucide-react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';
import { signedUrl } from '../lib/files';
import { fmtDate } from '../lib/format';
import { Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Textarea } from '../components/ui';

interface Doc { id: string; title: string; description: string | null; version_label: string | null; storage_path: string | null; active: boolean; created_at: string }

export default function Manual() {
  const { isAdmin } = useSession();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [ver, setVer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => supabase.from('manual_documents').select('*').order('created_at', { ascending: false }).then(({ data }) => setDocs((data as Doc[]) ?? []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim() || !file) return setErr('Indique un título y seleccione el archivo.');
    setBusy(true); setErr(null);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const up = await supabase.storage.from('manual').upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setErr(friendlyError(up.error)); }
    const { error } = await supabase.from('manual_documents').insert({ title, description: desc || null, version_label: ver || null, storage_path: path });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    setTitle(''); setDesc(''); setVer(''); setFile(null); load();
  };
  const open = async (d: Doc) => { if (!d.storage_path) return; const u = await signedUrl(d.storage_path, 'manual'); if (u) window.open(u, '_blank', 'noopener'); };
  const toggle = async (d: Doc) => { await supabase.from('manual_documents').update({ active: !d.active }).eq('id', d.id); load(); };

  if (!docs) return <Loading />;
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Referencia" title="Manual operativo y estándares" subtitle="Documentos oficiales vigentes cargados por la administración." />
      {isAdmin && (
        <Card className="mb-5" title="Cargar documento">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Título *"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Manual operativo" /></Field>
            <Field label="Versión"><Input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="Ej.: 2026-1" /></Field>
            <Field label="Archivo (PDF o imagen) *"><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <Field label="Descripción" className="sm:col-span-3"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          </div>
          <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={add} disabled={busy}><Upload className="h-4 w-4" /> Cargar</button></div>
          <ErrorBox>{err}</ErrorBox>
        </Card>
      )}
      {docs.length === 0 ? <Empty title="Todavía no se cargaron documentos" icon={<BookOpen className="h-8 w-8" />}>La administración puede cargar el manual operativo y los estándares de la cadena.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id} className={d.active ? '' : 'opacity-60'}>
              <div className="flex items-start gap-3">
                <FileText className="h-6 w-6 shrink-0 text-brand-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{d.title}{d.version_label && <span className="ml-2 text-xs text-cafe-500">v. {d.version_label}</span>}</div>
                  {d.description && <p className="mt-1 text-sm text-cafe-600">{d.description}</p>}
                  <div className="mt-1 text-xs text-cafe-400">Cargado {fmtDate(d.created_at)}{!d.active && ' · Archivado'}</div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => open(d)}>Abrir</button>
                    {isAdmin && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => toggle(d)}>{d.active ? <><EyeOff className="h-3.5 w-3.5" /> Archivar</> : <><Eye className="h-3.5 w-3.5" /> Activar</>}</button>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
