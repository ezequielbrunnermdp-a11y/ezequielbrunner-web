import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileText } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { uploadPrivate, uid } from '@/lib/storage';
import { fmtDate } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, Notice, PageHeader, Select, Switch } from '@/components/ui';
import { DOC_CAT, type Doc } from '../docs/DocumentsPage';
import { useLegalEntities } from './scope';

const SENSITIVE = ['payslip', 'contract', 'disciplinary', 'medical'];

export default function DocumentsAdmin() {
  const { can } = useAuth();
  const les = useLegalEntities();
  const [le, setLe] = useState('');
  const [owner, setOwner] = useState('');
  const [cat, setCat] = useState('general');
  const [title, setTitle] = useState('');
  const [ack, setAck] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const leId = le || les.data?.[0]?.id || '';
  const people = useQuery({ queryKey: ['admin-employees', 'docs'], queryFn: () => rpc<{ user_id: string; first_name: string; last_name: string; legal_entity: string; employee_code: string }[]>('admin_employees', {}) });
  const docs = useQuery({ queryKey: ['admin-docs', leId], enabled: Boolean(leId), queryFn: async () => {
    const { data, error } = await supabase.from('documents').select('*').eq('legal_entity_id', leId).order('published_at', { ascending: false }).limit(100);
    if (error) throw error; return data as Doc[];
  } });
  const leName = les.data?.find((l) => l.id === leId)?.legal_name;
  const sensitive = SENSITIVE.includes(cat);
  const upload = useAction(async () => {
    if (!file) throw new Error('Elegí un archivo');
    if (file.size > 20 * 1024 * 1024) throw new Error('El archivo supera 20 MB');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error('Solo PDF, JPG o PNG');
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const path = `le/${leId}/${owner ? `u/${owner}` : 'general'}/${uid()}.${ext}`;
    await uploadPrivate('documents', path, file, file.type);
    return rpc('register_document', { p_legal_entity: leId, p_owner: owner || null, p_category: cat, p_title: title.trim(), p_storage_path: path, p_mime: file.type, p_size: file.size, p_requires_ack: ack });
  }, { success: 'Documento publicado', invalidate: [['admin-docs', leId]], onDone: () => { setFile(null); setTitle(''); } });
  const names = new Map(people.data?.map((p) => [p.user_id, `${p.last_name}, ${p.first_name}`]));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Documentos" subtitle="Almacenamiento privado por razón social. Los archivos se abren solo con URLs temporales." />
      <Card className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razón social"><Select value={leId} onChange={(e) => setLe(e.target.value)}>{les.data?.map((l) => <option key={l.id} value={l.id}>{l.legal_name}</option>)}</Select></Field>
          <Field label="Categoría"><Select value={cat} onChange={(e) => setCat(e.target.value)}>{Object.entries(DOC_CAT).filter(([k]) => can('payroll.view') || !SENSITIVE.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <Field label="Destinatario" hint={sensitive ? 'Obligatorio para esta categoría' : 'Vacío = documento general para toda la razón social'}>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{sensitive ? 'Elegí una persona' : 'Documento general'}</option>
            {people.data?.filter((p) => p.legal_entity === leName).map((p) => <option key={p.user_id} value={p.user_id}>{p.last_name}, {p.first_name} ({p.employee_code})</option>)}</Select>
        </Field>
        <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Recibo de haberes octubre 2026" /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" hidden accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{file ? file.name : 'Elegir archivo'}</Button>
        </div>
        <Switch label="Solicitar confirmación de lectura" checked={ack} onChange={setAck} description="Registra que la persona indicó haberlo leído. No es una firma ni una notificación fehaciente." />
        <Notice tone="warn">Publicar un documento en el portal no constituye por sí solo una notificación fehaciente ni una firma con validez jurídica. Para recibos con firma o comunicaciones disciplinarias formales se requiere un mecanismo apto (validar con asesoría legal).</Notice>
        <div className="flex justify-end"><Button disabled={!file || title.trim().length < 2 || (sensitive && !owner)} loading={upload.isPending} onClick={() => upload.mutate(undefined)}>Publicar</Button></div>
      </Card>
      {docs.isLoading ? <LoadingList /> : !docs.data?.length ? <EmptyState icon={<FileText className="h-5 w-5" />} title="Sin documentos publicados" compact /> : (
        <Card className="overflow-hidden"><ul className="divide-y divide-line/70">{docs.data.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{d.title}</p><p className="text-xs text-ink-3">{DOC_CAT[d.category]} · {d.owner_user_id ? names.get(d.owner_user_id) ?? 'Personal' : 'General'} · {fmtDate(d.published_at)}</p></div>
            {d.requires_ack && <Badge>Con confirmación</Badge>}
          </li>
        ))}</ul></Card>
      )}
    </div>
  );
}
