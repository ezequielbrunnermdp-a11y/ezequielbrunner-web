import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import type { BrandSettings, Nonconformity } from '../lib/types';
import { NC_STATUS_LABEL, SEVERITY_LABEL, fmtDate, fmtDateTime, fmtScore, ALERT_TYPE_LABEL } from '../lib/format';
import { base, pdfColors, toneFor } from './theme';
import { Footer, HBarChart, Header, LineChart, Pill, SectionTitle, Table } from './parts';

export interface BranchStat {
  name: string;
  count: number;
  avg: number | null;
  last: number | null;
  lastDate: string | null;
  min: number | null;
  max: number | null;
  first: number | null;
  criticals: number;
  openNc: number;
}

export interface ConsolidatedData {
  brand: BrandSettings;
  logo: string | null;
  kind: 'mensual' | 'periodo' | 'consolidado' | 'evolucion';
  title: string;
  periodLabel: string;
  from: string;
  to: string;
  scopeLabel: string;
  audits: { branch: string; date: string; auditor: string; score: number; classification: string | null; critical: boolean; report: string | null }[];
  branches: BranchStat[];
  categories: { name: string; avg: number | null; n: number }[];
  evolution: { labels: string[]; series: { name: string; values: (number | null)[] }[] };
  findings: { branch: string; date: string; type: string; title: string; resolved: boolean }[];
  actions: { pending: number; inProgress: number; corrected: number; closed: number; overdue: number; closedInPeriod: number; list: Nonconformity[] };
  recommendations: string[];
  issuedAt: string;
  issuedBy: string;
}

const PALETTE = ['#2e2016', '#b08d3e', '#5a7a3a', '#3d6a8a', '#a33b2b', '#7a5c42', '#6b4f8a', '#2f6b4f', '#c0582b', '#8a7a2e'];

