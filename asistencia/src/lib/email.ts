import { q, one } from "./db";

/** Encola un correo (idempotente por dedupe_key). El envío lo hace el worker. */
export async function enqueueEmail(to: string, subject: string, html: string, dedupeKey?: string) {
  await q(
    `insert into email_outbox (to_address, subject, html, dedupe_key) values ($1,$2,$3,$4) on conflict (dedupe_key) do nothing`,
    [to, subject, html, dedupeKey ?? null],
  );
}

async function deliver(to: string, subject: string, html: string) {
  const provider = process.env.EMAIL_PROVIDER ?? "log";
  const from = process.env.EMAIL_FROM ?? "Asistencia <no-reply@localhost>";
  if (provider === "log") {
    console.log(`[email:log] para=${to} asunto="${subject}" (${html.length} bytes)`);
    return;
  }
  if (provider === "resend") {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  if (provider === "webhook") {
    // Para integrar cualquier proveedor (SMTP relay, SendGrid, n8n…) mediante un endpoint propio.
    const r = await fetch(process.env.EMAIL_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN ?? ""}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) throw new Error(`Webhook ${r.status}`);
    return;
  }
  throw new Error(`EMAIL_PROVIDER desconocido: ${provider}`);
}

export async function processOutbox(limit = 20): Promise<number> {
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    // Toma un mensaje con bloqueo para que dos workers no envíen el mismo.
    const m = await one(
      `update email_outbox set attempts = attempts + 1 where id = (
         select id from email_outbox where status = 'pending' and attempts < 5 order by created_at limit 1 for update skip locked
       ) returning id, to_address, subject, html, attempts`,
    );
    if (!m) break;
    try {
      await deliver(m.to_address, m.subject, m.html);
      await q(`update email_outbox set status = 'sent', sent_at = now(), last_error = null where id = $1`, [m.id]);
      sent++;
    } catch (e: any) {
      await q(`update email_outbox set status = case when attempts >= 5 then 'failed' else 'pending' end, last_error = $2 where id = $1`, [m.id, String(e?.message ?? e).slice(0, 500)]);
    }
  }
  return sent;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
