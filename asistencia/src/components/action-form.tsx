"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export type ActionState = { ok?: boolean; message?: string } | null;

const Pending = createContext(false);

/**
 * Formulario conectado a una Server Action. No usa el reseteo automático de React:
 * si el servidor devuelve un error, los datos cargados se conservan.
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false, confirm,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode; className?: string; resetOnSuccess?: boolean; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.message && (
        <p role="status" className={clsx("mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm animate-in",
          state.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300")}>
          {state.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const pending = useContext(Pending);
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition active:scale-[.98] disabled:opacity-60",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
        variant === "secondary" && "surface hover:bg-[var(--surface-2)]",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
