import { requireActor } from "@/lib/session";
import { Card, Field, Input } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { changePasswordAction } from "../actions";
import { ROLE_LABEL } from "@/lib/permissions";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ "primer-ingreso"?: string }> }) {
  const a = await requireActor();
  const first = (await searchParams)["primer-ingreso"];
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <a href="/" className="text-sm text-brand-600">← Volver</a>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Mi cuenta</h1>
      <p className="text-sm text-muted">{a.full_name} · {a.email} · {ROLE_LABEL[a.role]}</p>
      {(first || a.must_change_password) && (
        <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">Por seguridad, elegí una contraseña nueva antes de continuar.</p>
      )}
      <Card className="mt-6" title="Cambiar contraseña">
        <ActionForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
          <Field label="Contraseña actual"><Input type="password" name="current" required autoComplete="current-password" /></Field>
          <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números."><Input type="password" name="next" required autoComplete="new-password" /></Field>
          <Field label="Repetir nueva contraseña"><Input type="password" name="confirm" required autoComplete="new-password" /></Field>
          <Submit>Guardar</Submit>
        </ActionForm>
      </Card>
    </main>
  );
}
