"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

const LABEL: Record<string, string> = { superadmin: "Administrador general", company_admin: "Administrador de empresa", manager: "Gerencia", supervisor: "Encargado" };

export function UserFields({ u, roles, companies, branches }: {
  u?: { id: string; full_name: string; email: string; role: string; company_id?: string; branch_ids: string[] };
  roles: string[]; companies: { id: string; name: string }[]; branches: { id: string; name: string; company_id: string }[];
}) {
  const [role, setRole] = useState(u?.role ?? roles[roles.length - 1]);
  const [company, setCompany] = useState(u?.company_id ?? companies[0]?.id);
  return (
    <div className="space-y-3">
      {u && <input type="hidden" name="id" value={u.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre completo"><Input name="full_name" defaultValue={u?.full_name} required /></Field>
        <Field label="Correo"><Input name="email" type="email" defaultValue={u?.email} required /></Field>
        <Field label="Rol"><Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}</Select></Field>
        {role !== "superadmin" && (
          <Field label="Empresa"><Select name="company_id" value={company} onChange={(e) => setCompany(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        )}
      </div>
      {role !== "superadmin" && (
        <div>
          <div className="mb-1 text-sm font-medium">{role === "supervisor" ? "Sucursales a cargo (obligatorio)" : "Limitar a sucursales (opcional — vacío = toda la empresa)"}</div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {branches.filter((b) => b.company_id === company).map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="branches" value={b.id} defaultChecked={u?.branch_ids.includes(b.id)} />{b.name}</label>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">
        Encargado: ve y solicita correcciones sólo de sus sucursales. Gerencia: supervisa toda la empresa y aprueba correcciones.
        Administrador de empresa: además gestiona sucursales, empleados, horarios, terminales y usuarios.
      </p>
    </div>
  );
}
