"use client";
import { ActionForm, Submit, type ActionState } from "./action-form";

export function InlineAction({
  action, fields, label, variant = "secondary", confirm, children,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>; label: string; variant?: "primary" | "secondary" | "danger"; confirm?: string; children?: React.ReactNode;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className="inline-block">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <Submit variant={variant} className="!px-2.5 !py-1.5 text-xs">{label}</Submit>
    </ActionForm>
  );
}
