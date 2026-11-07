import type { Metadata } from "next";
import Link from "next/link";
import { Building2, KeyRound, ScrollText, ShieldCheck, Store, Users } from "lucide-react";
import { getWorkspace, requireCtx } from "@/lib/auth/session";
import { can, canAssignRole, ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { getPrivacy, listAudit, listBranches, listMembers } from "@/lib/admin/service";
import { AUDIT_LABELS } from "@/lib/audit";
import { claudeAvailable } from "@/lib/analysis/claude";
import { Badge, Card, CardHeader, cx, Input, Label, Notice, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { fmtInstant } from "@/components/labels";
import {
  addMemberAction, applyRetentionAction, changeRoleAction, createBranchAction, deleteBranchAction, deleteCompanyAction, removeMemberAction, updatePrivacyAction,
} from "../../actions/admin";
import { createCompanyAction } from "../../actions/auth";

export const metadata: Metadata = { title: "Administración" };

const TABS = [
  { key: "branches", label: "Sucursales", icon: Store },
  { key: "members", label: "Usuarios y roles", icon: Users },
  { key: "privacy", label: "Privacidad y datos", icon: ShieldCheck },
  { key: "audit", label: "Auditoría", icon: ScrollText },
  { key: "companies", label: "Empresas", icon: Building2 },
] as const;

const ROLE_HELP: Record<string, string> = {
  owner: "Todo, incluida la eliminación de la empresa.",
  admin: "Gestiona usuarios, sucursales, privacidad e importaciones.",
  manager: "Importa, analiza, valida hallazgos y gestiona tareas.",
  analyst: "Consulta datos, ejecuta análisis y ve reportes.",
  viewer: "Sólo lectura.",
};

function Toggle({ name, label, hint, defaultChecked, disabled }: { name: string; label: string; hint: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl p-3 ring-1 ring-inset ring-white/[0.07]">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
    </label>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "branches";
  const ctx = await requireCtx("data.read");
  const ws = await getWorkspace();
  const company = ws.active!;

  return (
    <>
      <PageHeader eyebrow={company.name} title="Administración" description={`Tu rol: ${ROLE_LABELS[ctx.role]}. ${ROLE_HELP[ctx.role]}`} />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Secciones">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/admin?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cx("-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors", tab === key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            <Icon className="size-3.5" />{label}
          </Link>
        ))}
      </nav>

      {tab === "branches" && <Branches canManage={can(ctx.role, "branches.manage")} branches={await listBranches(ctx)} />}

      {tab === "members" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Miembros" description="Cada persona sólo ve las empresas a las que pertenece." />
            <ul className="divide-y divide-line">
              {(await listMembers(ctx)).map((m) => {
                const editable = can(ctx.role, "members.manage") && canAssignRole(ctx.role, m.role) && m.user_id !== ctx.userId;
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name} {m.user_id === ctx.userId && <span className="text-faint">(vos)</span>}</p>
                      <p className="truncate text-xs text-muted">{m.email}</p>
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <ActionForm action={changeRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <Select name="role" defaultValue={m.role} className="h-8 w-36 text-xs" aria-label={`Rol de ${m.name}`}>
                            {ROLES.filter((r) => canAssignRole(ctx.role, r)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </Select>
                          <SubmitButton size="sm" variant="secondary">Guardar</SubmitButton>
                        </ActionForm>
                        <ActionForm action={removeMemberAction}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <SubmitButton size="sm" variant="ghost" confirm={`¿Quitar a ${m.name} de la empresa?`}>Quitar</SubmitButton>
                        </ActionForm>
                      </div>
                    ) : (
                      <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {can(ctx.role, "members.manage") && (
            <Card>
              <CardHeader title="Agregar miembro" description="Si el email ya tiene cuenta, sólo se suma a esta empresa." />
              <ActionForm action={addMemberAction} resetOnSuccess className="grid gap-3 p-5">
                <div><Label htmlFor="m-email">Email</Label><Input id="m-email" name="email" type="email" required /></div>
                <div><Label htmlFor="m-name" hint="si es nuevo">Nombre</Label><Input id="m-name" name="name" /></div>
                <div><Label htmlFor="m-pass" hint="si es nuevo · mín. 10">Contraseña inicial</Label><Input id="m-pass" name="password" type="password" autoComplete="new-password" minLength={10} /></div>
                <div>
                  <Label htmlFor="m-role">Rol</Label>
                  <Select id="m-role" name="role" defaultValue="viewer">
                    {ROLES.filter((r) => canAssignRole(ctx.role, r)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HELP[r]}</option>)}
                  </Select>
                </div>
                <SubmitButton>Agregar</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {tab === "privacy" && <Privacy ctxRole={ctx.role} privacy={await getPrivacy(ctx)} slug={company.slug} isDemo={company.is_demo} aiConfigured={claudeAvailable()} />}

      {tab === "audit" && (
        can(ctx.role, "audit.read") ? (
          <Card>
            <CardHeader title="Registro de auditoría" description="Últimas 200 acciones. No incluye contenido de mensajes." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted"><tr className="border-b border-line"><th className="px-5 py-2.5 font-medium">Fecha</th><th className="px-3 py-2.5 font-medium">Acción</th><th className="px-3 py-2.5 font-medium">Persona</th><th className="px-5 py-2.5 font-medium">Detalle</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(await listAudit(ctx)).map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted">{fmtInstant(a.created_at)}</td>
                      <td className="px-3 py-2.5">{AUDIT_LABELS[a.action] ?? a.action}</td>
                      <td className="px-3 py-2.5 text-muted">{a.actor ?? "—"}</td>
                      <td className="max-w-[320px] truncate px-5 py-2.5 font-mono text-[11px] text-faint" title={JSON.stringify(a.metadata)}>{Object.keys(a.metadata ?? {}).length ? JSON.stringify(a.metadata) : a.target_type ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : <Notice tone="warn">Tu rol no permite ver la auditoría.</Notice>
      )}

      {tab === "companies" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Tus empresas" />
            <ul className="divide-y divide-line">
              {ws.memberships.map((m) => (
                <li key={m.company_id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>{m.name} {m.is_demo && <Badge tone="violet" className="ml-2">Demo</Badge>}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[m.role]}</span>
                </li>
              ))}
            </ul>
          </Card>
          {ws.user.is_platform_admin ? (
            <Card>
              <CardHeader title="Nueva empresa" description="Los datos de cada empresa están separados por completo." />
              <ActionForm action={createCompanyAction} className="grid gap-3 p-5">
                <div><Label htmlFor="c-name">Nombre</Label><Input id="c-name" name="name" /></div>
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="demo" className="accent-[#5EEAD4]" />Crear en cambio una empresa de demostración (datos ficticios)</label>
                <SubmitButton>Crear</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <Notice tone="info">Sólo un administrador de la plataforma puede crear empresas.</Notice>
          )}
        </div>
      )}
    </>
  );
}

function Branches({ canManage, branches }: { canManage: boolean; branches: { id: string; name: string; tasks_open: number }[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title="Sucursales" description="Se usan para clasificar conversaciones, hallazgos y tareas." />
        {branches.length ? (
          <ul className="divide-y divide-line">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><p className="text-sm font-medium">{b.name}</p><p className="text-xs text-muted">{b.tasks_open} tareas abiertas</p></div>
                {canManage && (
                  <ActionForm action={deleteBranchAction}>
                    <input type="hidden" name="branch_id" value={b.id} />
                    <SubmitButton size="sm" variant="ghost" confirm={`¿Eliminar la sucursal ${b.name}? Sus tareas quedarán sin sucursal.`}>Eliminar</SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted">Todavía no hay sucursales.</p>}
      </Card>
      {canManage && (
        <Card>
          <CardHeader title="Nueva sucursal" />
          <ActionForm action={createBranchAction} resetOnSuccess className="grid gap-3 p-5">
            <div><Label htmlFor="b-name">Nombre</Label><Input id="b-name" name="name" required minLength={2} placeholder="Ej.: Centro" /></div>
            <SubmitButton>Crear</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function Privacy({ ctxRole, privacy, slug, isDemo, aiConfigured }: { ctxRole: import("@/lib/auth/permissions").Role; privacy: import("@/lib/privacy").PrivacySettings; slug: string; isDemo: boolean; aiConfigured: boolean }) {
  const manage = can(ctxRole, "privacy.manage");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Privacidad" description={manage ? "Se aplica a las próximas importaciones y análisis." : "Sólo lectura para tu rol."} />
        <ActionForm action={updatePrivacyAction} className="grid gap-3 p-5">
          <Toggle name="redact_phones" label="Enmascarar teléfonos" hint="Números en mensajes y autores sin agendar." defaultChecked={privacy.redact_phones} disabled={!manage} />
          <Toggle name="redact_emails" label="Enmascarar correos" hint="Direcciones de email dentro de los mensajes." defaultChecked={privacy.redact_emails} disabled={!manage} />
          <Toggle
            name="ai_enabled"
            label="Permitir análisis con IA"
            hint={`Envía texto de mensajes (con alias en lugar de nombres) a Claude desde el servidor. ${aiConfigured ? "Clave configurada." : "Sin clave configurada en el servidor."}`}
            defaultChecked={privacy.ai_enabled}
            disabled={!manage}
          />
          <div>
            <Label htmlFor="ret" hint="vacío = sin límite · 7 a 3650">Retención de mensajes (días)</Label>
            <Input id="ret" name="retention_days" type="number" min={7} max={3650} defaultValue={privacy.retention_days ?? ""} disabled={!manage} />
          </div>
          {manage && <SubmitButton>Guardar</SubmitButton>}
        </ActionForm>
      </Card>

      <div className="grid content-start gap-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold"><KeyRound className="size-3.5 text-accent" />Cómo se protegen los datos</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
            <li>Contraseñas con scrypt; sesiones con tokens aleatorios guardados como hash.</li>
            <li>La línea original de cada mensaje se cifra con AES-256-GCM.</li>
            <li>Cada consulta verifica tu pertenencia a la empresa y tu rol.</li>
            <li>Los adjuntos de WhatsApp nunca se almacenan.</li>
            <li>No se generan evaluaciones de desempeño ni sanciones automáticas.</li>
          </ul>
        </Card>
        {manage && privacy.retention_days && (
          <Card className="p-5">
            <p className="text-[13px] font-semibold">Aplicar retención ahora</p>
            <p className="mt-1 text-xs text-muted">Elimina mensajes de más de {privacy.retention_days} días. Las tareas validadas se conservan.</p>
            <ActionForm action={applyRetentionAction} className="mt-3">
              <SubmitButton size="sm" variant="danger" confirm="¿Eliminar definitivamente los mensajes fuera del período de retención?">Aplicar retención</SubmitButton>
            </ActionForm>
          </Card>
        )}
        {can(ctxRole, "company.delete") && (
          <Card className="p-5 ring-1 ring-inset ring-danger/20">
            <p className="text-[13px] font-semibold text-danger">Eliminar empresa{isDemo ? " de demostración" : ""}</p>
            <p className="mt-1 text-xs text-muted">Borra de forma irreversible conversaciones, mensajes, hallazgos, tareas, sucursales y membresías. Escribí <code className="rounded bg-white/5 px-1 font-mono text-fg">{slug}</code> para confirmar.</p>
            <ActionForm action={deleteCompanyAction} className="mt-3 flex flex-wrap gap-2">
              <Input name="confirm" placeholder={slug} className="h-8 w-56 text-xs" aria-label="Confirmación" autoComplete="off" />
              <SubmitButton size="sm" variant="danger">Eliminar todo</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
