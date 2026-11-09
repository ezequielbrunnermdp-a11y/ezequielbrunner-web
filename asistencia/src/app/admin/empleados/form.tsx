import { Field, Input, Select } from "@/components/ui";

export function EmployeeFields({ e, branches, supervisors, authorized = [], hasUser }: {
  e?: any; branches: any[]; supervisors: { id: string; full_name: string }[]; authorized?: string[]; hasUser?: boolean;
}) {
  return (
    <div className="space-y-4">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre"><Input name="first_name" defaultValue={e?.first_name} required /></Field>
        <Field label="Apellido"><Input name="last_name" defaultValue={e?.last_name} required /></Field>
        <Field label="Legajo"><Input name="file_number" defaultValue={e?.file_number} required /></Field>
        <Field label="DNI"><Input name="document_number" defaultValue={e?.document_number ?? ""} inputMode="numeric" /></Field>
        <Field label="Sector"><Input name="sector" defaultValue={e?.sector ?? ""} placeholder="Cocina, Salón, Caja…" /></Field>
        <Field label="Puesto"><Input name="position" defaultValue={e?.position ?? ""} /></Field>
        <Field label="Sucursal principal">
          <Select name="primary_branch_id" defaultValue={e?.primary_branch_id}>{branches.map((b) => <option key={b.id} value={b.id}>{b.company_name} · {b.name}</option>)}</Select>
        </Field>
        <Field label="Responsable">
          <Select name="supervisor_user_id" defaultValue={e?.supervisor_user_id ?? ""}><option value="">—</option>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</Select>
        </Field>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Sucursales autorizadas para fichar</div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="branches" value={b.id} defaultChecked={authorized.includes(b.id)} />{b.company_name} · {b.name}</label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">La sucursal principal siempre queda autorizada. Sólo se aceptan sucursales de la misma empresa.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!hasUser && <Field label="Correo para la app (opcional)" hint="Crea el usuario con una contraseña temporal."><Input name="email" type="email" /></Field>}
        <Field label={e ? "Nuevo PIN de terminal (opcional)" : "PIN de terminal (opcional)"} hint="4 a 8 dígitos, para fichar en la terminal del local sin celular."><Input name="pin" inputMode="numeric" pattern="\d{4,8}" autoComplete="off" /></Field>
      </div>
    </div>
  );
}