export function ConsolidatedReport({ d }: { d: ConsolidatedData }) {
  const c = pdfColors(d.brand);
  const audited = d.branches.filter((b) => b.count > 0);
  const chainAvg = d.audits.length ? d.audits.reduce((s, a) => s + a.score, 0) / d.audits.length : null;
  const ranking = [...audited].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const footer = `${d.title} · ${d.periodLabel}`;
  const lowCats = [...d.categories].filter((x) => x.avg != null).sort((a, b) => a.avg! - b.avg!).slice(0, 5);

  return (
    <Document title={`${d.title} ${d.periodLabel}`} author={d.brand.company_name} creator={d.brand.platform_name} language="es-AR">
      <Page size="A4" style={base.page}>
        <Header c={c} logo={d.logo} company={d.brand.company_name} title={d.title} />
        <Footer c={c} left={footer} />

        <View style={{ backgroundColor: c.primary, padding: 22, marginBottom: 16, borderRadius: 4 }}>
          {d.logo && <Image src={d.logo} style={{ height: 34, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 10 }} />}
          <Text style={{ fontSize: 8, color: c.accent, letterSpacing: 2.5, textTransform: 'uppercase' }}>El Cóndor — Informe general de franquicias</Text>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 24, color: '#ffffff', marginTop: 4 }}>{d.title}</Text>
          <Text style={{ fontSize: 10, color: c.cream, marginTop: 4 }}>{d.periodLabel} · {d.scopeLabel}</Text>
          <Text style={{ fontSize: 7.5, color: c.cream, marginTop: 6, opacity: 0.8 }}>Período analizado: {fmtDate(d.from)} al {fmtDate(d.to)} · Emitido el {fmtDateTime(d.issuedAt)} por {d.issuedBy}</Text>
        </View>

        {d.audits.length === 0 ? (
          <View style={{ borderWidth: 1, borderColor: c.warn, padding: 14 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: c.warn }}>No existen auditorías finalizadas registradas en el período seleccionado.</Text>
            <Text style={[base.p, { marginTop: 4 }]}>Este informe no presenta resultados estimados ni completa períodos sin datos.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'Auditorías', v: String(d.audits.length) },
                { l: 'Franquicias auditadas', v: `${audited.length} de ${d.branches.length}` },
                { l: 'Promedio de la cadena', v: fmtScore(chainAvg), col: toneFor(chainAvg, c) },
                { l: 'Hallazgos críticos', v: String(d.findings.length), col: d.findings.length ? c.bad : c.ok },
                { l: 'Acciones pendientes', v: String(d.actions.pending + d.actions.inProgress), col: d.actions.overdue ? c.bad : c.ink },
              ].map((k) => (
                <View key={k.l} style={{ flex: 1, borderWidth: 0.8, borderColor: c.line, borderRadius: 6, padding: 7 }}>
                  <Text style={{ fontSize: 6.3, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</Text>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 15, marginTop: 3, color: k.col ?? c.ink }}>{k.v}</Text>
                </View>
              ))}
            </View>

            <SectionTitle c={c} eyebrow="01">Ranking de sucursales</SectionTitle>
            <Table c={c} rows={ranking} cols={[
              { title: '#', width: '6%', render: (_b, i) => String(i + 1) },
              { title: 'Sucursal', width: '22%', render: (b) => b.name },
              { title: 'Auditorías', width: '11%', align: 'right', render: (b) => String(b.count) },
              { title: 'Promedio', width: '12%', align: 'right', render: (b) => <Text style={{ textAlign: 'right', fontFamily: 'Helvetica-Bold', color: toneFor(b.avg, c) }}>{fmtScore(b.avg)}</Text> },
              { title: 'Última', width: '17%', align: 'right', render: (b) => `${fmtScore(b.last)} (${fmtDate(b.lastDate)})` },
              { title: 'Mín – Máx', width: '14%', align: 'right', render: (b) => `${fmtScore(b.min)} – ${fmtScore(b.max)}` },
              { title: 'Críticos', width: '9%', align: 'right', render: (b) => String(b.criticals) },
              { title: 'NC abiertas', width: '9%', align: 'right', render: (b) => String(b.openNc) },
            ]} />
            {d.branches.some((b) => b.count === 0) && (
              <Text style={[base.small, { marginTop: 4 }]}>Sin auditorías en el período: {d.branches.filter((b) => b.count === 0).map((b) => b.name).join(', ')}.</Text>
            )}
            <Text style={[base.small, { marginTop: 3, marginBottom: 12 }]}>Los promedios comparan sucursales con distinta cantidad de auditorías: se indica la cantidad de cada una. Período utilizado: {fmtDate(d.from)} – {fmtDate(d.to)}.</Text>

            <View wrap={false}>
              <Text style={[base.h3, { marginBottom: 6 }]}>Comparación de puntaje promedio</Text>
              <HBarChart c={c} items={ranking.map((b) => ({ label: `${b.name} (${b.count})`, value: b.avg }))} colorFor={(v) => toneFor(v, c)} />
            </View>
          </>
        )}
      </Page>

      {d.audits.length > 0 && (
        <Page size="A4" style={base.page}>
          <Header c={c} logo={d.logo} company={d.brand.company_name} title={d.title} />
          <Footer c={c} left={footer} />
          <SectionTitle c={c} eyebrow="02">Evolución comparativa</SectionTitle>
          {d.evolution.labels.length > 1 ? (
            <View wrap={false}>
              <LineChart c={c} labels={d.evolution.labels} series={d.evolution.series.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 }}>
                {d.evolution.series.map((s, i) => (
                  <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, backgroundColor: PALETTE[i % PALETTE.length], marginRight: 3 }} />
                    <Text style={{ fontSize: 7 }}>{s.name}</Text>
                  </View>
                ))}
              </View>
              <Text style={[base.small, { marginTop: 4 }]}>Promedio mensual de puntaje por sucursal. Los meses sin auditoría no se completan ni se estiman.</Text>
            </View>
          ) : <Text style={base.p}>El período abarca un solo mes: la evolución se muestra con la comparación primera/última auditoría por sucursal.</Text>}
          <View style={{ marginTop: 10 }}>
            <Table c={c} rows={audited} cols={[
              { title: 'Sucursal', width: '30%', render: (b) => b.name },
              { title: 'Primera', width: '17%', align: 'right', render: (b) => fmtScore(b.first) },
              { title: 'Última', width: '17%', align: 'right', render: (b) => fmtScore(b.last) },
              { title: 'Variación', width: '18%', align: 'right', render: (b) => {
                if (b.count < 2 || b.first == null || b.last == null) return 'Una sola auditoría';
                const dv = b.last - b.first;
                return <Text style={{ textAlign: 'right', color: dv > 1 ? c.ok : dv < -1 ? c.bad : c.muted }}>{`${dv >= 0 ? '+' : ''}${fmtScore(dv)}`}</Text>;
              } },
              { title: 'Tendencia', width: '18%', render: (b) => b.count < 2 || b.first == null || b.last == null ? '—' : b.last - b.first > 1 ? 'Mejora' : b.last - b.first < -1 ? 'Retroceso' : 'Estable' },
            ]} />
          </View>

          <View style={{ marginTop: 16 }} wrap={false}>
            <SectionTitle c={c} eyebrow="03">Cumplimiento por categoría (cadena)</SectionTitle>
            <HBarChart c={c} items={d.categories.map((x) => ({ label: x.name, value: x.avg }))} colorFor={(v) => toneFor(v, c)} />
            {lowCats.length > 0 && <Text style={[base.p, { marginTop: 6 }]}>Categorías con menor cumplimiento: {lowCats.map((x) => `${x.name} (${fmtScore(x.avg)} %)`).join(', ')}.</Text>}
          </View>
        </Page>
      )}

      {d.audits.length > 0 && (
        <Page size="A4" style={base.page}>
          <Header c={c} logo={d.logo} company={d.brand.company_name} title={d.title} />
          <Footer c={c} left={footer} />
          <SectionTitle c={c} eyebrow="04">Hallazgos críticos</SectionTitle>
          {d.findings.length === 0 ? <Text style={base.p}>No se registraron hallazgos críticos en el período.</Text> : (
            <Table c={c} rows={d.findings} cols={[
              { title: 'Sucursal', width: '16%', render: (f) => f.branch },
              { title: 'Fecha', width: '12%', render: (f) => fmtDate(f.date) },
              { title: 'Tipo', width: '20%', render: (f) => ALERT_TYPE_LABEL[f.type as keyof typeof ALERT_TYPE_LABEL] ?? f.type },
              { title: 'Detalle', width: '38%', render: (f) => f.title },
              { title: 'Estado', width: '14%', render: (f) => <Pill text={f.resolved ? 'Resuelto' : 'Abierto'} color={f.resolved ? c.ok : c.bad} /> },
            ]} />
          )}

          <View style={{ marginTop: 16 }}>
            <SectionTitle c={c} eyebrow="05">Acciones correctivas</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {[
                ['Pendientes', d.actions.pending], ['En proceso', d.actions.inProgress], ['Corregidas sin verificar', d.actions.corrected],
                ['Cerradas en el período', d.actions.closedInPeriod], ['Vencidas', d.actions.overdue],
              ].map(([l, v]) => (
                <View key={l as string} style={{ flex: 1, backgroundColor: c.cream, padding: 6 }}>
                  <Text style={{ fontSize: 6.5, color: c.muted }}>{l}</Text>
                  <Text style={{ fontFamily: 'Times-Bold', fontSize: 13, color: l === 'Vencidas' && Number(v) > 0 ? c.bad : c.ink }}>{String(v)}</Text>
                </View>
              ))}
            </View>
            {d.actions.list.length > 0 && (
              <Table c={c} rows={d.actions.list.slice(0, 40)} cols={[
                { title: 'Sucursal', width: '14%', render: (n) => n.branches?.name ?? '' },
                { title: 'Incumplimiento', width: '38%', render: (n) => n.description },
                { title: 'Gravedad', width: '12%', render: (n) => SEVERITY_LABEL[n.severity] },
                { title: 'Límite', width: '12%', render: (n) => fmtDate(n.due_date) },
                { title: 'Estado', width: '24%', render: (n) => NC_STATUS_LABEL[n.status] },
              ]} />
            )}
            {d.actions.list.length > 40 && <Text style={base.small}>Se muestran 40 de {d.actions.list.length} acciones abiertas.</Text>}
          </View>

          <View style={{ marginTop: 16 }} wrap={false}>
            <SectionTitle c={c} eyebrow="06">Recomendaciones para gerencia</SectionTitle>
            {d.recommendations.map((r, i) => <Text key={i} style={base.p}>{i + 1}. {r}</Text>)}
            <Text style={[base.small, { marginTop: 6 }]}>Recomendaciones elaboradas automáticamente a partir de los datos registrados del período. Deben validarse con el criterio de la gerencia.</Text>
          </View>

          <View style={{ marginTop: 16 }}>
            <SectionTitle c={c} eyebrow="Anexo">Auditorías incluidas</SectionTitle>
            <Table c={c} rows={d.audits} cols={[
              { title: 'Fecha', width: '13%', render: (a) => fmtDate(a.date) },
              { title: 'Sucursal', width: '18%', render: (a) => a.branch },
              { title: 'Informe', width: '17%', render: (a) => a.report ?? '—' },
              { title: 'Auditor', width: '22%', render: (a) => a.auditor },
              { title: 'Puntaje', width: '10%', align: 'right', render: (a) => <Text style={{ textAlign: 'right', color: toneFor(a.score, c), fontFamily: 'Helvetica-Bold' }}>{fmtScore(a.score)}</Text> },
              { title: 'Clasificación', width: '20%', render: (a) => `${a.classification ?? ''}${a.critical ? ' · crítico' : ''}` },
            ]} />
          </View>
        </Page>
      )}
    </Document>
  );
}

