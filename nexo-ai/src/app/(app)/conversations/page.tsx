import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Users, User } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fmtLocal } from "@/components/labels";

export const metadata: Metadata = { title: "Conversaciones" };

export default async function ConversationsPage() {
  const ctx = await requireCtx("data.read");
  const rows = (await ctx.db.query<{ id: string; title: string; kind: string; branch: string | null; messages: number; pending: number; last: string | null; unanalyzed: number; participants: number }>(
    `select c.id, c.title, c.kind, b.name as branch,
       (select count(*)::int from messages m where m.conversation_id = c.id) as messages,
       (select count(*)::int from messages m where m.conversation_id = c.id and m.kind = 'text' and m.analyzed_at is null) as unanalyzed,
       (select count(*)::int from findings f where f.conversation_id = c.id and f.status = 'proposed') as pending,
       (select count(*)::int from participants p where p.conversation_id = c.id) as participants,
       (select to_char(max(m.sent_at), 'YYYY-MM-DD"T"HH24:MI') from messages m where m.conversation_id = c.id) as last
     from conversations c left join branches b on b.id = c.branch_id
     where c.company_id = $1 order by last desc nulls last`,
    [ctx.companyId],
  )).rows;

  return (
    <>
      <PageHeader title="Conversaciones" description="Chats importados, con su estado de análisis." actions={<LinkButton href="/imports" variant="primary">Importar</LinkButton>} />
      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/conversations/${c.id}`} className="group animate-fade-up">
              <Card as="div" className="h-full p-5 transition-transform duration-200 group-hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-muted ring-1 ring-inset ring-white/10 group-hover:text-accent">
                    {c.kind === "group" ? <Users className="size-4" /> : <User className="size-4" />}
                  </span>
                  {c.pending > 0 && <Badge tone="accent">{c.pending} por validar</Badge>}
                </div>
                <h2 className="mt-4 truncate text-[15px] font-semibold tracking-[-0.01em]">{c.title}</h2>
                <p className="mt-1 text-xs text-muted">
                  {c.kind === "group" ? "Grupo" : "Individual"} · {c.participants} participantes{c.branch ? ` · ${c.branch}` : ""}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span className="tabular">{c.messages} mensajes</span>
                  <span>Último: {fmtLocal(c.last)}</span>
                </div>
                {c.unanalyzed > 0 && <p className="mt-2 text-xs text-warn">{c.unanalyzed} mensajes sin analizar</p>}
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon={<MessagesSquare className="size-5" />} title="Sin conversaciones" action={<LinkButton href="/imports" variant="primary">Importar chat</LinkButton>}>Importá tu primera conversación de WhatsApp.</EmptyState></Card>
      )}
    </>
  );
}
