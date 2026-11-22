import { useState } from 'react';
import { Calculator, Settings } from 'lucide-react';
import { Badge, Callout, EmptyState, Modal, PracticeBadge } from '../../components/ui';
import { EmptyTag } from '../../components/Illustrations';
import { useContent } from '../../storage/store';
import { PRACTICE_PROMOTION } from '../../content/library';
import type { Promotion } from '../../content/types';
import { missingPromoFields, promoState, PROMO_STATE_LABEL, type PromoState } from '../../lib/promo';
import { formatCivil, formatMoney, formatPercent, todayAR, WEEKDAYS } from '../../lib/format';
import { setQuery } from '../../app/router';

const BENEFIT: Record<string, string> = { 'descuento-inmediato': 'Descuento inmediato', reintegro: 'Reintegro posterior', cuotas: 'Cuotas', otro: 'Otro' };
const STATE_TONE: Record<PromoState, 'ok' | 'warn' | 'neutral' | 'err'> = { vigente: 'ok', proxima: 'neutral', vencida: 'err', incompleta: 'warn' };

export function PromoDetail({ p }: { p: Promotion }) {
  const st = p.isExample ? null : promoState(p);
  const missing = missingPromoFields(p);
  return (
    <div>
      <div className="badges" style={{ marginBottom: 12 }}>
        {p.isExample ? <PracticeBadge label="Práctica · no es un beneficio real" /> : <Badge tone={STATE_TONE[st!]}>{PROMO_STATE_LABEL[st!]}</Badge>}
        {p.verifiedAt ? <Badge tone="ok">Verificada el {formatCivil(p.verifiedAt)}</Badge> : <Badge tone="warn">Sin fecha de verificación</Badge>}
      </div>
      {!p.isExample && missing.length > 0 && <Callout tone="warning" title="Promoción incompleta">Falta: {missing.join(', ')}. No la informes como confirmada hasta completar los datos.</Callout>}
      <dl className="kv">
        <dt>Entidad</dt><dd>{p.entity || '—'}</dd>
        <dt>Vigencia</dt><dd>{p.startDate || p.endDate ? `Del ${formatCivil(p.startDate)} al ${formatCivil(p.endDate)}` : 'Sin fechas'}</dd>
        <dt>Días</dt><dd>{p.days.length ? p.days.map((d) => WEEKDAYS[d]).join(', ') : 'Sin dato'}</dd>
        <dt>Horario</dt><dd>{p.timeFrom || p.timeTo ? `${p.timeFrom ?? '—'} a ${p.timeTo ?? '—'}` : 'Sin dato'}</dd>
        <dt>Tipo de beneficio</dt><dd>{p.benefitType ? BENEFIT[p.benefitType] : 'Sin dato'}</dd>
        <dt>Porcentaje</dt><dd>{formatPercent(p.percent)}</dd>
        <dt>Medio de pago</dt><dd>{p.paymentMethod || 'Sin dato'}</dd>
        <dt>Tarjetas</dt><dd>{p.cards || 'Sin dato'}</dd>
        <dt>Canal</dt><dd>{p.channel || 'Sin dato'}</dd>
        <dt>Tope</dt><dd>{p.cap === null ? 'Sin tope informado' : `${formatMoney(p.cap)}${p.capPeriod ? ` ${p.capPeriod}` : ''}`}</dd>
        <dt>Condiciones</dt><dd>{p.conditions || 'Sin dato'}</dd>
        <dt>Exclusiones</dt><dd>{p.exclusions || 'Sin dato'}</dd>
        <dt>Sucursales confirmadas</dt><dd>{p.branches || 'Sin dato'}</dd>
        <dt>Fuente</dt><dd className="wrap-anywhere">{p.source || 'Sin fuente'}</dd>
      </dl>
      {p.benefitType === 'reintegro' && <Callout tone="info" title="Reintegro posterior">Lo realiza la entidad después, según sus condiciones. No modifica necesariamente el importe que cobra el local, y el tope disponible puede depender de consumos que el local desconoce.</Callout>}
      <p className="small muted">Una fecha vigente no significa que la promoción esté confirmada para El Cóndor: verificá fuente y sucursal.</p>
    </div>
  );
}

