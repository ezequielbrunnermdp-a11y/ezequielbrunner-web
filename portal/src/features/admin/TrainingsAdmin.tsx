import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, BookOpen, Users } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { Badge, Button, Card, EmptyState, Field, Input, LoadingList, PageHeader, Select, Sheet, Textarea } from '@/components/ui';

interface Course { id: string; title: string; description: string | null; pass_score: number; active: boolean }

export default function TrainingsAdmin() {
  const { ctx } = useAuth();
  const [sel, setSel] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const courses = useQuery({ queryKey: ['courses-admin'], queryFn: async () => { const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false }); if (error) throw error; return data as Course[]; } });
  const create = useAction(async () => {
    const { data, error } = await supabase.from('courses').insert({ organization_id: ctx!.organization!.id, title: title.trim(), created_by: ctx!.user_id }).select().single();
    if (error) throw error; return data as Course;
  }, { invalidate: [['courses-admin']], onDone: (c) => { setTitle(''); setSel(c); } });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Capacitaciones" subtitle="Cursos, materiales, evaluaciones y asignaciones" />
      <Card className="flex gap-2 p-4"><Input placeholder="Título de la nueva capacitación" value={title} onChange={(e) => setTitle(e.target.value)} /><Button icon={<Plus className="h-4 w-4" />} disabled={title.trim().length < 3} onClick={() => create.mutate(undefined)}>Crear</Button></Card>
      {courses.isLoading ? <LoadingList /> : !courses.data?.length ? <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Todavía no hay capacitaciones" compact /> : (
        <ul className="space-y-2.5">{courses.data.map((c) => (
          <Card as="li" key={c.id}><button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setSel(c)}><span className="font-medium">{c.title}</span><Badge tone={c.active ? 'ok' : 'neutral'}>{c.active ? 'Activa' : 'Inactiva'}</Badge></button></Card>
        ))}</ul>
      )}
      {sel && <CourseEditor course={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function CourseEditor({ course, onClose }: { course: Course; onClose: () => void }) {
  const [desc, setDesc] = useState(course.description ?? '');
  const [score, setScore] = useState(String(course.pass_score));
  const lessons = useQuery({ queryKey: ['lessons', course.id], queryFn: async () => { const { data } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('position'); return data ?? []; } });
  const questions = useQuery({ queryKey: ['questions', course.id], queryFn: async () => { const { data } = await supabase.from('course_questions').select('*').eq('course_id', course.id).order('position'); return data ?? []; } });
  const progress = useQuery({ queryKey: ['course-progress', course.id], queryFn: async () => {
    const [a, c] = await Promise.all([supabase.from('course_assignments').select('user_id').eq('course_id', course.id), supabase.from('course_completions').select('user_id, passed').eq('course_id', course.id)]);
    return { assigned: a.data?.length ?? 0, passed: new Set((c.data ?? []).filter((x) => x.passed).map((x) => x.user_id)).size };
  } });
  const [l, setL] = useState({ title: '', kind: 'text', content: '', url: '' });
  const [qq, setQq] = useState({ question: '', options: '', correct: '0' });
  const save = useAction(async () => { const { error } = await supabase.from('courses').update({ description: desc || null, pass_score: Number(score) }).eq('id', course.id); if (error) throw error; }, { success: 'Guardado', invalidate: [['courses-admin']] });
  const addLesson = useAction(async () => {
    const { error } = await supabase.from('course_lessons').insert({ course_id: course.id, position: (lessons.data?.length ?? 0) + 1, title: l.title.trim(), kind: l.kind, content: l.content || null, url: l.url || null });
    if (error) throw error;
  }, { invalidate: [['lessons', course.id]], onDone: () => setL({ title: '', kind: 'text', content: '', url: '' }) });
  const addQ = useAction(async () => {
    const options = qq.options.split('\n').map((o) => o.trim()).filter(Boolean);
    const { error } = await supabase.from('course_questions').insert({ course_id: course.id, position: (questions.data?.length ?? 0) + 1, question: qq.question.trim(), options, correct_index: Number(qq.correct) });
    if (error) throw error;
  }, { invalidate: [['questions', course.id]], onDone: () => setQq({ question: '', options: '', correct: '0' }) });
  const people = useQuery({ queryKey: ['admin-employees', 'training'], queryFn: () => rpc<{ user_id: string; first_name: string; last_name: string; branch_id: string; branch_name: string }[]>('admin_employees', { p_status: 'active' }) });
  const [branch, setBranch] = useState('');
  const [due, setDue] = useState('');
  const assign = useAction(() => rpc<number>('assign_course', { p_course: course.id, p_users: (people.data ?? []).filter((p) => !branch || p.branch_id === branch).map((p) => p.user_id), p_due: due || null }), { success: (n) => `Asignada a ${n} persona(s)`, invalidate: [['course-progress', course.id]] });
  const branches = [...new Map((people.data ?? []).map((p) => [p.branch_id, p.branch_name])).entries()];
  return (
    <Sheet open onClose={onClose} title={course.title} wide footer={<Button onClick={onClose}>Listo</Button>}>
      <div className="space-y-6">
        <section className="space-y-3">
          <Field label="Descripción"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[64px]" /></Field>
          <div className="flex items-end gap-2"><Field label="Puntaje mínimo (%)"><Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} /></Field><Button variant="secondary" onClick={() => save.mutate(undefined)}>Guardar</Button></div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Lecciones ({lessons.data?.length ?? 0})</h3>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">{lessons.data?.map((x: { id: string; title: string; kind: string }) => <li key={x.id}>{x.title} <span className="text-ink-3">· {x.kind}</span></li>)}</ol>
          <div className="space-y-2 rounded-xl bg-surface-2 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]"><Input placeholder="Título" value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} /><Select value={l.kind} onChange={(e) => setL({ ...l, kind: e.target.value })}><option value="text">Texto</option><option value="video">Video</option><option value="link">Enlace</option></Select></div>
            {l.kind === 'text' ? <Textarea placeholder="Contenido / procedimiento" value={l.content} onChange={(e) => setL({ ...l, content: e.target.value })} /> : <Input placeholder="https://…" value={l.url} onChange={(e) => setL({ ...l, url: e.target.value })} />}
            <Button size="sm" disabled={!l.title.trim() || (l.kind !== 'text' && !/^https:\/\//.test(l.url))} onClick={() => addLesson.mutate(undefined)}>Agregar lección</Button>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Evaluación ({questions.data?.length ?? 0} preguntas)</h3>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">{questions.data?.map((x: { id: string; question: string }) => <li key={x.id}>{x.question}</li>)}</ol>
          <div className="space-y-2 rounded-xl bg-surface-2 p-3">
            <Input placeholder="Pregunta" value={qq.question} onChange={(e) => setQq({ ...qq, question: e.target.value })} />
            <Textarea placeholder="Opciones, una por línea" value={qq.options} onChange={(e) => setQq({ ...qq, options: e.target.value })} className="min-h-[72px]" />
            <div className="flex items-center gap-2"><span className="text-sm text-ink-2">Correcta: opción</span><Input type="number" min={1} max={6} className="h-9 w-20" value={Number(qq.correct) + 1} onChange={(e) => setQq({ ...qq, correct: String(Number(e.target.value) - 1) })} /></div>
            <Button size="sm" disabled={!qq.question.trim() || qq.options.split('\n').filter((o) => o.trim()).length < 2} onClick={() => addQ.mutate(undefined)}>Agregar pregunta</Button>
          </div>
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Asignación y seguimiento</h3>
          <p className="mb-2 text-sm text-ink-2">{progress.data?.assigned ?? 0} asignadas · {progress.data?.passed ?? 0} aprobadas</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">Todo el personal a mi cargo</option>{branches.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Vencimiento" />
            <Button loading={assign.isPending} onClick={() => assign.mutate(undefined)}>Asignar</Button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
