import { notFound } from "next/navigation";
import { requireActor } from "@/lib/session";
import { one } from "@/lib/db";
import { canAccessBranch } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { saveBranch, toggleBranch } from "../../actions";
import { filterOptions } from "../../data";
import { BranchFields } from "../form";

export default async function EditBranch({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireActor({ cap: "branches.manage" });
  const { id } = await params;
  const b = /^[0-9a-f-]{36}$/.test(id) ? await one(`select * from branches where id = $1`, [id]) : null;
  if (!b || !canAccessBranch(a, b.company_id, b.id)) notFound();
  const { companies } = await filterOptions(a);
  return (
    <>
      <PageHeader title={b.name} subtitle="Editar sucursal"
        actions={<InlineAction action={toggleBranch} fields={{ id: b.id }} label={b.active ? "Desactivar sucursal" : "Activar sucursal"} variant={b.active ? "danger" : "primary"} confirm={b.active ? "¿Desactivar? No se podrá fichar en esta sucursal." : undefined} />} />
      <Card>
        <ActionForm action={saveBranch}><BranchFields b={b} companies={companies} /><div className="mt-4"><Submit>Guardar cambios</Submit></div></ActionForm>
      </Card>
    </>
  );
}
