import { Printer } from 'lucide-react';
import { useModule } from './useModule';
import { Blocks } from './Blocks';
import { MetaBadges, PageHeader } from '../../components/ui';
import { formatCivil, todayAR } from '../../lib/format';
import { questionsForModule } from '../../content/questions';
import { BRAND } from '../../brand.config';

/** Versión imprimible de un módulo, identificada como contenido pedagógico propuesto. */
export function PrintPage({ id }: { id: string }) {
  const m = useModule(id);
  if (!m) return <PageHeader title="Módulo no encontrado" />;
  const approved = m.meta.approvalStatus === 'aprobado';
  return (
    <article>
      <div className="row no-print" style={{ marginBottom: 20 }}>
        <a className="btn btn-ghost" href={`#/aprender/${m.id}`}>Volver al módulo</a>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer aria-hidden="true" />Imprimir</button>
      </div>
      <header style={{ borderBottom: '1px solid var(--line)', paddingBottom: 16, marginBottom: 20 }}>
        <p className="eyebrow">{BRAND.name} · {BRAND.subtitle}</p>
        <h1>Módulo {m.number}. {m.title}</h1>
        <MetaBadges meta={m.meta} />
        <p className="small" style={{ marginTop: 12 }}>
          <strong>{approved ? 'Material aprobado por El Cóndor.' : 'Material pedagógico propuesto, sin aprobación de El Cóndor. No constituye política oficial.'}</strong>{' '}
          Versión {m.meta.version} · {formatCivil(m.meta.updatedAt)} · Impreso el {formatCivil(todayAR())}.
        </p>
      </header>
      <p><strong>Objetivo:</strong> {m.objective}</p>
      <p>{m.intro}</p>
      {m.lessons.map((l) => (
        <section key={l.id} style={{ marginTop: 24 }}>
          <h2>{l.title}</h2>
          <Blocks blocks={l.blocks} />
        </section>
      ))}
      <section style={{ marginTop: 24 }}>
        <h2>Síntesis</h2>
        <ul>{m.synthesis.map((s) => <li key={s}>{s}</li>)}</ul>
        <p><em>{m.closing}</em></p>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Preguntas para repasar</h2>
        <ol>{questionsForModule(m.id).map((q) => <li key={q.id}><strong>{q.prompt}</strong><br />{q.expected}</li>)}</ol>
      </section>
    </article>
  );
}
