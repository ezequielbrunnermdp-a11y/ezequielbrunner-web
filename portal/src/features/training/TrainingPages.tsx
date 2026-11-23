import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ArrowLeft, CheckCircle2, Circle, PlayCircle, ExternalLink, Award, FileDown } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate, fullName } from '@/lib/format';
import { Badge, Button, Card, CardHeader, EmptyState, LoadingList, Notice, PageHeader } from '@/components/ui';

interface MyCourse { id: string; title: string; description: string | null; lessons: number; done: number; due_date: string | null; assigned: boolean; passed: boolean; certificate_code: string | null; best_score: number | null }

export function TrainingsPage() {
  const q = useQuery({ queryKey: ['my-courses'], queryFn: () => rpc<MyCourse[]>('my_courses') });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Capacitaciones" subtitle="Manuales, procedimientos y cursos" />
      {q.isLoading ? <LoadingList /> : !q.data?.length ? <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No hay capacitaciones disponibles" compact /> : (
        <ul className="space-y-3">
          {q.data.map((c) => {
            const pct = c.lessons ? Math.round((Number(c.done) / Number(c.lessons)) * 100) : 0;
            return (
              <Card as="li" key={c.id}>
                <Link to={`/capacitaciones/${c.id}`} className="block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{c.title}</p>
                    {c.passed ? <Badge tone="ok"><Award className="h-3 w-3" />Aprobada</Badge> : c.assigned ? <Badge tone="warn">Asignada</Badge> : null}
                  </div>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-ink-3">{c.description}</p>}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1.5 text-xs text-ink-3">{c.done}/{c.lessons} lecciones{c.due_date && ` · Vence ${fmtDate(c.due_date + 'T12:00:00')}`}</p>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface Lesson { id: string; position: number; title: string; kind: string; content: string | null; url: string | null }

export function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { ctx } = useAuth();
  const course = useQuery({ queryKey: ['course', id], queryFn: async () => { const { data, error } = await supabase.from('courses').select('*').eq('id', id!).maybeSingle(); if (error) throw error; return data as { id: string; title: string; description: string | null; pass_score: number } | null; } });
  const lessons = useQuery({ queryKey: ['lessons', id], queryFn: async () => { const { data, error } = await supabase.from('course_lessons').select('*').eq('course_id', id!).order('position'); if (error) throw error; return data as Lesson[]; } });
  const progress = useQuery({ queryKey: ['progress', id], queryFn: async () => { const { data } = await supabase.from('course_progress').select('lesson_id').eq('course_id', id!).eq('user_id', ctx!.user_id); return new Set((data ?? []).map((r) => r.lesson_id as string)); } });
  const quiz = useQuery({ queryKey: ['quiz', id], queryFn: () => rpc<{ id: string; question: string; options: string[] }[]>('course_quiz', { p_course: id }) });
  const mine = useQuery({ queryKey: ['my-courses'], queryFn: () => rpc<MyCourse[]>('my_courses'), select: (all) => all.find((c) => c.id === id) });
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; certificate_code: string | null } | null>(null);
  const complete = useAction((lid: string) => rpc('complete_lesson', { p_lesson: lid }), { invalidate: [['progress', id], ['my-courses']] });
  const submit = useAction(() => rpc<{ score: number; passed: boolean; certificate_code: string | null }>('submit_quiz', { p_course: id, p_answers: answers }), { onDone: setResult, invalidate: [['my-courses']] });

  const certificate = async (code: string) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(120);
    doc.text(ctx?.organization?.name ?? '', 148, 30, { align: 'center' });
    doc.setFontSize(28); doc.setTextColor(30); doc.text('Constancia interna de capacitación', 148, 60, { align: 'center' });
    doc.setFontSize(14); doc.text('Se deja constancia de que', 148, 82, { align: 'center' });
    doc.setFontSize(22); doc.text(fullName(ctx?.profile), 148, 96, { align: 'center' });
    doc.setFontSize(14); doc.text(`completó y aprobó la capacitación "${course.data?.title}"`, 148, 110, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Código de verificación interno: ${code} · Emitida ${fmtDate(new Date())}`, 148, 150, { align: 'center' });
    doc.text('Documento interno. No constituye certificación oficial ni habilitación profesional.', 148, 158, { align: 'center' });
    doc.save(`constancia-${code}.pdf`);
  };

  if (course.isLoading) return <LoadingList />;
  if (!course.data) return <EmptyState title="Capacitación no disponible" />;
  const allDone = lessons.data?.every((l) => progress.data?.has(l.id));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/capacitaciones" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="h-4 w-4" />Capacitaciones</Link>
      <PageHeader title={course.data.title} subtitle={course.data.description ?? undefined} />
      <Card><CardHeader title="Contenido" />
        <ul className="divide-y divide-line/70 px-2 pb-2">
          {lessons.data?.map((l) => {
            const done = progress.data?.has(l.id);
            return (
              <li key={l.id} className="px-3 py-3">
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)} aria-expanded={openLesson === l.id}>
                  {done ? <CheckCircle2 className="h-5 w-5 text-ok" /> : <Circle className="h-5 w-5 text-ink-3" />}
                  <span className="flex-1 font-medium">{l.title}</span>
                  {l.kind === 'video' && <PlayCircle className="h-4 w-4 text-ink-3" />}
                </button>
                {openLesson === l.id && (
                  <div className="ml-8 mt-3 space-y-3">
                    {l.content && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{l.content}</p>}
                    {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">{l.kind === 'video' ? 'Ver video' : 'Abrir material'}<ExternalLink className="h-3.5 w-3.5" /></a>}
                    {!done && <Button size="sm" variant="secondary" onClick={() => complete.mutate(l.id)}>Marcar como completada</Button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {(quiz.data?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Evaluación</h2>
          <p className="text-sm text-ink-3">Puntaje mínimo: {course.data.pass_score}%. {mine.data?.best_score != null && `Tu mejor resultado: ${mine.data.best_score}%.`}</p>
          {!allDone && <div className="mt-3"><Notice tone="info">Completá todas las lecciones antes de rendir.</Notice></div>}
          <ol className="mt-4 space-y-5">
            {quiz.data!.map((qq, i) => (
              <li key={qq.id}>
                <p className="font-medium">{i + 1}. {qq.question}</p>
                <div className="mt-2 space-y-1.5">
                  {qq.options.map((o, j) => (
                    <label key={j} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                      <input type="radio" name={qq.id} checked={answers[i] === j} onChange={() => setAnswers((a) => { const n = [...a]; n[i] = j; return n; })} />{o}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {result && <div className="mt-4"><Notice tone={result.passed ? 'ok' : 'warn'} title={result.passed ? `¡Aprobaste con ${result.score}%!` : `Obtuviste ${result.score}%`}>{result.passed ? 'Podés descargar tu constancia interna.' : 'Repasá el contenido y volvé a intentarlo.'}</Notice></div>}
          <Button className="mt-4" block disabled={!allDone || answers.filter((a) => a != null).length < quiz.data!.length} loading={submit.isPending} onClick={() => submit.mutate(undefined)}>Enviar respuestas</Button>
        </Card>
      )}
      {(result?.certificate_code || mine.data?.certificate_code) && (
        <Button variant="secondary" block icon={<FileDown className="h-4 w-4" />} onClick={() => void certificate((result?.certificate_code || mine.data?.certificate_code)!)}>Descargar constancia interna (PDF)</Button>
      )}
    </div>
  );
}
