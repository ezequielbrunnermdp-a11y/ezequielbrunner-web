import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Flag, Gift, PartyPopper, BarChart2, Lightbulb, Trash2 } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDateTime, zonedToUtc } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, Notice, PageHeader, Segmented, Select, Switch, Textarea } from '@/components/ui';
import { useBrands, useBranchesWith } from './scope';

type Tab = 'publish' | 'reports' | 'benefits' | 'events' | 'polls' | 'suggestions';

export default function CommunityAdmin() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('publish');
  const opts = [
    { value: 'publish' as Tab, label: 'Comunicado' }, ...(can('community.moderate') ? [{ value: 'reports' as Tab, label: 'Denuncias' }] : []),
    { value: 'benefits' as Tab, label: 'Beneficios' }, { value: 'events' as Tab, label: 'Eventos' }, { value: 'polls' as Tab, label: 'Encuestas' },
    ...(can('community.moderate') ? [{ value: 'suggestions' as Tab, label: 'Sugerencias' }] : []),
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Comunidad institucional" subtitle="El contenido institucional se distingue visualmente del contenido social." />
      <Segmented value={tab} onChange={setTab} options={opts} />
      {tab === 'publish' && <Publish />}
      {tab === 'reports' && <Reports />}
      {tab === 'benefits' && <Benefits />}
      {tab === 'events' && <Events />}
      {tab === 'polls' && <Polls />}
      {tab === 'suggestions' && <Suggestions />}
    </div>
  );
}

const TYPES: Record<string, string> = { announcement: 'Comunicado', event: 'Evento', new_hire: 'Nuevo ingreso', recognition: 'Reconocimiento', benefit: 'Beneficio', training: 'Capacitación', birthday: 'Cumpleaños', branch_news: 'Novedad de sucursal' };

function Publish() {
  const { can } = useAuth();
  const brands = useBrands();
  const branches = useBranchesWith('community.publish');
  const [type, setType] = useState('announcement');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('org');
  const [pin, setPin] = useState(false);
  const [days, setDays] = useState('7');
  const post = useAction(() => rpc('create_post', {
    p_body: body.trim(), p_kind: 'institutional', p_inst_type: type,
    p_branch_id: target.startsWith('branch:') ? target.slice(7) : null, p_brand_id: target.startsWith('brand:') ? target.slice(6) : null,
    p_pinned_until: pin ? new Date(Date.now() + Number(days) * 864e5).toISOString() : null,
  }), { success: 'Publicado', invalidate: [['feed'], ['pinned']], onDone: () => { setBody(''); setPin(false); } });
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-sm font-medium"><Megaphone className="h-4 w-4 text-accent" />Nueva publicación institucional</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Destinatarios"><Select value={target} onChange={(e) => setTarget(e.target.value)}>
          {can('community.publish') && <option value="org">Toda la organización</option>}
          {brands.data?.map((b) => <option key={b.id} value={`brand:${b.id}`}>Marca: {b.name}</option>)}
          {branches.data.map((b) => <option key={b.id} value={`branch:${b.id}`}>Sucursal: {b.name}</option>)}
        </Select></Field>
      </div>
      <Field label="Texto"><Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6} /></Field>
      <Switch label="Fijar en el inicio" checked={pin} onChange={setPin} />
      {pin && <Field label="Días fijado"><Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} /></Field>}
      <Notice tone="info">No incluyas datos personales sensibles (salarios, sanciones, salud) en publicaciones.</Notice>
      <div className="flex justify-end"><Button disabled={!body.trim()} loading={post.isPending} onClick={() => post.mutate(undefined)}>Publicar</Button></div>
    </Card>
  );
}

