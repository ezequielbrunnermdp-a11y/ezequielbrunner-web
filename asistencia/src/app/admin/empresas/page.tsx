import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { Card, PageHeader, Field, Input, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { saveCompany, toggleCompany } from "../actions";

export const metadata = { title: "Empresas" };

function CompanyFields({ c }: { c?: any }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre" className="sm:col-span-2"><Input name="name" defaultValue={c?.name} required /></Field>
        <Field label="Tolerancia llegada (min)"><Input name="late_tolerance_min" type="number" min={0} max={120} defaultValue={c?.late_tolerance_min ?? 10} /></Field>
        <Field label="Tolerancia salida (min)"><Input name="early_leave_tolerance_min" type="number" min={0} max={120} defaultValue={c?.early_leave_tolerance_min ?? 10} /></Field>
        <Field label="Umbral horas adicionales (min)"><Input name="extra_hours_threshold_min" type="number" min={0} max={240} defaultValue={c?.extra_hours_threshold_min ?? 15} /></Field>
        <Field label="Jornada máxima (h)" hint="Pasado este tiempo, una entrada sin salida queda incompleta."><Input name="max_shift_hours" type="number" min={4} max={24} defaultValue={c?.max_shift_hours ?? 16} /></Field>
        <Field label="Hora del reporte diario"><Input name="daily_report_hour" type="number" min={0} max={23} defaultValue={c?.daily_report_hour ?? 7} /></Field>
        <Field label="Retención de coordenadas (días)" hint="Luego se borran lat/long; se conserva la distancia validada."><Input name="geo_retention_days" type="number" min={30} max={3650} defaultValue={c?.geo_retention_days ?? 365} /></Field>
        <Field label="Correos del reporte diario" className="sm:col-span-2 lg:col-span-4" hint="Separados por coma."><Input name="report_emails" defaultValue={c?.report_emails?.join(", ")} /></Field>
      </div>
    </>
  );
}

export default async function Empresas() {
  await requireActor({ cap: "companies.manage" });
  const rows = await q(`select c.*, (select count(*)::int from branches b where b.company_id = c.id) as branches,
    (select count(*)::int from employees e where e.company_id = c.id and e.active) as employees from companies c order by c.name`);
  return (
    <>
      <PageHeader title="Empresas" subtitle="Cada empresa tiene sus propias sucursales, empleados, reglas y permisos." />
      <div className="space-y-4">
        {rows.map((c) => (
          <Card key={c.id} title={<span className="flex items-center gap-2">{c.name}{!c.active && <Badge tone="red">Inactiva</Badge>}{c.is_demo && <Badge tone="amber">Demo</Badge>}</span>}
            action={<InlineAction action={toggleCompany} fields={{ id: c.id }} label={c.active ? "Desactivar" : "Activar"} variant={c.active ? "danger" : "primary"} confirm={c.active ? "¿Desactivar la empresa? Sus empleados no podrán fichar." : undefined} />}>
            <p className="mb-4 text-sm text-muted">{c.branches} sucursales · {c.employees} empleados activos</p>
            <ActionForm action={saveCompany}><CompanyFields c={c} /><div className="mt-4"><Submit>Guardar cambios</Submit></div></ActionForm>
          </Card>
        ))}
        <Card title="Nueva empresa">
          <ActionForm action={saveCompany} resetOnSuccess><CompanyFields /><div className="mt-4"><Submit>Crear empresa</Submit></div></ActionForm>
        </Card>
      </div>
    </>
  );
}
