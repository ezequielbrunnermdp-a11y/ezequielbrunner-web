import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { countUsers } from "@/lib/auth/accounts";
import { AuthFrame } from "@/components/auth-frame";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Input, Label } from "@/components/ui";
import { setupAction } from "../actions/auth";

export const metadata: Metadata = { title: "Configuración inicial" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await countUsers(await getDb())) > 0) redirect("/login");
  return (
    <AuthFrame title="Configuración inicial" subtitle="Creá la cuenta de administración y tu primera empresa. Este paso sólo está disponible una vez.">
      <ActionForm action={setupAction} className="grid gap-4">
        <div>
          <Label htmlFor="name">Tu nombre</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="password" hint="mín. 10">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div>
            <Label htmlFor="password2">Repetir</Label>
            <Input id="password2" name="password2" type="password" autoComplete="new-password" minLength={10} required />
          </div>
        </div>
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" placeholder="Ej.: Grupo Gastronómico Sur" required />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/[0.03] p-3 text-sm ring-1 ring-inset ring-white/[0.07]">
          <input type="checkbox" name="demo" className="mt-0.5 size-4 accent-[#5EEAD4]" />
          <span>
            <span className="font-medium text-fg">Crear también una empresa de demostración</span>
            <span className="mt-0.5 block text-xs text-muted">Separada de tu empresa real, con conversaciones ficticias procesadas por el mismo flujo. Podés borrarla cuando quieras.</span>
          </span>
        </label>
        <SubmitButton className="mt-2 w-full" pendingLabel="Configurando…">Crear y entrar</SubmitButton>
      </ActionForm>
    </AuthFrame>
  );
}
