import { useCallback, useEffect, useState } from 'react';
import { Plus, Copy, Send, Trash2, ChevronDown, ShieldAlert, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase, friendlyError } from '../../lib/supabase';
import { loadQuestionnaire } from '../../lib/api';
import { fmtDate, fmtScore } from '../../lib/format';
import type { Category, Question, QuestionnaireVersion } from '../../lib/types';
import { Card, ErrorBox, Field, Input, Loading, Modal, Notice, PageHeader, Select, Textarea, cx } from '../../components/ui';

const EXTRAS = [
  ['', 'Ninguno'], ['compra_prueba', 'Compra de prueba / cliente incógnito'], ['degustacion', 'Productos evaluados / degustación'],
  ['atribucion', 'Atribución franquicia / franquiciante'], ['caja', 'Datos de caja (manual / CSV / XLSX)'], ['indicadores', 'Indicadores comerciales'], ['club', 'Indicadores del Club'],
];

export default function Questionnaire() {
  const [versions, setVersions] = useState<QuestionnaireVersion[] | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [cats, setCats] = useState<Category[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});

  const loadVersions = useCallback(async () => {
    const { data } = await supabase.from('questionnaire_versions').select('*').order('number', { ascending: false });
    const vs = (data as QuestionnaireVersion[]) ?? [];
    setVersions(vs);
    const { data: au } = await supabase.from('audits').select('version_id');
    const u: Record<string, number> = {};
    (au ?? []).forEach((a: { version_id: string }) => { u[a.version_id] = (u[a.version_id] ?? 0) + 1; });
    setUsage(u);
    setSelected((cur) => cur || vs.find((v) => v.status === 'borrador')?.id || vs.find((v) => v.status === 'publicada')?.id || '');
  }, []);
  const loadCats = useCallback(async (id: string) => { if (id) setCats(await loadQuestionnaire(id, true)); }, []);
  useEffect(() => { loadVersions(); }, [loadVersions]);
  useEffect(() => { loadCats(selected); }, [selected, loadCats]);

  if (!versions) return <Loading />;
  const v = versions.find((x) => x.id === selected);
  const editable = v?.status === 'borrador';
  const total = cats.reduce((s, c) => s + Number(c.weight), 0);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, reload = true) => {
    setErr(null); setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return false; }
    if (reload) await loadCats(selected);
    return true;
  };

  const clone = async () => {
    setErr(null); setBusy(true);
    const { data, error } = await supabase.rpc('clone_questionnaire_version', { p_source: selected || null });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    setSelected(data as string);
    loadVersions();
  };
  const publish = async () => {
    const ok = await run(() => supabase.rpc('publish_questionnaire_version', { p_version: selected }), false);
    setConfirmPublish(false);
    if (ok) loadVersions();
  };
  const discard = async () => {
    if (!window.confirm('¿Eliminar este borrador de cuestionario?')) return;
    const ok = await run(() => supabase.from('questionnaire_versions').delete().eq('id', selected), false);
    if (ok) { setSelected(''); loadVersions(); }
  };

  const updCat = (c: Category, patch: Partial<Category>) => {
    setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  };
  const saveCat = (c: Category) => run(() => supabase.from('categories').update({ name: c.name, weight: Number(c.weight), description: c.description || null, extras: c.extras || null, kind: c.kind }).eq('id', c.id));
  const addCat = () => run(() => supabase.from('categories').insert({ version_id: selected, position: cats.length + 1, code: `categoria_${Date.now()}`, name: 'Nueva categoría', weight: 0 }));
  const delCat = (c: Category) => window.confirm(`¿Eliminar la categoría ${c.name} y sus preguntas?`) && run(() => supabase.from('categories').delete().eq('id', c.id));
  const updQ = (c: Category, q: Question, patch: Partial<Question>) => setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, questions: x.questions.map((y) => (y.id === q.id ? { ...y, ...patch } : y)) } : x)));
  const saveQ = (q: Question) => run(() => supabase.from('questions').update({ text: q.text, guidance: q.guidance || null, critical_control: q.critical_control, active: q.active }).eq('id', q.id));
  const addQ = (c: Category) => run(() => supabase.from('questions').insert({ category_id: c.id, position: c.questions.length + 1, text: 'Nueva pregunta' }));
  const delQ = (q: Question) => run(() => supabase.from('questions').delete().eq('id', q.id));
  const moveQ = async (c: Category, i: number, dir: -1 | 1) => {
    const a = c.questions[i], b = c.questions[i + dir];
    if (!a || !b) return;
    await run(async () => {
      const r1 = await supabase.from('questions').update({ position: b.position }).eq('id', a.id);
      if (r1.error) return r1;
      return supabase.from('questions').update({ position: a.position }).eq('id', b.id);
    });
  };

  return (
    <div className="fade-in space-y-5">
      <PageHeader eyebrow="Administración" title="Cuestionario y ponderaciones"
        subtitle="Las versiones publicadas no se modifican: cada auditoría conserva la versión y las ponderaciones con que se realizó. Para cambiar el cuestionario, cree un borrador y publíquelo."
        actions={<>
          {!versions.some((x) => x.status === 'borrador') && <button className="btn-outline" onClick={clone} disabled={busy}><Copy className="h-4 w-4" /> Nueva versión desde la seleccionada</button>}
          {editable && <button className="btn-ghost" onClick={discard}><Trash2 className="h-4 w-4" /> Descartar borrador</button>}
          {editable && <button className="btn-primary" onClick={() => setConfirmPublish(true)} disabled={busy}><Send className="h-4 w-4" /> Publicar</button>}
        </>} />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Versión" className="min-w-64">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {versions.map((x) => <option key={x.id} value={x.id}>Versión {x.number} · {x.status === 'publicada' ? 'Publicada (vigente)' : x.status === 'borrador' ? 'Borrador' : 'Archivada'}</option>)}
            </Select>
          </Field>
          {v && <div className="pb-3 text-sm text-cafe-500">{v.published_at ? `Publicada ${fmtDate(v.published_at)}` : `Creada ${fmtDate(v.created_at)}`} · {usage[v.id] ?? 0} auditoría(s) · {cats.reduce((s, c) => s + c.questions.filter((q) => q.active).length, 0)} preguntas</div>}
          <div className={cx('ml-auto rounded-xl px-4 py-2 text-sm font-semibold', total === 100 ? 'bg-[#2f6b4f]/10 text-[#2f6b4f]' : 'bg-[#a33b2b]/10 text-[#a33b2b]')}>Ponderaciones: {fmtScore(total, 2)} / 100</div>
        </div>
        {!editable && <div className="mt-3"><Notice>Versión de solo lectura. {versions.some((x) => x.status === 'borrador') ? 'Hay un borrador en edición.' : 'Cree una nueva versión para editar.'}</Notice></div>}
      </Card>
      <ErrorBox>{err}</ErrorBox>

      <div className="space-y-3">
        {cats.map((c) => (
          <Card key={c.id} className="p-0 sm:p-0">
            <button className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5" onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
              <span className="font-semibold">{c.position}. {c.name} <span className="ml-2 text-xs font-normal text-cafe-500">{c.questions.length} preguntas</span></span>
              <span className="flex items-center gap-3"><span className="chip bg-brand-accent/10 text-cafe-700">Peso {fmtScore(c.weight, 0)}</span><ChevronDown className={cx('h-4 w-4 transition', open[c.id] && 'rotate-180')} /></span>
            </button>
            {open[c.id] && (
              <div className="border-t border-cafe-800/10 px-4 py-4 sm:px-5">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Nombre" className="sm:col-span-2"><Input disabled={!editable} value={c.name} onChange={(e) => updCat(c, { name: e.target.value })} /></Field>
                  <Field label="Ponderación"><Input disabled={!editable} type="number" step="0.5" min={0} value={c.weight} onChange={(e) => updCat(c, { weight: Number(e.target.value) })} /></Field>
                  <Field label="Tipo"><Select disabled={!editable} value={c.kind} onChange={(e) => updCat(c, { kind: e.target.value as Category['kind'] })}><option value="puntaje">Puntaje</option><option value="documento">Documental (estado y vencimiento)</option></Select></Field>
                  <Field label="Datos complementarios" className="sm:col-span-2"><Select disabled={!editable} value={c.extras ?? ''} onChange={(e) => updCat(c, { extras: (e.target.value || null) as Category['extras'] })}>{EXTRAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                  <Field label="Descripción / criterio" className="sm:col-span-2"><Input disabled={!editable} value={c.description ?? ''} onChange={(e) => updCat(c, { description: e.target.value })} /></Field>
                </div>
                {editable && <div className="mt-3 flex gap-2"><button className="btn-outline px-3 py-1.5 text-xs" onClick={() => saveCat(c)}>Guardar categoría</button><button className="btn-ghost px-3 py-1.5 text-xs text-[#a33b2b]" onClick={() => delCat(c)}>Eliminar categoría</button></div>}
                <ol className="mt-4 space-y-2">
                  {c.questions.map((q, i) => (
                    <li key={q.id} className={cx('rounded-xl border border-cafe-800/10 p-3', !q.active && 'opacity-50')}>
                      <div className="flex items-start gap-2">
                        <span className="mt-2.5 w-6 text-xs text-cafe-400">{i + 1}</span>
                        <div className="flex-1 space-y-2">
                          <Textarea rows={1} disabled={!editable} value={q.text} onChange={(e) => updQ(c, q, { text: e.target.value })} />
                          <Input disabled={!editable} placeholder="Guía para el auditor (opcional)" value={q.guidance ?? ''} onChange={(e) => updQ(c, q, { guidance: e.target.value })} />
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!editable} checked={q.critical_control} onChange={(e) => updQ(c, q, { critical_control: e.target.checked })} /><ShieldAlert className="h-3.5 w-3.5 text-[#a33b2b]" /> Control crítico</label>
                            <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!editable} checked={q.active} onChange={(e) => updQ(c, q, { active: e.target.checked })} /> Activa</label>
                            {editable && <>
                              <button className="btn-outline px-2.5 py-1 text-xs" onClick={() => saveQ(q)}>Guardar</button>
                              <button className="btn-ghost p-1" onClick={() => moveQ(c, i, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                              <button className="btn-ghost p-1" onClick={() => moveQ(c, i, 1)} aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                              <button className="btn-ghost p-1 text-[#a33b2b]" onClick={() => delQ(q)} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                {editable && <button className="btn-outline mt-3 px-3 py-1.5 text-xs" onClick={() => addQ(c)}><Plus className="h-4 w-4" /> Agregar pregunta</button>}
              </div>
            )}
          </Card>
        ))}
        {editable && <button className="btn-outline" onClick={addCat}><Plus className="h-4 w-4" /> Agregar categoría</button>}
      </div>

      <Modal open={confirmPublish} onClose={() => setConfirmPublish(false)} title="Publicar versión"
        footer={<><button className="btn-ghost" onClick={() => setConfirmPublish(false)}>Cancelar</button><button className="btn-primary" onClick={publish} disabled={busy || total !== 100}>Publicar versión {v?.number}</button></>}>
        <p className="text-sm text-cafe-700">La versión {v?.number} pasará a ser la vigente para las nuevas auditorías. La versión anterior se archiva; las auditorías existentes conservan su versión original y sus ponderaciones.</p>
        {total !== 100 && <div className="mt-3"><Notice tone="warn">Las ponderaciones suman {fmtScore(total, 2)}: deben sumar 100. Guarde las categorías antes de publicar.</Notice></div>}
      </Modal>
    </div>
  );
}
