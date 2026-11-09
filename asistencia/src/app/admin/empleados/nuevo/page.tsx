import { requireActor } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveEmployee } from "../../actions";
import { filterOptions, managersInScope } from "../../data";
import { EmployeeFields } from "../form";

export const metadata = { title: "Nuevo empleado" };

export default async function Nuevo() {
  const a = await requireActor({ cap: "employees.manage" });
  const { branches } = await filterOptions(a);
  return (
    <>
      <PageHeader title="Nuevo empleado" />
      <Card>
        <ActionForm action={saveEmployee} resetOnSuccess>
          <EmployeeFields branches={branches.filter((b) => b.active)} supervisors={await managersInScope(a)} />
          <div className="mt-4"><Submit>Crear empleado</Submit></div>
        </ActionForm>
      </Card>
    </>
  );
}
