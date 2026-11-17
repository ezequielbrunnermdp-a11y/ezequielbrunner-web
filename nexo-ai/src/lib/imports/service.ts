import type { Queryable } from "../db";
import { assertCan, ForbiddenError, type Ctx } from "../auth/permissions";
import { slugify } from "../auth/accounts";
import { audit } from "../audit";
import { encrypt, sha256 } from "../crypto";
import { looksLikeInjection, readPrivacy, redactAuthor, redactText } from "../privacy";
import { extractChat, ImportFileError } from "../whatsapp/archive";
import { computeContentHashes } from "../whatsapp/dedupe";
import { inferKind, parseWhatsAppText, titleFromFileName, type DateOrder } from "../whatsapp/parser";

export interface ImportInput {
  fileName: string;
  bytes: Uint8Array;
  conversationId?: string | null;
  title?: string | null;
  branchId?: string | null;
  dateOrder?: DateOrder | "auto";
}

export interface ImportSummary {
  importId: string;
  conversationId: string;
  conversationTitle: string;
  totalParsed: number;
  inserted: number;
  duplicates: number;
  systemMessages: number;
  dateOrder: DateOrder;
  warnings: string[];
}

const CHUNK = 200;

export async function importChat(ctx: Ctx, input: ImportInput): Promise<ImportSummary> {
  assertCan(ctx, "imports.create");
  const extracted = extractChat(input.fileName, input.bytes);
  const parsed = parseWhatsAppText(extracted.text, { dateOrder: input.dateOrder ?? "auto" });
  if (!parsed.messages.length) throw new ImportFileError(parsed.warnings.at(-1) ?? "No se encontraron mensajes.");

  const warnings = [...parsed.warnings];
  if (extracted.ignoredAttachments) {
    warnings.push(`${extracted.ignoredAttachments} adjunto(s) del ZIP no se guardaron (sólo se procesa el texto).`);
  }

  const company = await ctx.db.query<{ settings: unknown }>(`select settings from companies where id = $1`, [ctx.companyId]);
  const privacy = readPrivacy(company.rows[0]?.settings);
  const fileHash = sha256(input.bytes);
  const hashes = computeContentHashes(parsed.messages);

  if (input.branchId) {
    const b = await ctx.db.query(`select 1 from branches where id = $1 and company_id = $2`, [input.branchId, ctx.companyId]);
    if (!b.rows.length) throw new ForbiddenError("Sucursal inválida.");
  }

  return ctx.db.tx(run);

  async function run(q: Queryable): Promise<ImportSummary> {
    // 1) Conversación destino (existente de esta empresa o nueva por título).
    let conv: { id: string; title: string };
    if (input.conversationId) {
      const r = await q.query<{ id: string; title: string }>(
        `select id, title from conversations where id = $1 and company_id = $2`,
        [input.conversationId, ctx.companyId],
      );
      if (!r.rows[0]) throw new ForbiddenError("Conversación inválida.");
      conv = r.rows[0];
    } else {
      const title = (input.title?.trim() || titleFromFileName(input.fileName)).slice(0, 160);
      const fingerprint = slugify(title);
      const existing = await q.query<{ id: string; title: string }>(
        `select id, title from conversations where company_id = $1 and fingerprint = $2`,
        [ctx.companyId, fingerprint],
      );
      conv =
        existing.rows[0] ??
        (
          await q.query<{ id: string; title: string }>(
            `insert into conversations (company_id, branch_id, title, kind, fingerprint) values ($1, $2, $3, $4, $5)
             returning id, title`,
            [ctx.companyId, input.branchId ?? null, title, inferKind(parsed), fingerprint],
          )
        ).rows[0];
    }

    const prev = await q.query<{ created_at: string }>(
      `select created_at from imports where conversation_id = $1 and file_sha256 = $2 order by created_at limit 1`,
      [conv.id, fileHash],
    );
    if (prev.rows[0]) warnings.push("Este archivo exacto ya se había importado en esta conversación: no se duplicará ningún mensaje.");

    // 2) Registro de importación (procedencia).
    const imp = await q.query<{ id: string }>(
      `insert into imports (company_id, conversation_id, file_name, file_sha256, file_size, source_kind, date_order, total_parsed, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [ctx.companyId, conv.id, input.fileName.slice(0, 255), fileHash, input.bytes.length, extracted.sourceKind, parsed.dateOrder, parsed.messages.length, ctx.userId],
    );
    const importId = imp.rows[0].id;

    // 3) Participantes (con minimización: números sin agendar se enmascaran).
    const participantIds = new Map<string, string>();
    for (const author of parsed.authors) {
      const label = redactAuthor(author, privacy);
      const r = await q.query<{ id: string }>(
        `insert into participants (company_id, conversation_id, display_name) values ($1, $2, $3)
         on conflict (conversation_id, display_name) do update set display_name = excluded.display_name returning id`,
        [ctx.companyId, conv.id, label],
      );
      participantIds.set(author, r.rows[0].id);
    }

    // 4) Mensajes: inserción idempotente por (conversación, huella).
    let inserted = 0;
    for (let i = 0; i < parsed.messages.length; i += CHUNK) {
      const slice = parsed.messages.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const rows = slice.map((m, j) => {
        const author = m.author ? redactAuthor(m.author, privacy) : null;
        const body = m.kind === "text" ? redactText(m.body, privacy) : m.body;
        const params = [
          ctx.companyId, conv.id, importId, m.author ? participantIds.get(m.author) ?? null : null,
          m.sentAt, author, body, m.kind, m.edited, hashes[i + j], m.line, encrypt(m.raw),
          m.kind === "text" && looksLikeInjection(m.body),
        ];
        const base = values.length;
        values.push(...params);
        return `(${params.map((_, k) => `$${base + k + 1}`).join(", ")})`;
      });
      const r = await q.query<{ id: string }>(
        `insert into messages (company_id, conversation_id, import_id, participant_id, sent_at, author_label, body, kind, edited, content_hash, source_line, source_raw_enc, suspicious)
         values ${rows.join(", ")}
         on conflict (conversation_id, content_hash) do nothing returning id`,
        values,
      );
      inserted += r.rows.length;
    }

    const systemMessages = parsed.messages.filter((m) => m.kind === "system").length;
    const duplicates = parsed.messages.length - inserted;
    await q.query(
      `update imports set inserted = $2, duplicates = $3, system_messages = $4, warnings = $5 where id = $1`,
      [importId, inserted, duplicates, systemMessages, JSON.stringify(warnings)],
    );
    await audit(q, {
      companyId: ctx.companyId, actorId: ctx.userId, action: "import.create", targetType: "import", targetId: importId,
      metadata: { conversation_id: conv.id, total: parsed.messages.length, inserted, duplicates },
    });

    return {
      importId, conversationId: conv.id, conversationTitle: conv.title, totalParsed: parsed.messages.length,
      inserted, duplicates, systemMessages, dateOrder: parsed.dateOrder, warnings,
    };
  }
}

/** Elimina una importación y los mensajes que aportó (los que no aportó, por ser duplicados, quedan). */
export async function deleteImport(ctx: Ctx, importId: string) {
  assertCan(ctx, "imports.delete");
  const r = await ctx.db.query<{ id: string }>(
    `delete from imports where id = $1 and company_id = $2 returning id`,
    [importId, ctx.companyId],
  );
  if (!r.rows.length) throw new ForbiddenError("Importación inexistente.");
  await cleanupOrphanFindings(ctx);
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "import.delete", targetType: "import", targetId: importId });
}

export async function deleteConversation(ctx: Ctx, conversationId: string) {
  assertCan(ctx, "imports.delete");
  const r = await ctx.db.query(`delete from conversations where id = $1 and company_id = $2 returning id`, [conversationId, ctx.companyId]);
  if (!r.rows.length) throw new ForbiddenError("Conversación inexistente.");
  await audit(ctx.db, { companyId: ctx.companyId, actorId: ctx.userId, action: "conversation.delete", targetType: "conversation", targetId: conversationId });
}

/** Un hallazgo pendiente sin evidencia ya no es trazable: se elimina. */
export async function cleanupOrphanFindings(ctx: Ctx) {
  await ctx.db.query(
    `delete from findings f where f.company_id = $1 and f.status = 'proposed'
     and not exists (select 1 from finding_evidence e where e.finding_id = f.id)`,
    [ctx.companyId],
  );
}
