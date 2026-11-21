import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import type { Answer, Audit, BrandSettings, Branch, Category, CategoryState, Nonconformity, ScoreResult } from '../lib/types';
import { AUDIT_TYPE_LABEL, DOC_STATUS_LABEL, NC_STATUS_LABEL, SEVERITY_LABEL, fmtDate, fmtDateLong, fmtDateTime, fmtScore, ALERT_TYPE_LABEL } from '../lib/format';
import { SCALE } from '../lib/scoring';
import { base, pdfColors, toneFor } from './theme';
import { Footer, HBarChart, Header, KV, Pill, SectionTitle, Table } from './parts';

export interface ReportPhoto { id: string; questionId: string | null; nonconformityId: string | null; dataUrl: string; caption: string | null }

export interface AuditReportData {
  brand: BrandSettings;
  logo: string | null;
  /** Logo en blanco para fondos oscuros (portada). */
  logoLight?: string | null;
  audit: Audit;
  branch: Branch;
  versionNumber: number;
  categories: Category[];
  answers: Record<string, Answer>;
  states: Record<string, CategoryState>;
  result: ScoreResult;
  nonconformities: Nonconformity[];
  photos: ReportPhoto[];
  omittedPhotos: number;
  previous: { visit_date: string; final_score: number; classification: string | null } | null;
  alerts: { type: string; title: string }[];
  issuedAt: string;
  issuedBy: string;
}

const scaleLabel = (s: number | null) => SCALE.find((x) => x.value === s)?.label ?? '';