export interface NcReportData {
  brand: BrandSettings;
  logo: string | null;
  scopeLabel: string;
  rows: Nonconformity[];
  issuedAt: string;
  issuedBy: string;
}

export function NcReport({ d }: { d: NcReportData }) {
  const c = pdfColors(d.brand);
  const today = new Date().toISOString().slice(0, 10);
  const groups = new Map<string, Nonconformity[]>();
  d.rows.forEach((n) => { const k = n.branches?.name ?? '—'; groups.set(k, [...(groups.get(k) ?? []), n]); });
  const title = 'Incumplimientos pendientes';
  return (
    <Document title={`${title} ${d.scopeLabel}`} author={d.brand.company_name} language="es-AR">
      <Page size="A4" style={base.page}>
        <Header c={c} logo={d.logo} company={d.brand.company_name} title={title} />
        <Footer c={c} left={`${title} · ${d.scopeLabel} · emitido ${fmtDateTime(d.issuedAt)}`} />
        <SectionTitle c={c} eyebrow="Seguimiento">{title}</SectionTitle>
        <Text style={[base.p, { marginBottom: 10 }]}>{d.scopeLabel} · {d.rows.length} incumplimiento(s) abiertos · {d.rows.filter((n) => n.due_date && n.due_date < today && (n.status === 'pendiente' || n.status === 'en_proceso')).length} vencido(s). Emitido por {d.issuedBy}.</Text>
        {d.rows.length === 0 && <Text style={base.p}>No existen incumplimientos pendientes para el alcance seleccionado.</Text>}
        {[...groups.entries()].map(([branch, rows]) => (
          <View key={branch} style={{ marginBottom: 12 }}>
            <Text style={[base.h3, { color: c.primary }]} minPresenceAhead={40}>{branch} ({rows.length})</Text>
            <Table c={c} rows={rows} cols={[
              { title: 'Incumplimiento', width: '30%', render: (n) => <View><Text>{n.description}</Text>{n.categories?.name && <Text style={{ fontSize: 6.5, color: c.muted }}>{n.categories.name}</Text>}</View> },
              { title: 'Gravedad', width: '10%', render: (n) => SEVERITY_LABEL[n.severity] },
              { title: 'Responsable', width: '14%', render: (n) => n.responsible || '—' },
              { title: 'Acción', width: '22%', render: (n) => n.recommended_action || '—' },
              { title: 'Límite', width: '10%', render: (n) => <Text style={{ color: n.due_date && n.due_date < today && n.status !== 'corregido' ? c.bad : c.ink }}>{fmtDate(n.due_date)}</Text> },
              { title: 'Estado', width: '14%', render: (n) => NC_STATUS_LABEL[n.status] },
            ]} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