export function PromotionsSection({ query }: { query: URLSearchParams }) {
  const { promotions } = useContent();
  const [state, setState] = useState<'' | PromoState>('');
  const [type, setType] = useState('');
  const openId = query.get('p');
  const [practiceOpen, setPracticeOpen] = useState(false);
  const filtered = promotions.filter((p) => (!state || promoState(p) === state) && (!type || p.benefitType === type));
  const open = promotions.find((p) => p.id === openId);
  return (
    <section aria-label="Promociones">
      <p className="small muted">Fecha de referencia: {formatCivil(todayAR())} (hora de Buenos Aires).</p>
      {promotions.length === 0 ? (
        <EmptyState art={<EmptyTag />} title="No hay promociones de El Cóndor confirmadas"
          actions={<a className="btn btn-secondary" href="#/gestionar?t=promociones"><Settings aria-hidden="true" />Cargar una promoción verificada</a>}>
          Cuando la empresa confirme un beneficio, se carga con su entidad, fechas, medio de pago, tope, condiciones, fuente y fecha de verificación. Hasta entonces, no informes beneficios por tu cuenta.
        </EmptyState>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 14 }}>
            <select className="input" aria-label="Estado" style={{ width: 'auto' }} value={state} onChange={(e) => setState(e.target.value as PromoState | '')}>
              <option value="">Todos los estados</option>
              {(Object.keys(PROMO_STATE_LABEL) as PromoState[]).map((s) => <option key={s} value={s}>{PROMO_STATE_LABEL[s]}</option>)}
            </select>
            <select className="input" aria-label="Tipo de beneficio" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(BENEFIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid">
            {filtered.map((p) => {
              const st = promoState(p);
              return (
                <div key={p.id} className="card" style={{ display: 'grid', gap: 8 }}>
                  <div className="badges"><Badge tone={STATE_TONE[st]}>{PROMO_STATE_LABEL[st]}</Badge>{p.benefitType && <Badge>{BENEFIT[p.benefitType]}</Badge>}</div>
                  <h3 style={{ margin: 0 }}>{p.title || p.entity || 'Promoción sin título'}</h3>
                  <p className="small muted" style={{ margin: 0 }}>{p.entity} · {formatPercent(p.percent)} · {p.paymentMethod || 'medio sin dato'}</p>
                  <p className="small" style={{ margin: 0 }}>{p.startDate ? `${formatCivil(p.startDate)} – ${formatCivil(p.endDate)}` : 'Sin fechas'}</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuery({ p: p.id })}>Ver condiciones</button>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && <p className="muted">Ninguna promoción coincide con los filtros.</p>}
        </>
      )}
      <section className="card" style={{ marginTop: 28, borderStyle: 'dashed' }}>
        <div className="row-between">
          <div>
            <PracticeBadge />
            <h3 style={{ margin: '8px 0 4px' }}>Ejemplo de entrenamiento</h3>
            <p className="muted small" style={{ margin: 0 }}>Un reintegro ficticio del 20 % con tope de $ 5.000 por mes, para practicar la lectura de condiciones. No es un convenio.</p>
          </div>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPracticeOpen(true)}>Ver ejemplo</button>
            <a className="btn btn-primary btn-sm" href="#/aprender/m9?l=m9-x1"><Calculator aria-hidden="true" />Calculadora</a>
          </div>
        </div>
      </section>
      <Modal open={!!open} onClose={() => setQuery({ p: null })} title={open?.title || open?.entity || 'Promoción'}>{open && <PromoDetail p={open} />}</Modal>
      <Modal open={practiceOpen} onClose={() => setPracticeOpen(false)} title="Ejemplo de entrenamiento"><PromoDetail p={PRACTICE_PROMOTION} /></Modal>
    </section>
  );
}
