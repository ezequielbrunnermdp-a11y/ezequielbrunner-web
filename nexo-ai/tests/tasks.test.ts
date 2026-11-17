import { beforeAll, describe, expect, it } from "vitest";
import { checkTransition, isOverdue } from "@/lib/tasks/transitions";
import { changeTaskStatus, createTask, getTask, listTasks, updateTask, ValidationError } from "@/lib/tasks/service";
import { importChat } from "@/lib/imports/service";
import { runAnalysis } from "@/lib/analysis/service";
import { approveFinding, confirmCompletion, listFindings, rejectFinding } from "@/lib/analysis/review";
import { authorize } from "@/lib/auth/permissions";
import type { Db } from "@/lib/db";
import { enc, makeCompanyWithOwner, makeDb } from "./helpers/db";

describe("máquina de estados de tareas", () => {
  it("exige evidencia o nota para marcar cumplida", () => {
    expect(checkTransition({ from: "pending", to: "done" }).ok).toBe(false);
    expect(checkTransition({ from: "pending", to: "done", note: "Verificado en el local" }).ok).toBe(true);
    expect(checkTransition({ from: "in_progress", to: "done", evidenceMessageId: "x" }).ok).toBe(true);
  });
  it("exige motivo para descartar o reabrir", () => {
    expect(checkTransition({ from: "pending", to: "discarded" }).ok).toBe(false);
    expect(checkTransition({ from: "done", to: "pending" }).ok).toBe(false);
    expect(checkTransition({ from: "done", to: "pending", note: "Volvió a fallar" }).ok).toBe(true);
  });
  it("bloquea transiciones no permitidas", () => {
    expect(checkTransition({ from: "done", to: "in_progress", note: "x" }).ok).toBe(false);
    expect(checkTransition({ from: "discarded", to: "done", note: "x" }).ok).toBe(false);
    expect(checkTransition({ from: "pending", to: "pending" }).ok).toBe(false);
  });
  it("calcula vencimientos sólo para tareas abiertas", () => {
    expect(isOverdue("pending", "2024-03-01", "2024-03-02")).toBe(true);
    expect(isOverdue("done", "2024-03-01", "2024-03-02")).toBe(false);
    expect(isOverdue("pending", "2024-03-02", "2024-03-02")).toBe(false);
    expect(isOverdue("pending", null, "2024-03-02")).toBe(false);
  });
});

const CHAT = `12/03/2024, 09:15 - Laura Gómez: Martín, hay que pedir harina 000 para mañana
12/03/2024, 09:20 - Martín Ruiz: Yo me encargo
12/03/2024, 18:02 - Martín Ruiz: Listo, ya la pedí al proveedor
12/03/2024, 18:30 - Laura Gómez: Genial`;

describe("seguimiento de tareas con trazabilidad", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeDb();
  });

  it("crea, edita y cambia estados registrando cada evento", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "tasks.write");
    const id = await createTask(ctx, { title: "Limpiar campana", priority: "high", due_date: "2024-03-20" });
    await updateTask(ctx, id, { title: "Limpiar campana extractora", priority: "high", due_date: "2024-03-20" });
    await changeTaskStatus(ctx, id, "in_progress");
    await expect(changeTaskStatus(ctx, id, "done")).rejects.toBeInstanceOf(ValidationError);
    await changeTaskStatus(ctx, id, "done", { note: "Revisado por el encargado" });
    const t = await getTask(ctx, id);
    expect(t?.task.status).toBe("done");
    expect(t?.task.completed_at).toBeTruthy();
    expect(t?.events.map((e) => e.type)).toEqual(["created", "edited", "status", "status"]);
    expect(t?.events.at(-1)).toMatchObject({ from_status: "in_progress", to_status: "done", note: "Revisado por el encargado" });
    await changeTaskStatus(ctx, id, "pending", { note: "Reapareció grasa" });
    expect((await getTask(ctx, id))?.task.completed_at).toBeNull();
  });

  it("los hallazgos sólo se vuelven tareas con validación humana y conservan la evidencia", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "imports.create");
    const imp = await importChat(ctx, { fileName: "c.txt", bytes: enc(CHAT), title: "Cocina" });

    const run = await runAnalysis(ctx, imp.conversationId, { engine: "heuristic" });
    expect(run.error).toBeNull();
    expect(run.messagesAnalyzed).toBe(4);
    // Nada se convirtió en tarea automáticamente.
    expect(await listTasks(ctx, { status: "all" })).toHaveLength(0);

    const proposed = await listFindings(ctx, "proposed");
    const task = proposed.find((f) => f.type === "task")!;
    const done = proposed.find((f) => f.type === "completion_signal")!;
    const commitment = proposed.find((f) => f.type === "commitment")!;
    expect(task.due_date).toBe("2024-03-13");
    expect(task.assignee_label).toBe("Martín Ruiz");
    expect(task.evidence[0]).toMatchObject({ source_line: 1, file_name: "c.txt" });
    expect(Number(task.confidence)).toBeLessThanOrEqual(0.6);

    const { taskId } = await approveFinding(ctx, task.id, { title: "Pedir harina 000", priority: "high", due_date: task.due_date, assignee_label: task.assignee_label });
    expect(taskId).toBeTruthy();
    await expect(approveFinding(ctx, task.id, { title: "otra vez" })).rejects.toThrow(/ya fue revisado/);
    await rejectFinding(ctx, commitment.id, "Duplica la tarea");

    // La señal de cumplimiento sólo cierra la tarea cuando una persona la vincula.
    await confirmCompletion(ctx, done.id, taskId!, null);
    const detail = await getTask(ctx, taskId!);
    expect(detail?.task.status).toBe("done");
    const last = detail!.events.at(-1)!;
    expect(last.to_status).toBe("done");
    expect(last.evidence_message_id).toBeTruthy();
    expect(detail!.evidence.map((e) => e.source_line).sort()).toEqual([1, 3]);
  });

  it("reanalizar no duplica hallazgos", async () => {
    const { owner, company } = await makeCompanyWithOwner(db);
    const ctx = await authorize(db, owner.id, company.id, "imports.create");
    const imp = await importChat(ctx, { fileName: "c.txt", bytes: enc(CHAT), title: "Cocina" });
    const a = await runAnalysis(ctx, imp.conversationId, { engine: "heuristic" });
    const b = await runAnalysis(ctx, imp.conversationId, { engine: "heuristic", reanalyze: true });
    const c = await runAnalysis(ctx, imp.conversationId, { engine: "heuristic" });
    expect(a.findingsCreated).toBeGreaterThan(0);
    expect(b.findingsCreated).toBe(0);
    expect(c.messagesAnalyzed).toBe(0);
  });
});
