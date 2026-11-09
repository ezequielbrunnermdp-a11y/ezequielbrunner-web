import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { one, q } from "@/lib/db";
import { hasCompanyWideScope } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { saveUser, toggleUser, resetUserPassword } from "../../actions";
import { filterOptions } from "../../data";
import { UserFields } from "../form";

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireActor({ cap: "users.manage" });
  const { id } = await params;
  const u = /^[0-9a-f-]{36}$/.test(id) ? await one(`select id, full_name, email, role, active from users where id = $1 and role <> 'employee'`, [id]) : null;
  if (!u) notFound();
  const scopes = await q(`select company_id, branch_id from user_scopes where user_id = $1`, [id]);
  if (a.role !== "superadmin" && (u.role === "superadmin" || !scopes.length || scopes.some((s) => !hasCompanyWideScope(a, s.company_id)))) notFound();
  const { companies, branches } = await filterOptions(a);
  const roles = a.role === "superadmin" ? ["superadmin", "company_admin", "manager", "supervisor"] : ["company_admin", "manager", "supervisor"];
  return (
    <>
      <PageHeader title={u.full_name} subtitle={u.email} actions={<>
        <InlineAction action={resetUserPassword} fields={{ id }} label="Restablecer contraseña" confirm="Se generará una contraseña temporal y se cerrarán sus sesiones." />
        {id !== a.id && <InlineAction action={toggleUser} fields={{ id }} label={u.active ? "Desactivar" : "Activar"} variant={u.active ? "danger" : "primary"} />}
      </>} />
      <Card>
        <ActionForm action={saveUser}>
          <UserFields u={{ ...u, company_id: scopes[0]?.company_id, branch_ids: scopes.map((s) => s.branch_id).filter(Boolean) }} roles={roles} companies={companies} branches={branches} />
          <div className="mt-4"><Submit>Guardar cambios</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
