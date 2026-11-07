"use server";

import { requireCtx } from "@/lib/auth/session";
import { askQuestion, type AskResult } from "@/lib/search/service";
import { errorMessage } from "@/lib/action";

export type AskState = { question: string; result?: AskResult; error?: string } | null;

export async function askAction(_: AskState, fd: FormData): Promise<AskState> {
  const question = String(fd.get("question") ?? "").trim().slice(0, 500);
  if (question.length < 4) return { question, error: "Escribí una pregunta un poco más completa." };
  try {
    const ctx = await requireCtx("data.read");
    return { question, result: await askQuestion(ctx, question) };
  } catch (e) {
    return { question, error: errorMessage(e) };
  }
}
