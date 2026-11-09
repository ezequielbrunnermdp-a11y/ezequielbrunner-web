import { Field, Input, Select } from "@/components/ui";
import { GeoFill } from "@/components/geo-fill";
import { WEEKDAYS } from "@/lib/time";

export function BranchFields({ b, companies }: { b?: any; companies: { id: string; name: string }[] }) {
  return (
    <div className="space-y-4">
      {b && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empresa">
          <Select name="company_id" defaultValue={b?.company_id ?? companies[0]?.id} disabled={!!b}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          {b && <input type="hidden" name="company_id" value={b.company_id} />}
        </Field>
        <Field label="Nombre"><Input name="name" defaultValue={b?.name} required /></Field>
        <Field label="Dirección" className="sm:col-span-2"><Input name="address" defaultValue={b?.address ?? ""} placeholder="Calle, número, ciudad" /></Field>
      </div>
      <div className="rounded-xl surface-2 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm font-medium">Perímetro de fichaje</div><div className="text-xs text-muted">Sin coordenadas, nadie puede fichar con celular en esta sucursal.</div></div>
          <GeoFill />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Latitud"><Input name="latitude" inputMode="decimal" defaultValue={b?.latitude ?? ""} placeholder="-38.000000" /></Field>
          <Field label="Longitud"><Input name="longitude" inputMode="decimal" defaultValue={b?.longitude ?? ""} placeholder="-57.550000" /></Field>
          <Field label="Radio autorizado (m)" hint="Recomendado: 50–150 m."><Input name="radius_m" type="number" min={10} max={2000} defaultValue={b?.radius_m ?? 80} /></Field>
          <Field label="Precisión GPS máxima (m)" hint="Lecturas peores se rechazan."><Input name="max_accuracy_m" type="number" min={5} max={500} defaultValue={b?.max_accuracy_m ?? 60} /></Field>
        </div>
        {b?.latitude != null && (
          <a className="mt-3 inline-block text-xs font-medium text-brand-600" target="_blank" rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=18/${b.latitude}/${b.longitude}`}>Ver ubicación en el mapa ↗</a>
        )}
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Horario de funcionamiento</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((d, i) => <Field key={i} label={d}><Input name={`hours_${i}`} defaultValue={b?.opening_hours?.[i] ?? ""} placeholder="08:00-23:00" /></Field>)}
        </div>
      </div>
    </div>
  );
}
