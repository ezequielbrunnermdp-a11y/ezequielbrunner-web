"use client";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { loginAction } from "../actions";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="surface space-y-4 rounded-2xl p-6 shadow-sm">
      <Field label="Correo electrónico">
        <Input name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label="Contraseña">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Submit className="w-full py-3 text-base">Ingresar</Submit>
    </ActionForm>
  );
}
