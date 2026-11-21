import { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { CategoryExtras as ExtrasKind } from '../lib/types';
import { readTabular, type Row } from '../lib/tabular';
import { fmtMoney, fmtNumber } from '../lib/format';
import { Field, Input, Select, Textarea, cx } from './ui';

type Extras = Record<string, unknown>;

function Num({ label, k, extras, onChange, disabled, money }: { label: string; k: string; extras: Extras; onChange: (e: Extras) => void; disabled?: boolean; money?: boolean }) {
  return (
    <Field label={label}>
      <Input type="number" inputMode="decimal" step="any" disabled={disabled} value={(extras[k] as number | string | undefined) ?? ''}
        onChange={(e) => onChange({ ...extras, [k]: e.target.value === '' ? null : Number(e.target.value) })}
        placeholder={money ? '$' : ''} />
    </Field>
  );
}
function Txt({ label, k, extras, onChange, disabled, area }: { label: string; k: string; extras: Extras; onChange: (e: Extras) => void; disabled?: boolean; area?: boolean }) {
  const v = (extras[k] as string | undefined) ?? '';
  return (
    <Field label={label}>
      {area ? <Textarea rows={2} disabled={disabled} value={v} onChange={(e) => onChange({ ...extras, [k]: e.target.value })} />
        : <Input disabled={disabled} value={v} onChange={(e) => onChange({ ...extras, [k]: e.target.value })} />}
    </Field>
  );
}

export const EXTRAS_TITLE: Record<Exclude<ExtrasKind, null>, string> = {
  compra_prueba: 'Compra de prueba / cliente incógnito',
  degustacion: 'Productos evaluados y degustación',
  atribucion: 'Atribución de incumplimientos',
  caja: 'Datos de ventas y caja',
  indicadores: 'Indicadores comerciales del período (no puntuados)',
  club: 'Indicadores del Club El Cóndor',
};

interface Tasting { product: string; result: string; rating: number | null; comment: string }

export function CategoryExtras({ kind, extras, onChange, disabled }: { kind: ExtrasKind; extras: Extras; onChange: (e: Extras) => void; disabled?: boolean }) {
  const [importErr, setImportErr] = useState<string | null>(null);
  if (!kind) return null;

  if (kind === 'compra_prueba') {
    const done = Boolean(extras.realizada);
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand-accent))]" disabled={disabled} checked={done} onChange={(e) => onChange({ ...extras, realizada: e.target.checked })} />
          Se realizó una compra de prueba / evaluación de cliente incógnito
        </label>
        {done && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Txt label="Fecha y hora" k="momento" extras={extras} onChange={onChange} disabled={disabled} />
            <Txt label="Productos comprados" k="productos" extras={extras} onChange={onChange} disabled={disabled} />
            <Num label="Importe abonado" k="importe" extras={extras} onChange={onChange} disabled={disabled} money />
            <Num label="Tiempo de espera (minutos)" k="espera_min" extras={extras} onChange={onChange} disabled={disabled} />
            <Field label="¿Recibió comprobante?">
              <Select disabled={disabled} value={(extras.comprobante as string) ?? ''} onChange={(e) => onChange({ ...extras, comprobante: e.target.value })}>
                <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
              </Select>
            </Field>
            <Txt label="Evaluación de la experiencia" k="evaluacion" extras={extras} onChange={onChange} disabled={disabled} area />
          </div>
        )}
      </div>
    );
  }

  if (kind === 'degustacion') {
    const items = (extras.productos as Tasting[] | undefined) ?? [];
    const set = (i: number, patch: Partial<Tasting>) => onChange({ ...extras, productos: items.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
    return (
      <div className="space-y-3">
        {items.map((t, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-crema-100 p-3 sm:grid-cols-[1.5fr_1fr_.7fr_2fr_auto]">
            <Input disabled={disabled} placeholder="Producto" value={t.product} onChange={(e) => set(i, { product: e.target.value })} />
            <Select disabled={disabled} value={t.result} onChange={(e) => set(i, { result: e.target.value })}>
              <option value="conforme">Conforme</option><option value="observado">Observado</option><option value="no_conforme">No conforme</option>
            </Select>
            <Select disabled={disabled} value={t.rating ?? ''} onChange={(e) => set(i, { rating: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Nota</option>{[5, 4, 3, 2, 1, 0].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <Input disabled={disabled} placeholder="Resultado de la degustación" value={t.comment} onChange={(e) => set(i, { comment: e.target.value })} />
            {!disabled && <button type="button" className="btn-ghost p-2" onClick={() => onChange({ ...extras, productos: items.filter((_, j) => j !== i) })} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        {!disabled && (
          <button type="button" className="btn-outline text-xs" onClick={() => onChange({ ...extras, productos: [...items, { product: '', result: 'conforme', rating: null, comment: '' }] })}>
            <Plus className="h-4 w-4" /> Agregar producto evaluado
          </button>
        )}
        {items.length === 0 && disabled && <p className="text-sm text-cafe-500">No se registraron productos evaluados.</p>}
      </div>
    );
  }

  if (kind === 'atribucion') {
    return <p className="text-sm text-cafe-600">Al registrar un incumplimiento en esta categoría indique si es atribuible a la <strong>franquicia</strong> o a la <strong>franquiciante</strong> (fábrica / central). Los informes los muestran por separado.</p>;
  }

  if (kind === 'caja') {
    const imported = (extras.importacion as { archivo: string; filas: number; columnas: string[]; muestra: Row[] } | undefined);
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Ventas registradas del período" k="ventas" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Cierres de caja revisados" k="cierres_revisados" extras={extras} onChange={onChange} disabled={disabled} />
          <Num label="Diferencias detectadas ($)" k="diferencias" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Descuentos ($)" k="descuentos" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Notas de crédito ($)" k="notas_credito" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Anulaciones ($)" k="anulaciones" extras={extras} onChange={onChange} disabled={disabled} money />
        </div>
        <Txt label="Notas del control de caja" k="notas" extras={extras} onChange={onChange} disabled={disabled} area />
        {!disabled && (
          <label className="btn-outline cursor-pointer text-xs">
            <Upload className="h-4 w-4" /> Importar CSV / XLSX de respaldo
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setImportErr(null);
              try {
                const rows = await readTabular(f);
                onChange({ ...extras, importacion: { archivo: f.name, filas: rows.length, columnas: Object.keys(rows[0] ?? {}), muestra: rows.slice(0, 50) } });
              } catch {
                setImportErr('No se pudo leer el archivo. Verifique que sea CSV o XLSX con encabezados en la primera fila.');
              }
            }} />
          </label>
        )}
        {importErr && <p className="text-xs text-[#a33b2b]">{importErr}</p>}
        {imported && (
          <div className="rounded-xl bg-crema-100 p-3 text-xs text-cafe-600">
            Archivo <strong>{imported.archivo}</strong>: {imported.filas} filas · columnas: {imported.columnas.join(', ')}. Se conserva una muestra de {imported.muestra.length} filas como respaldo.
          </div>
        )}
      </div>
    );
  }

  if (kind === 'indicadores') {
    const sales = Number(extras.ventas ?? 0), tickets = Number(extras.tickets ?? 0);
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Ventas del período" k="ventas" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Cantidad de tickets" k="tickets" extras={extras} onChange={onChange} disabled={disabled} />
          <Field label="Ticket promedio (calculado)"><Input disabled value={tickets > 0 ? fmtMoney(sales / tickets) : '—'} /></Field>
          <Num label="CMV ($)" k="cmv" extras={extras} onChange={onChange} disabled={disabled} money />
          <Num label="Productos desperdiciados (unid.)" k="desperdicio_unid" extras={extras} onChange={onChange} disabled={disabled} />
          <Num label="Valor monetario de merma ($)" k="merma_valor" extras={extras} onChange={onChange} disabled={disabled} money />
        </div>
        <Txt label="Productos más vendidos" k="mas_vendidos" extras={extras} onChange={onChange} disabled={disabled} area />
        {sales > 0 && extras.cmv != null && <p className="text-xs text-cafe-500">CMV sobre ventas: {fmtNumber((Number(extras.cmv) / sales) * 100, 1)} %</p>}
      </div>
    );
  }

  if (kind === 'club') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Num label="Clientes adheridos" k="adheridos" extras={extras} onChange={onChange} disabled={disabled} />
        <Num label="Canjes del período" k="canjes" extras={extras} onChange={onChange} disabled={disabled} />
        <Num label="Beneficios utilizados" k="beneficios" extras={extras} onChange={onChange} disabled={disabled} />
        <div className={cx('sm:col-span-3')}><Txt label="Fuente y observaciones de los datos" k="fuente" extras={extras} onChange={onChange} disabled={disabled} /></div>
      </div>
    );
  }
  return null;
}
