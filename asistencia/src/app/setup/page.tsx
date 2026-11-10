import { redirect } from "next/navigation";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { needsSetup, setupAction } from "./actions";

export const metadata = { title: "Configuración inicial" };
export const dynamic = "force-dynamic";

export default async function Setup() {
  if (!(await needsSetup())) redirect("/login");
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <img src="/icon.svg" alt="" className="mb-4 size-12 rounded-2xl" />
      <h1 className="text-2xl font-semibold tracking-tight">Configuración inicial</h1>
      <p className="mt-1 text-sm text-muted">Creá el usuario administrador general. Esta pantalla deja de funcionar una vez creado.</p>
      <Card className="mt-6">
        <ActionForm action={setupAction} className="space-y-3">
          <Field label="Código de configuración" hint="Te lo dio quien publicó el sistema. Es de un solo uso."><Input name="token" required autoComplete="off" /></Field>
          <Field label="Nombre y apellido"><Input name="name" required /></Field>
          <Field label="Correo"><Input name="email" type="email" required autoComplete="username" /></Field>
          <Field label="Contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input name="password" type="password" required autoComplete="new-password" /></Field>
          <Field label="Repetir contraseña"><Input name="confirm" type="password" required autoComplete="new-password" /></Field>
          <label className="flex items-start gap-2 rounded-xl surface-2 p-3 text-sm">
            <input type="checkbox" name="demo" defaultChecked className="mt-1" />
            <span>Cargar también una <b>empresa DEMO</b> separada para probar (3 empleados, un encargado, una gerencia y una terminal). Se puede desactivar después.</span>
          </label>
          <Submit className="w-full py-3">Crear administrador</Submit>
        </ActionForm>
      </Card>
    </main>
  );
}
