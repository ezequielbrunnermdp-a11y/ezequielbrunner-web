"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth/session";
import { optStr, run, str, type ActionState } from "@/lib/action";
import { runAnalysis } from "@/lib/analysis/service";
import { approveFinding, confirmCompletion, rejectFinding } from "@/lib/analysis/review";
import { changeTaskStatus, createTask, updateTask } from "@/lib/tasks/service";
import { deleteConversation, deleteImport } from "@/lib/imports/service";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/auth/accounts";
import { ForbiddenError } from "@/lib/auth/permissions";
import type { TaskStatus } from "@/lib/tasks/transitions";

const taskFields = (fd: FormData) => ({
  title: str(fd, "title"),
  description: optStr(fd, "description"),
  priority: (str(fd, "priority") || "medium") as "low" | "medium" | "high" | "urgent",
  assignee_label: optStr(fd, "assignee_label"),
  due_date: optStr(fd, "due_date"),
  branch_id: optStr(fd, "branch_id"),
});

export async function runAnalysisAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("analysis.run");
    const engine = str(fd, "engine") === "claude" ? "claude" : "heuristic";
    const r = await runAnalysis(ctx, str(fd, "conversation_id"), { engine, reanalyze: fd.get("reanalyze") === "on" });
    revalidatePath("/", "layout");
    if (r.error) throw new ForbiddenError(`El análisis se interrumpió: ${r.error}`);
    if (!r.messagesAnalyzed) return "No había mensajes nuevos para analizar. Activá «reanalizar» para revisar todo el historial.";
    return `Se analizaron ${r.messagesAnalyzed} mensajes: ${r.findingsCreated} hallazgo(s) nuevos en la bandeja de validación` +
      (r.outputsRejected ? `, ${r.outputsRejected} descartado(s) por falta de evidencia verificable` : "") +
      (r.suspiciousMessages ? `. ${r.suspiciousMessages} mensaje(s) con posibles instrucciones maliciosas fueron tratados sólo como texto.` : ".");
  });
}

export async function reviewFindingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("findings.review");
    const id = str(fd, "finding_id");
    const decision = str(fd, "decision");
    const note = optStr(fd, "note");
    if (decision === "approve") {
      const { taskId } = await approveFinding(ctx, id, { ...taskFields(fd), note });
      revalidatePath("/", "layout");
      return taskId ? "Validado: se creó la tarea." : "Validado y registrado.";
    }
    if (decision === "complete") {
      const taskId = str(fd, "task_id");
      if (!taskId) throw new ForbiddenError("Elegí la tarea que este mensaje confirma.");
      await confirmCompletion(ctx, id, taskId, note);
      revalidatePath("/", "layout");
      return "Cumplimiento confirmado con evidencia.";
    }
    await rejectFinding(ctx, id, note, decision === "insufficient" ? "insufficient_info" : "rejected");
    revalidatePath("/", "layout");
    return decision === "insufficient" ? "Marcado como sin información suficiente." : "Descartado.";
  });
}

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const r = await run(async () => {
    const ctx = await requireCtx("tasks.write");
    id = await createTask(ctx, taskFields(fd));
  });
  if (!r?.ok) return r;
  revalidatePath("/", "layout");
  redirect(`/tasks/${id}`);
}

export async function updateTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("tasks.write");
    await updateTask(ctx, str(fd, "task_id"), taskFields(fd));
    revalidatePath("/", "layout");
    return "Cambios guardados.";
  });
}

export async function changeStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("tasks.write");
    await changeTaskStatus(ctx, str(fd, "task_id"), str(fd, "to") as TaskStatus, {
      note: optStr(fd, "note"),
      evidenceMessageId: optStr(fd, "evidence_message_id"),
    });
    revalidatePath("/", "layout");
    return "Estado actualizado.";
  });
}

export async function updateConversationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("imports.create");
    const title = str(fd, "title");
    if (title.length < 2) throw new ForbiddenError("Título muy corto.");
    const branch = optStr(fd, "branch_id");
    if (branch) {
      const b = await ctx.db.query(`select 1 from branches where id = $1 and company_id = $2`, [branch, ctx.companyId]);
      if (!b.rows.length) throw new ForbiddenError("Sucursal inválida.");
    }
    const r = await ctx.db.query(
      `update conversations set title = $3, branch_id = $4, fingerprint = $5 where id = $1 and company_id = $2 returning id`,
      [str(fd, "conversation_id"), ctx.companyId, title, branch, slugify(title)],
    ).catch(() => {
      throw new ForbiddenError("Ya existe otra conversación con ese título.");
    });
    if (!r.rows.length) throw new ForbiddenError("Conversación inexistente.");
    await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "conversation.update", targetType: "conversation", targetId: str(fd, "conversation_id") });
    revalidatePath("/", "layout");
    return "Conversación actualizada.";
  });
}

export async function deleteImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireCtx("imports.delete");
    await deleteImport(ctx, str(fd, "import_id"));
    revalidatePath("/", "layout");
    return "Importación y sus mensajes eliminados.";
  });
}

export async function deleteConversationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run(async () => {
    const ctx = await requireCtx("imports.delete");
    await deleteConversation(ctx, str(fd, "conversation_id"));
  });
  if (!r?.ok) return r;
  revalidatePath("/", "layout");
  redirect("/conversations");
}
