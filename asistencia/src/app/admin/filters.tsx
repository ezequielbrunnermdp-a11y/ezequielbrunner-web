import { Select, Input } from "@/components/ui";

type Opt = { id: string; name: string; company_id?: string; file_number?: string };
export function Filters({
  values, options, show = ["company", "branch", "sector", "supervisor", "employee", "date"], extra,
}: {
  values: Record<string, string | undefined>;
  options: { companies: Opt[]; branches: (Opt & { company_name?: string })[]; employees: Opt[]; sectors: string[]; supervisors: { id: string; full_name: string }[] };
  show?: string[];
  extra?: React.ReactNode;
}) {
  const has = (k: string) => show.includes(k);
  return (
    <form method="get" className="surface mb-6 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3 lg:grid-cols-6">
      {has("company") && options.companies.length > 1 && (
        <Select name="company" defaultValue={values.company ?? ""} aria-label="Empresa">
          <option value="">Todas las empresas</option>
          {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
      {has("branch") && (
        <Select name="branch" defaultValue={values.branch ?? ""} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {options.branches.filter((b) => !values.company || b.company_id === values.company).map((b) => <option key={b.id} value={b.id}>{options.companies.length > 1 ? `${b.company_name} · ` : ""}{b.name}</option>)}
        </Select>
      )}
      {has("sector") && options.sectors.length > 0 && (
        <Select name="sector" defaultValue={values.sector ?? ""} aria-label="Sector">
          <option value="">Todos los sectores</option>
          {options.sectors.map((s) => <option key={s}>{s}</option>)}
        </Select>
      )}
      {has("supervisor") && options.supervisors.length > 0 && (
        <Select name="supervisor" defaultValue={values.supervisor ?? ""} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {options.supervisors.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </Select>
      )}
      {has("employee") && (
        <Select name="employee" defaultValue={values.employee ?? ""} aria-label="Empleado">
          <option value="">Todos los empleados</option>
          {options.employees.filter((e) => !values.company || e.company_id === values.company).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.file_number})</option>)}
        </Select>
      )}
      {has("date") && <Input type="date" name="date" defaultValue={values.date} aria-label="Fecha" />}
      {has("from") && <Input type="date" name="from" defaultValue={values.from} aria-label="Desde" />}
      {has("to") && <Input type="date" name="to" defaultValue={values.to} aria-label="Hasta" />}
      {extra}
      <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Aplicar</button>
    </form>
  );
}
