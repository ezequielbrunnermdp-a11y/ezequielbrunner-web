import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/auth/session";
import { AuthFrame } from "@/components/auth-frame";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Input, Label } from "@/components/ui";
import { createCompanyAction, logoutAction } from "../actions/auth";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const ws = await getWorkspace();
  if (ws.active) redirect("/dashboard");
  if (!ws.user.is_platform_admin) {
    return (
      <AuthFrame title="Sin empresas asignadas" subtitle="Tu cuenta todavía no pertenece a ninguna empresa. Pedile a un administrador que te agregue.">
        <form action={logoutAction}><SubmitButton variant="secondary">Cerrar sesión</SubmitButton></form>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Creá una empresa" subtitle="No tenés empresas activas. Creá una para empezar a importar conversaciones.">
      <ActionForm action={createCompanyAction} className="grid gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required />
        </div>
        <SubmitButton>Crear empresa</SubmitButton>
      </ActionForm>
    </AuthFrame>
  );
}
