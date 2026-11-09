import Link from "next/link";
import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, Badge, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveUser } from "../actions";
import { filterOptions } from "../data";
import { UserFields } from "./form";

export const metadata = { title: "Usuarios y permisos" };

export default async function Usuarios() {
  const a = await requireActor({ cap: "users.manage" });
  const companyIds = a.scopes.filter((s) => s.branch_id === null).map((s) => s.company_id);
  const rows = await q(
    `select u.id, u.full_name, u.email, u.role, u.active, u.last_login_at, u.locked_until,
       coalesce(string_agg(distinct c.name || coalesce(' · ' || b.name, ''), ', '), '') as scopes
     from users u left join user_scopes s on s.user_id = u.id left join companies c on c.id = s.company_id left join branches b on b.id = s.branch_id
     where u.role <> 'employee' and ($1 or s.company_id = any($2))
     group by u.id order by u.active desc, u.role, u.full_name`, [a.role === "superadmin", companyIds]);
  const { companies, branches } = await filterOptions(a);
  const roles = a.role === "superadmin" ? ["superadmin", "company_admin", "manager", "supervisor"] : ["company_admin", "manager", "supervisor"];
  return (
    <>
      <PageHeader title="Usuarios y permisos" subtitle="Personal de gestión. Los usuarios de empleados se crean desde la ficha del empleado." />
      <Card padded={false} className="mb-6">
        <TableWrap>
          <table className="tbl">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Alcance</th><th>Último ingreso</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td className="font-medium">{u.full_name}<div className="text-xs font-normal text-muted">{u.email}</div></td>
                  <td>{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}</td>
                  <td className="max-w-72 text-xs">{u.role === "superadmin" ? "Todas las empresas" : u.scopes || <Badge tone="amber">Sin alcance</Badge>}</td>
                  <td className="text-xs text-muted">{u.last_login_at ? fmtDateTime(u.last_login_at) : "Nunca"}</td>
                  <td>{!u.active ? <Badge tone="red">Inactivo</Badge> : u.locked_until && new Date(u.locked_until) > new Date() ? <Badge tone="amber">Bloqueado</Badge> : <Badge tone="green">Activo</Badge>}</td>
                  <td className="text-right"><Link href={`/admin/usuarios/${u.id}`} className="text-sm font-medium text-brand-600">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <Card title="Nuevo usuario de gestión">
        <ActionForm action={saveUser} resetOnSuccess><UserFields roles={roles} companies={companies} branches={branches} /><div className="mt-4"><Submit>Crear usuario</Submit></div></ActionForm>
      </Card>
    </>
  );
}
