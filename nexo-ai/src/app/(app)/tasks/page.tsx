import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus, Sparkles } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listTasks, type TaskFilters } from "@/lib/tasks/service";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/tasks/transitions";
import { Button, buttonClass, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { DueLabel, PriorityBadge, StatusBadge, todayLocal } from "@/components/labels";
import { createTaskAction } from "../../actions/work";

export const metadata: Metadata = { title: "Tareas" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx("data.read");
  const filters: TaskFilters = {
    status: (sp.status && (["open", "all", ...TASK_STATUSES] as string[]).includes(sp.status) ? sp.status : "open") as TaskFilters["status"],
    branchId: sp.branch && /^[0-9a-f-]{36}$/i.test(sp.branch) ? sp.branch : undefined,
    priority: sp.priority && (PRIORITIES as readonly string[]).includes(sp.priority) ? sp.priority : undefined,
    q: sp.q?.slice(0, 100) || undefined,
    overdue: sp.overdue === "1",
  };
  const [tasks, branches] = await Promise.all([
    listTasks(ctx, filters),
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
  ]);
  const today = todayLocal();
  const canWrite = can(ctx.role, "tasks.write");
  const filtered = Boolean(filters.branchId || filters.priority || filters.q || filters.overdue || filters.status !== "open");

  return (
    <>
      <PageHeader title="Tareas" description="Tareas validadas por personas o creadas manualmente, con su historial completo." />

      {canWrite && (
        <details className="group mb-5">
          <summary className={buttonClass("primary") + " cursor-pointer list-none [&::-webkit-details-marker]:hidden"}>
            <Plus className="size-4 transition-transform group-open:rotate-45" />Nueva tarea
          </summary>
          <Card className="mt-3 p-5 animate-fade-up">
            <ActionForm action={createTaskAction} className="grid gap-4">
              <TaskFields branches={branches.rows} idp="new" />
              <div><SubmitButton pendingLabel="Creando…">Crear tarea</SubmitButton></div>
            </ActionForm>
          </Card>
        </details>
      )}

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="search" aria-label="Filtrar tareas">
        <Input name="q" defaultValue={filters.q} placeholder="Buscar por título o responsable" className="col-span-2 sm:w-64" aria-label="Buscar" />
        <Select name="status" defaultValue={filters.status} className="sm:w-48" aria-label="Estado">
          <option value="open">Abiertas</option>
          <option value="all">Todas</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
        <Select name="branch" defaultValue={filters.branchId ?? ""} className="sm:w-40" aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {branches.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select name="priority" defaultValue={filters.priority ?? ""} className="sm:w-36" aria-label="Prioridad">
          <option value="">Toda prioridad</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </Select>
        <label className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted ring-1 ring-inset ring-white/10">
          <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} className="accent-[#5EEAD4]" />Vencidas
        </label>
        <Button type="submit">Filtrar</Button>
        {filtered && <Link href="/tasks" className={buttonClass("ghost")}>Limpiar</Link>}
      </form>

      <Card>
        {tasks.length ? (
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-white/[0.025] md:grid-cols-[1fr_150px_100px_120px]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {t.source === "finding" && <Sparkles className="size-3 shrink-0 text-accent/70" aria-label="Validada desde un hallazgo" />}
                      <span className="truncate">{t.title}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{[t.branch_name, t.assignee_label].filter(Boolean).join(" · ") || "Sin sucursal ni responsable"}</p>
                  </div>
                  <div className="justify-self-end md:justify-self-start"><StatusBadge status={t.status as TaskStatus} /></div>
                  <div className="hidden md:block"><PriorityBadge priority={t.priority} /></div>
                  <div className="col-span-2 text-xs md:col-span-1 md:text-right"><DueLabel due={t.due_date} status={t.status} today={today} /></div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<ListChecks className="size-5" />} title={filtered ? "Sin resultados" : "No hay tareas abiertas"}>
            {filtered ? "Probá con otros filtros." : "Validá hallazgos en la bandeja o creá una tarea manualmente."}
          </EmptyState>
        )}
      </Card>
      {tasks.length >= 500 && <p className="mt-2 text-xs text-muted">Se muestran las primeras 500. Usá los filtros para acotar.</p>}
    </>
  );
}
