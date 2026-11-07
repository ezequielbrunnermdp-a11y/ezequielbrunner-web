"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action";
import { buttonClass, cx, Notice } from "./ui";

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  pendingLabel?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cx(buttonClass(variant, size), className)}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Formulario conectado a una server action con estado (éxito / error accesible).
 * Si `resetOnSuccess`, limpia los campos tras una operación exitosa.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  successHidden,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  successHidden?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div aria-live="polite" className="empty:hidden [&>*]:mt-3">
        {state?.error && <Notice tone="danger">{state.error}</Notice>}
        {state?.ok && state.message && !successHidden && <Notice tone="ok">{state.message}</Notice>}
      </div>
    </form>
  );
}