interface Report { id: string; entity: string; entity_id: string; reason: string; details: string | null; reporter_excerpt: string | null; status: string; created_at: string }
function Reports() {
  const q = useQuery({ queryKey: ['reports'], queryFn: async () => { const { data, error } = await supabase.from('content_reports').select('*').in('status', ['open', 'reviewing']).order('created_at'); if (error) throw error; return data as Report[]; } });
  const mod = useAction((v: { id: string; action: string }) => rpc('moderate_report', { p_report: v.id, p_action: v.action }), { success: 'Acción registrada en auditoría', invalidate: [['reports']] });
  const R: Record<string, string> = { spam: 'Spam', harassment: 'Acoso', inappropriate: 'Inapropiado', privacy: 'Privacidad', other: 'Otro' };
  const E: Record<string, string> = { post: 'Publicación', comment: 'Comentario', message: 'Mensaje privado', user: 'Perfil' };
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<Flag className="h-5 w-5" />} title="No hay denuncias abiertas" compact />;
  return (
    <ul className="space-y-3">{q.data.map((r) => (
      <Card as="li" key={r.id} className="p-4">
        <div className="flex items-center justify-between gap-2"><p className="font-semibold">{E[r.entity]} · {R[r.reason]}</p><span className="text-xs text-ink-3">{fmtDateTime(r.created_at)}</span></div>
        {r.details && <p className="mt-1 text-sm">{r.details}</p>}
        {r.entity === 'message' && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{r.reporter_excerpt ? <>Extracto compartido por quien denuncia: “{r.reporter_excerpt}”</> : 'La persona no compartió el contenido. Los mensajes privados no son accesibles para moderación.'}</p>}
        {r.entity === 'post' && <a href={`/comunidad/post/${r.entity_id}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-accent">Ver publicación</a>}
        <div className="mt-3 flex gap-2">
          {['post', 'comment'].includes(r.entity) && <Button size="sm" variant="danger" onClick={() => mod.mutate({ id: r.id, action: 'hide' })}>Ocultar contenido</Button>}
          <Button size="sm" variant="secondary" onClick={() => mod.mutate({ id: r.id, action: 'dismiss' })}>Desestimar</Button>
        </div>
      </Card>
    ))}</ul>
  );
}

function Benefits() {
  const { ctx } = useAuth();
  const q = useQuery({ queryKey: ['benefits-admin'], queryFn: async () => { const { data } = await supabase.from('benefits').select('*').order('created_at', { ascending: false }); return data ?? []; } });
  const [f, setF] = useState({ title: '', description: '', provider: '', how: '', until: '' });
  const add = useAction(async () => {
    const { error } = await supabase.from('benefits').insert({ organization_id: ctx!.organization!.id, title: f.title.trim(), description: f.description || null, provider: f.provider || null, how_to_use: f.how || null, valid_until: f.until || null });
    if (error) throw error;
  }, { success: 'Beneficio publicado', invalidate: [['benefits-admin'], ['benefits']], onDone: () => setF({ title: '', description: '', provider: '', how: '', until: '' }) });
  const toggle = useAction(async (v: { id: string; active: boolean }) => { const { error } = await supabase.from('benefits').update({ active: v.active }).eq('id', v.id); if (error) throw error; }, { invalidate: [['benefits-admin'], ['benefits']] });
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium"><Gift className="h-4 w-4 text-accent" />Nuevo beneficio</p>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Proveedor" optional><Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} /></Field></div>
        <Field label="Descripción" optional><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[64px]" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Cómo usarlo" optional><Input value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} /></Field><Field label="Vigente hasta" optional><Input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></Field></div>
        <div className="flex justify-end"><Button disabled={f.title.trim().length < 2} loading={add.isPending} onClick={() => add.mutate(undefined)}>Publicar</Button></div>
      </Card>
      <ul className="space-y-2">{q.data?.map((b: { id: string; title: string; active: boolean }) => (
        <Card as="li" key={b.id} className="flex items-center justify-between p-3.5"><span className="font-medium">{b.title}</span><div className="flex items-center gap-2"><Badge tone={b.active ? 'ok' : 'neutral'}>{b.active ? 'Activo' : 'Inactivo'}</Badge><Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: b.id, active: !b.active })}>{b.active ? 'Desactivar' : 'Activar'}</Button></div></Card>
      ))}</ul>
    </div>
  );
}

function Events() {
  const { ctx } = useAuth();
  const [f, setF] = useState({ title: '', description: '', kind: 'social', date: '', time: '19:00', location: '' });
  const q = useQuery({ queryKey: ['events'], queryFn: async () => { const { data } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(30); return data ?? []; } });
  const add = useAction(async () => {
    const { error } = await supabase.from('events').insert({ organization_id: ctx!.organization!.id, title: f.title.trim(), description: f.description || null, kind: f.kind, starts_at: zonedToUtc(f.date, f.time), location: f.location || null, created_by: ctx!.user_id });
    if (error) throw error;
  }, { success: 'Evento creado', invalidate: [['events']], onDone: () => setF({ ...f, title: '', description: '', location: '' }) });
  const del = useAction(async (id: string) => { const { error } = await supabase.from('events').delete().eq('id', id); if (error) throw error; }, { invalidate: [['events']] });
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 text-sm font-medium"><PartyPopper className="h-4 w-4 text-accent" />Nuevo evento</p>
        <Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="social">Social</option><option value="celebration">Celebración</option><option value="training">Capacitación</option><option value="meeting">Reunión</option></Select></Field>
          <Field label="Fecha"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Hora"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Lugar" optional><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="Descripción" optional><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[64px]" /></Field>
        <div className="flex justify-end"><Button disabled={!f.title.trim() || !f.date} loading={add.isPending} onClick={() => add.mutate(undefined)}>Crear</Button></div>
      </Card>
      <ul className="space-y-2">{q.data?.map((e: { id: string; title: string; starts_at: string }) => (
        <Card as="li" key={e.id} className="flex items-center justify-between p-3.5"><span><span className="font-medium">{e.title}</span> <span className="text-sm text-ink-3">· {fmtDateTime(e.starts_at)}</span></span><Button size="sm" variant="ghost" aria-label="Eliminar" icon={<Trash2 className="h-4 w-4" />} onClick={() => del.mutate(e.id)} /></Card>
      ))}</ul>
    </div>
  );
}

function Polls() {
  const { ctx } = useAuth();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('Sí\nNo');
  const [closes, setCloses] = useState('');
  const add = useAction(async () => {
    const opts = options.split('\n').map((o) => o.trim()).filter(Boolean).slice(0, 8);
    const { error } = await supabase.from('polls').insert({ organization_id: ctx!.organization!.id, question: question.trim(), options: opts, closes_at: closes ? zonedToUtc(closes, '23:59') : null, created_by: ctx!.user_id });
    if (error) throw error;
  }, { success: 'Encuesta publicada', invalidate: [['polls']], onDone: () => setQuestion('') });
  return (
    <Card className="space-y-3 p-5">
      <p className="flex items-center gap-2 text-sm font-medium"><BarChart2 className="h-4 w-4 text-accent" />Nueva encuesta</p>
      <Field label="Pregunta"><Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} /></Field>
      <Field label="Opciones" hint="Una por línea (2 a 8)"><Textarea value={options} onChange={(e) => setOptions(e.target.value)} /></Field>
      <Field label="Cierra el" optional><Input type="date" value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
      <Notice tone="info">Los resultados se muestran agregados. No se ofrece anonimato técnico: se registra quién votó para evitar votos duplicados, aunque ningún rol de la aplicación puede ver votos individuales.</Notice>
      <div className="flex justify-end"><Button disabled={question.trim().length < 5} loading={add.isPending} onClick={() => add.mutate(undefined)}>Publicar</Button></div>
    </Card>
  );
}

function Suggestions() {
  const { ctx } = useAuth();
  const q = useQuery({ queryKey: ['suggestions-admin'], queryFn: async () => { const { data, error } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false }); if (error) throw error; return data as { id: string; title: string; body: string; status: string; response: string | null; created_at: string }[]; } });
  const [resp, setResp] = useState<Record<string, string>>({});
  const upd = useAction(async (v: { id: string; status: string }) => { const { error } = await supabase.from('suggestions').update({ status: v.status, response: resp[v.id] || null, responded_by: ctx!.user_id }).eq('id', v.id); if (error) throw error; }, { success: 'Respuesta guardada', invalidate: [['suggestions-admin']] });
  if (q.isLoading) return <LoadingList />;
  if (!q.data?.length) return <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="Sin sugerencias" compact />;
  return (
    <ul className="space-y-3">{q.data.map((s) => (
      <Card as="li" key={s.id} className="p-4">
        <p className="font-semibold">{s.title}</p><p className="mt-1 text-sm">{s.body}</p><p className="mt-1 text-xs text-ink-3">{fmtDateTime(s.created_at)}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input className="h-9 text-sm" placeholder="Respuesta" defaultValue={s.response ?? ''} onChange={(e) => setResp((r) => ({ ...r, [s.id]: e.target.value }))} />
          <Select className="h-9 text-sm sm:w-44" value={s.status} onChange={(e) => upd.mutate({ id: s.id, status: e.target.value })}>
            <option value="received">Recibida</option><option value="under_review">En análisis</option><option value="planned">Planificada</option><option value="done">Implementada</option><option value="declined">Descartada</option>
          </Select>
        </div>
      </Card>
    ))}</ul>
  );
}