export function AuditReport({ d }: { d: AuditReportData }) {
  const c = pdfColors(d.brand);
  const r = d.result;
  const score = d.audit.final_score ?? r.final_score;
  const cls = d.audit.classification ?? r.classification;
  const tone = toneFor(score, c);
  const applicable = r.categories.filter((x) => x.applicable && x.pct != null);
  const strengths = [...applicable].sort((a, b) => (b.pct! - a.pct!) || b.weight - a.weight).slice(0, 3).filter((x) => x.pct! >= 80);
  const weaknesses = [...applicable].sort((a, b) => (a.pct! - b.pct!) || b.weight - a.weight).slice(0, 3).filter((x) => x.pct! < 90);
  const critical = d.nonconformities.filter((n) => n.severity === 'critica');
  const criticalAnswers = d.categories.flatMap((cat) => cat.questions.filter((q) => d.answers[q.id]?.is_critical).map((q) => ({ cat: cat.name, q: q.text, obs: d.answers[q.id]?.observation })));
  const delta = d.previous && score != null ? score - d.previous.final_score : null;
  const title = 'Informe de auditoría';
  const footerLeft = `${d.audit.report_number ?? 'Borrador'} · ${d.branch.name} · ${fmtDate(d.audit.visit_date)}${d.audit.revision > 1 ? ` · Revisión ${d.audit.revision}` : ''}`;
  const photosFor = (qid: string) => d.photos.filter((p) => p.questionId === qid && !p.nonconformityId);
  const ncPhotos = d.photos.filter((p) => p.nonconformityId);

  return (
    <Document title={`${title} ${d.branch.name} ${d.audit.visit_date}`} author={d.brand.company_name} subject="Informe de auditoría de franquicia" creator={d.brand.platform_name} language="es-AR">
      {/* PORTADA */}
      <Page size="A4" style={{ fontFamily: 'Helvetica', color: c.ink, backgroundColor: c.paper }}>
        <View style={{ height: 300, backgroundColor: c.primary, paddingHorizontal: 48, paddingTop: 56, justifyContent: 'space-between', paddingBottom: 36 }}>
          <View>
            {d.logoLight ?? d.logo ? <Image src={(d.logoLight ?? d.logo)!} style={{ height: 64, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 18 }} /> : null}
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 26, color: c.cream, letterSpacing: 3 }}>{d.brand.company_name}</Text>
            <View style={{ width: 54, height: 2, backgroundColor: c.accent, marginTop: 12 }} />
          </View>
          <View>
            <Text style={{ fontSize: 9, color: c.accent, letterSpacing: 3, textTransform: 'uppercase' }}>Informe de auditoría</Text>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 34, color: '#ffffff', marginTop: 6 }}>Sucursal {d.branch.name}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 48, paddingTop: 34, flexGrow: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ width: '58%', flexDirection: 'row', flexWrap: 'wrap' }}>
              <KV c={c} label="Fecha de auditoría" value={fmtDateLong(d.audit.visit_date)} width="100%" />
              <KV c={c} label="Auditor responsable" value={d.audit.auditor_name} width="100%" />
              <KV c={c} label="Número de informe" value={d.audit.report_number ?? 'Borrador (sin numerar)'} />
              <KV c={c} label="Tipo de auditoría" value={AUDIT_TYPE_LABEL[d.audit.audit_type]} />
              <KV c={c} label="Encargado presente" value={d.audit.manager_present || '—'} />
              <KV c={c} label="Cuestionario" value={`Versión ${d.versionNumber}`} />
            </View>
            <View style={{ width: '36%', borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 7.5, color: c.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>Calificación final</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: 46, color: tone, marginTop: 6 }}>{fmtScore(score, 2)}</Text>
              <Text style={{ fontSize: 9, color: c.muted }}>sobre 100 puntos</Text>
              <View style={{ marginTop: 10, backgroundColor: tone, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff', letterSpacing: 1 }}>{cls ?? '—'}</Text>
              </View>
            </View>
          </View>
          {(critical.length > 0 || criticalAnswers.length > 0) && (
            <View style={{ marginTop: 22, borderLeftWidth: 3, borderLeftColor: c.bad, backgroundColor: '#a33b2b10', padding: 10 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: c.bad }}>ALERTA: se registraron irregularidades críticas</Text>
              <Text style={{ fontSize: 8, marginTop: 2 }}>La alerta es independiente de la calificación final. Ver «Riesgos críticos» en el resumen ejecutivo.</Text>
            </View>
          )}
          {d.audit.status !== 'finalizada' && (
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.warn, padding: 8 }}>
              <Text style={{ fontSize: 8.5, color: c.warn, fontFamily: 'Helvetica-Bold' }}>BORRADOR — Auditoría no finalizada. Resultado provisional.</Text>
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: 48, paddingBottom: 30 }}>
          <Text style={{ fontSize: 7.5, color: c.muted }}>{d.brand.platform_name} · {d.brand.subtitle}</Text>
          <Text style={{ fontSize: 7.5, color: c.muted, marginTop: 2 }}>Emitido el {fmtDateTime(d.issuedAt)} · Documento confidencial de uso interno de la red de franquicias.</Text>
        </View>
      </Page>

      {/* RESUMEN EJECUTIVO + RESULTADOS */}
      <Page size="A4" style={base.page}>
        <Header c={c} logo={d.logo} company={d.brand.company_name} title={title} />
        <Footer c={c} left={footerLeft} />
        <SectionTitle c={c} eyebrow="01">Resumen ejecutivo</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {[
            { l: 'Puntaje total', v: `${fmtScore(score, 2)} / 100`, col: tone },
            { l: 'Resultado general', v: cls ?? '—', col: tone },
            { l: 'Incumplimientos', v: String(d.nonconformities.length), col: c.ink },
            { l: 'Vs. auditoría anterior', v: delta == null ? 'Sin antecedente' : `${delta >= 0 ? '+' : ''}${fmtScore(delta)} pts`, col: delta == null ? c.muted : delta >= 0 ? c.ok : c.bad },
          ].map((k) => (
            <View key={k.l} style={{ flex: 1, borderWidth: 0.8, borderColor: c.line, borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 6.5, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{k.l}</Text>
              <Text style={{ fontFamily: 'Times-Bold', fontSize: k.v.length > 12 ? 11 : 14, color: k.col, marginTop: 3 }}>{k.v}</Text>
            </View>
          ))}
        </View>
        {d.previous && <Text style={[base.small, { marginBottom: 8 }]}>Auditoría anterior: {fmtDate(d.previous.visit_date)} · {fmtScore(d.previous.final_score)} puntos ({d.previous.classification}).</Text>}

        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={[base.h3, { color: c.ok }]}>Principales fortalezas</Text>
            {strengths.length ? strengths.map((s) => <Text key={s.code} style={base.p}>• {s.name}: {fmtScore(s.pct)} % de cumplimiento</Text>) : <Text style={base.p}>No se identifican categorías con 80 % o más de cumplimiento.</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[base.h3, { color: c.bad }]}>Principales debilidades</Text>
            {weaknesses.length ? weaknesses.map((s) => <Text key={s.code} style={base.p}>• {s.name}: {fmtScore(s.pct)} % de cumplimiento</Text>) : <Text style={base.p}>Todas las categorías superan el 90 % de cumplimiento.</Text>}
          </View>
        </View>

        <Text style={[base.h3, { marginTop: 8, color: c.bad }]}>Riesgos críticos</Text>
        {critical.length === 0 && criticalAnswers.length === 0 && <Text style={base.p}>No se registraron irregularidades críticas.</Text>}
        {critical.map((n) => <Text key={n.id} style={base.p}>• {n.alert_type ? ALERT_TYPE_LABEL[n.alert_type] + ': ' : ''}{n.description}</Text>)}
        {criticalAnswers.filter((x) => !critical.some((n) => n.description === x.obs)).map((x, i) => <Text key={i} style={base.p}>• {x.cat} — {x.q}{x.obs ? `: ${x.obs}` : ''}</Text>)}
        {d.alerts.some((a) => a.type === 'reiteracion') && (
          <Text style={[base.p, { color: c.warn }]}>• Se detectaron {d.alerts.filter((a) => a.type === 'reiteracion').length} falta(s) reiterada(s) respecto de la auditoría anterior.</Text>
        )}

        <Text style={[base.h3, { marginTop: 8 }]}>Recomendaciones generales</Text>
        <Text style={base.p}>{d.audit.recommendations || 'Sin recomendaciones generales registradas.'}</Text>

        {r.redistributed && (
          <View style={{ marginTop: 8, backgroundColor: c.cream, padding: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>Constancia de redistribución de ponderaciones</Text>
            <Text style={{ fontSize: 8, marginTop: 2 }}>
              Las siguientes categorías no aplicaron y su ponderación se redistribuyó proporcionalmente entre las aplicables (peso aplicable {fmtScore(r.applicable_weight, 0)} de {fmtScore(r.total_weight, 0)}):
              {' '}{r.categories.filter((x) => !x.applicable).map((x) => `${x.name}${x.na_reason ? ` (${x.na_reason})` : ''}`).join('; ')}.
            </Text>
          </View>
        )}

        <View break />
        <SectionTitle c={c} eyebrow="02">Resultados por categoría</SectionTitle>
        <Table c={c} rows={r.categories} cols={[
          { title: 'Categoría', width: '36%', render: (x) => `${x.name}` },
          { title: 'Ponderación', width: '14%', align: 'right', render: (x) => x.applicable ? `${fmtScore(x.weight, 0)}${x.effective_weight && Math.abs(x.effective_weight - x.weight) > 0.001 ? ` (${fmtScore(x.effective_weight, 2)})` : ''}` : `${fmtScore(x.weight, 0)} (N/A)` },
          { title: 'Puntaje', width: '13%', align: 'right', render: (x) => x.score == null ? '—' : fmtScore(x.score, 2) },
          { title: 'Cumplimiento', width: '15%', align: 'right', render: (x) => x.pct == null ? 'N/A' : `${fmtScore(x.pct)} %` },
          { title: 'Estado', width: '22%', render: (x) => x.pct == null ? <Text style={{ color: c.muted }}>No aplica</Text> : <Pill text={x.pct >= 90 ? 'EXCELENTE' : x.pct >= 80 ? 'SATISFACTORIA' : x.pct >= 70 ? 'EN OBSERVACIÓN' : 'DEFICIENTE'} color={toneFor(x.pct, c)} /> },
        ]} />
        <View style={[base.row, { borderTopWidth: 0.8, borderTopColor: c.primary, paddingVertical: 5 }]}>
          <Text style={[base.td, { width: '36%', fontFamily: 'Helvetica-Bold' }]}>TOTAL</Text>
          <Text style={[base.td, { width: '14%', textAlign: 'right' }]}>{fmtScore(r.total_weight, 0)}</Text>
          <Text style={[base.td, { width: '13%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: tone }]}>{fmtScore(score, 2)}</Text>
          <Text style={[base.td, { width: '37%' }]}>{cls}</Text>
        </View>
        <Text style={[base.small, { marginTop: 4, marginBottom: 14 }]}>Puntaje de categoría = ponderación × (puntos obtenidos / puntos máximos aplicables). Entre paréntesis, la ponderación efectiva luego de redistribuir categorías no aplicables. Clasificación: 90–100 Excelente · 80–89,99 Satisfactoria · 70–79,99 En observación · menos de 70 Deficiente.</Text>
        <View wrap={false}>
          <Text style={[base.h3, { marginBottom: 6 }]}>Porcentaje de cumplimiento por categoría</Text>
          <HBarChart c={c} items={r.categories.map((x) => ({ label: `${x.name}`, value: x.pct, note: 'N/A' }))} colorFor={(v) => toneFor(v, c)} />
        </View>
      </Page>

      {/* DETALLE COMPLETO */}
      <Page size="A4" style={base.page}>
        <Header c={c} logo={d.logo} company={d.brand.company_name} title={title} />
        <Footer c={c} left={footerLeft} />
        <SectionTitle c={c} eyebrow="03">Detalle completo de controles</SectionTitle>
        {d.audit.initial_notes && <Text style={[base.p, { marginBottom: 8 }]}>Observaciones iniciales: {d.audit.initial_notes}</Text>}
        {d.categories.map((cat) => {
          const st = d.states[cat.id];
          const cr = r.categories.find((x) => x.category_id === cat.id);
          const extras = st?.extras ?? {};
          return (
            <View key={cat.id} style={{ marginBottom: 12 }}>
              <View minPresenceAhead={60} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.primary, paddingHorizontal: 8, paddingVertical: 5 }}>
                <Text style={{ color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{cat.position}. {cat.name.toUpperCase()}</Text>
                <Text style={{ color: c.cream, fontSize: 8 }}>Ponderación {fmtScore(cat.weight, 0)} · {cr?.pct == null ? 'No aplica' : `${fmtScore(cr.pct)} %`}</Text>
              </View>
              {st?.not_applicable ? (
                <Text style={[base.p, { padding: 6 }]}>Categoría no aplicable. Justificación: {st.na_reason}</Text>
              ) : cat.questions.filter((q) => q.active).map((q, i) => {
                const a = d.answers[q.id];
                const ph = photosFor(q.id);
                const ncs = d.nonconformities.filter((n) => n.question_id === q.id);
                const sc = a?.not_applicable ? null : a?.score ?? null;
                return (
                  <View key={q.id} wrap={false} style={{ borderBottomWidth: 0.5, borderBottomColor: c.line, paddingVertical: 5, paddingHorizontal: 4, backgroundColor: a?.is_critical ? '#a33b2b0d' : undefined }}>
                    <View style={base.row}>
                      <Text style={{ width: '6%', fontSize: 8, color: c.muted }}>{i + 1}</Text>
                      <Text style={{ width: '74%', fontSize: 8.5 }}>{q.text}{a?.is_critical ? '  [CRÍTICO]' : ''}</Text>
                      <View style={{ width: '20%', alignItems: 'flex-end' }}>
                        {a?.not_applicable ? <Text style={{ fontSize: 8.5, color: c.muted }}>N/A</Text> : (
                          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: toneFor(sc == null ? null : sc * 20, c) }}>{sc ?? '—'} / 5</Text>
                        )}
                        {sc != null && <Text style={{ fontSize: 6.5, color: c.muted }}>{scaleLabel(sc)}</Text>}
                      </View>
                    </View>
                    {(a?.observation || a?.na_reason || a?.recommendation || a?.doc_status) && (
                      <View style={{ marginLeft: '6%', marginTop: 2 }}>
                        {a?.not_applicable && a.na_reason && <Text style={{ fontSize: 7.5, color: c.muted }}>Motivo N/A: {a.na_reason}</Text>}
                        {a?.doc_status && <Text style={{ fontSize: 7.5 }}>Documentación: {DOC_STATUS_LABEL[a.doc_status]}{a.doc_expiry ? ` · vence ${fmtDate(a.doc_expiry)}` : ''}</Text>}
                        {a?.observation && <Text style={{ fontSize: 7.5 }}>Observación: {a.observation}</Text>}
                        {a?.recommendation && <Text style={{ fontSize: 7.5, color: c.muted }}>Recomendación: {a.recommendation}</Text>}
                      </View>
                    )}
                    {ncs.map((n) => (
                      <Text key={n.id} style={{ marginLeft: '6%', marginTop: 2, fontSize: 7.5, color: c.bad }}>
                        Acción correctiva ({SEVERITY_LABEL[n.severity]}): {n.recommended_action || n.description}{n.due_date ? ` · límite ${fmtDate(n.due_date)}` : ''}
                      </Text>
                    ))}
                    {ph.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginLeft: '6%', marginTop: 4, gap: 4 }}>
                        {ph.slice(0, 4).map((p) => <Image key={p.id} src={p.dataUrl} style={{ width: 118, height: 88, objectFit: 'cover', borderRadius: 2 }} />)}
                      </View>
                    )}
                  </View>
                );
              })}
              <ExtrasBlock kind={cat.extras} extras={extras} c={c} />
            </View>
          );
        })}
        {d.omittedPhotos > 0 && <Text style={base.small}>Se omitieron {d.omittedPhotos} fotografía(s) adicional(es) para mantener un tamaño de archivo adecuado; están disponibles en la plataforma.</Text>}
      </Page>

      {/* PLAN DE ACCIONES + CIERRE */}
      <Page size="A4" style={base.page}>
        <Header c={c} logo={d.logo} company={d.brand.company_name} title={title} />
        <Footer c={c} left={footerLeft} />
        <SectionTitle c={c} eyebrow="04">Plan de acciones correctivas</SectionTitle>
        {d.nonconformities.length === 0 ? <Text style={base.p}>No se registraron incumplimientos en esta auditoría.</Text> : (
          <Table c={c} rows={d.nonconformities} cols={[
            { title: 'Incumplimiento', width: '30%', render: (n) => <View><Text>{n.description}</Text>{n.attributable_to === 'franquiciante' && <Text style={{ fontSize: 6.5, color: c.muted }}>Atribuible a la franquiciante</Text>}</View> },
            { title: 'Gravedad', width: '11%', render: (n) => <Pill text={SEVERITY_LABEL[n.severity]} color={n.severity === 'critica' ? c.bad : n.severity === 'grave' ? '#c0582b' : n.severity === 'moderada' ? c.warn : c.good} /> },
            { title: 'Responsable', width: '14%', render: (n) => n.responsible || '—' },
            { title: 'Acción', width: '23%', render: (n) => n.recommended_action || '—' },
            { title: 'Límite', width: '10%', render: (n) => fmtDate(n.due_date) },
            { title: 'Estado', width: '12%', render: (n) => NC_STATUS_LABEL[n.status] },
          ]} />
        )}
        {ncPhotos.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={base.h3}>Evidencia fotográfica de incumplimientos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ncPhotos.slice(0, 12).map((p) => (
                <View key={p.id} wrap={false} style={{ width: 160 }}>
                  <Image src={p.dataUrl} style={{ width: 160, height: 120, objectFit: 'cover' }} />
                  <Text style={{ fontSize: 6.5, color: c.muted, marginTop: 2 }}>{d.nonconformities.find((n) => n.id === p.nonconformityId)?.description.slice(0, 70)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 18 }} wrap={false}>
          <SectionTitle c={c} eyebrow="05">Cierre</SectionTitle>
          <Text style={base.h3}>Conclusión del auditor</Text>
          <Text style={base.p}>{d.audit.conclusion || 'Sin conclusión registrada.'}</Text>
          <Text style={[base.h3, { marginTop: 6 }]}>Recomendaciones</Text>
          <Text style={base.p}>{d.audit.recommendations || 'Sin recomendaciones registradas.'}</Text>
          <View style={{ flexDirection: 'row', marginTop: 14, gap: 16 }}>
            <View style={{ flex: 1, borderTopWidth: 0.8, borderTopColor: c.ink, paddingTop: 4 }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>{d.audit.auditor_name}</Text>
              <Text style={base.small}>Auditor responsable</Text>
              {d.audit.finalized_at && <Text style={base.small}>Finalizó la auditoría el {fmtDateTime(d.audit.finalized_at)}</Text>}
            </View>
            <View style={{ flex: 1, borderTopWidth: 0.8, borderTopColor: c.ink, paddingTop: 4 }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>{d.audit.receipt_name || d.audit.manager_present || d.branch.manager_name || 'Franquiciado / responsable'}</Text>
              <Text style={base.small}>{d.branch.legal_name ? `${d.branch.legal_name} · ` : ''}Sucursal {d.branch.name}</Text>
              {d.audit.receipt_at ? <Text style={base.small}>Constancia de recepción registrada el {fmtDateTime(d.audit.receipt_at)}</Text> : <Text style={base.small}>Constancia de recepción: pendiente</Text>}
            </View>
          </View>
          <View style={{ marginTop: 14, backgroundColor: c.cream, padding: 8 }}>
            <Text style={{ fontSize: 7.5 }}>Fecha de emisión: {fmtDateTime(d.issuedAt)} · Emitido por: {d.issuedBy}</Text>
            <Text style={{ fontSize: 7.5 }}>Visita: {fmtDate(d.audit.visit_date)}{d.audit.start_time ? ` ${d.audit.start_time.slice(0, 5)} h` : ''} · Registro creado: {fmtDateTime(d.audit.created_at)} · Cuestionario versión {d.versionNumber}{d.audit.revision > 1 ? ` · Revisión ${d.audit.revision} (motivo: ${d.audit.correction_reason ?? '—'})` : ''}</Text>
            <Text style={{ fontSize: 7, color: c.muted, marginTop: 3 }}>La constancia de recepción es una firma electrónica simple registrada en la plataforma (usuario, nombre y fecha). No constituye una firma digital certificada.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function ExtrasBlock({ kind, extras, c }: { kind: Category['extras']; extras: Record<string, unknown>; c: ReturnType<typeof pdfColors> }) {
  if (!kind || !extras || Object.keys(extras).length === 0) return null;
  const n = (k: string) => (extras[k] == null || extras[k] === '' ? null : Number(extras[k]));
  const money = (v: number | null) => (v == null ? '—' : v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
  const rows: [string, string][] = [];
  if (kind === 'compra_prueba' && extras.realizada) {
    rows.push(['Compra de prueba', `${extras.momento ?? ''} · ${extras.productos ?? ''}`], ['Importe', money(n('importe'))], ['Espera', n('espera_min') == null ? '—' : `${n('espera_min')} min`], ['Comprobante', String(extras.comprobante ?? '—')], ['Evaluación', String(extras.evaluacion ?? '—')]);
  }
  if (kind === 'degustacion') {
    for (const t of (extras.productos as { product: string; result: string; rating: number | null; comment: string }[] | undefined) ?? []) {
      rows.push([t.product || 'Producto', `${t.result.replace('_', ' ')}${t.rating != null ? ` · ${t.rating}/5` : ''}${t.comment ? ` · ${t.comment}` : ''}`]);
    }
  }
  if (kind === 'caja') {
    rows.push(['Ventas registradas', money(n('ventas'))], ['Cierres revisados', String(extras.cierres_revisados ?? '—')], ['Diferencias detectadas', money(n('diferencias'))], ['Descuentos / NC / anulaciones', `${money(n('descuentos'))} / ${money(n('notas_credito'))} / ${money(n('anulaciones'))}`]);
    if (extras.notas) rows.push(['Notas', String(extras.notas)]);
    const imp = extras.importacion as { archivo: string; filas: number } | undefined;
    if (imp) rows.push(['Archivo importado', `${imp.archivo} (${imp.filas} filas)`]);
  }
  if (kind === 'indicadores') {
    const s = n('ventas'), t = n('tickets');
    rows.push(['Ventas del período', money(s)], ['Tickets', t == null ? '—' : String(t)], ['Ticket promedio', s != null && t ? money(s / t) : '—'], ['CMV', money(n('cmv'))], ['Productos desperdiciados', String(extras.desperdicio_unid ?? '—')], ['Valor de merma', money(n('merma_valor'))]);
    if (extras.mas_vendidos) rows.push(['Más vendidos', String(extras.mas_vendidos)]);
  }
  if (kind === 'club') {
    rows.push(['Clientes adheridos', String(extras.adheridos ?? '—')], ['Canjes', String(extras.canjes ?? '—')], ['Beneficios utilizados', String(extras.beneficios ?? '—')]);
    if (extras.fuente) rows.push(['Fuente', String(extras.fuente)]);
  }
  const shown = rows.filter(([, v]) => v && v !== '—' && v !== '— / — / —');
  if (!shown.length) return null;
  return (
    <View wrap={false} style={{ marginTop: 4, backgroundColor: '#fcfaf6', borderWidth: 0.5, borderColor: c.line, padding: 6 }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Información complementaria (no puntuada)</Text>
      {shown.map(([k, v], i) => <Text key={i} style={{ fontSize: 7.5 }}>{k}: {v}</Text>)}
    </View>
  );
}
