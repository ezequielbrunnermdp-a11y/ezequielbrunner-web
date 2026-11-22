"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth/session";
import { COMPANY_COOKIE } from "@/lib/auth/session";
import { run, str, type ActionState } from "@/lib/action";
import {
  addMember, applyRetention, changeMemberRole, createBranch, deleteBranch, deleteCompany, removeMember, updatePrivacy,
} from "@/lib/admin/service";
import type { Role } from "@/lib/auth/permissions";

export async function createBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await createBranch(await requireCtx("branches.manage"), str(fd, "name"));
    revalidatePath("/", "layout");
    return "Sucursal creada.";
  });
}

export async function deleteBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await deleteBranch(await requireCtx("branches.manage"), str(fd, "branch_id"));
    revalidatePath("/", "layout");
    return "Sucursal eliminada. Sus tareas quedaron sin sucursal asignada.";
  });
}

export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await addMember(await requireCtx("members.manage"), {
      email: str(fd, "email"), name: str(fd, "name"), password: str(fd, "password"), role: str(fd, "role") as Role,
    });
    revalidatePath("/admin");
    return "Miembro agregado.";
  });
}

export async function changeRoleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await changeMemberRole(await requireCtx("members.manage"), str(fd, "user_id"), str(fd, "role") as Role);
    revalidatePath("/admin");
    return "Rol actualizado.";
  });
}

export async function removeMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await removeMember(await requireCtx("members.manage"), str(fd, "user_id"));
    revalidatePath("/admin");
    return "Miembro quitado de la empresa.";
  });
}

export async function updatePrivacyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const days = str(fd, "retention_days");
    await updatePrivacy(await requireCtx("privacy.manage"), {
      redact_phones: fd.get("redact_phones") === "on",
      redact_emails: fd.get("redact_emails") === "on",
      ai_enabled: fd.get("ai_enabled") === "on",
      retention_days: days ? Number(days) : null,
    });
    revalidatePath("/", "layout");
    return "Configuración de privacidad guardada. El enmascaramiento se aplica a las próximas importaciones.";
  });
}

export async function applyRetentionAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const n = await applyRetention(await requireCtx("privacy.manage"));
    revalidatePath("/", "layout");
    return `Se eliminaron ${n} mensaje(s) fuera del período de retención.`;
  });
}

export async function deleteCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run(async () => {
    await deleteCompany(await requireCtx("company.delete"), str(fd, "confirm"));
  });
  if (!r?.ok) return r;
  (await cookies()).delete(COMPANY_COOKIE);
  redirect("/dashboard");
}
