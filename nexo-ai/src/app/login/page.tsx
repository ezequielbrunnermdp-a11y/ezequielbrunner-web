import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { countUsers } from "@/lib/auth/accounts";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthFrame } from "@/components/auth-frame";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Input, Label } from "@/components/ui";
import { loginAction } from "../actions/auth";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await countUsers(await getDb())) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthFrame title="Ingresar" subtitle="Accedé al panel operativo de tus empresas.">
      <ActionForm action={loginAction} className="grid gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton className="mt-2 w-full" pendingLabel="Verificando…">Ingresar</SubmitButton>
      </ActionForm>
      <p className="mt-8 text-xs leading-relaxed text-faint">
        Las cuentas las crea un administrador de tu empresa. Si olvidaste tu contraseña, pedile que te asigne una nueva.
      </p>
    </AuthFrame>
  );
}
