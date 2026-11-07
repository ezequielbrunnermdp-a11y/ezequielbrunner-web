import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Search as SearchIcon } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { searchMessages } from "@/lib/search/service";
import { claudeAvailable } from "@/lib/analysis/claude";
import { getPrivacy } from "@/lib/admin/service";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { AskPanel } from "@/components/ask-panel";
import { fmtLocal } from "@/components/labels";
import { HighlightedQuote } from "@/components/quote";

export const metadata: Metadata = { title: "Buscador" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx("data.read");
  const q = sp.q?.trim().slice(0, 300) ?? "";
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const conversationId = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : undefined;
  const [hits, convs, privacy] = await Promise.all([
    q ? searchMessages(ctx, q, { conversationId, from: date(sp.from), to: date(sp.to), limit: 60 }) : Promise.resolve([]),
    ctx.db.query<{ id: string; title: string }>(`select id, title from conversations where company_id = $1 order by title`, [ctx.companyId]),
    getPrivacy(ctx),
  ]);

  return (
    <>
      <PageHeader title="Buscador" description="Preguntá en lenguaje natural o buscá palabras. Toda respuesta se respalda con citas a los mensajes originales." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Preguntar" description="Respuesta generada con citas verificadas contra los mensajes" />
          <div className="p-5"><AskPanel aiReady={claudeAvailable() && privacy.ai_enabled} /></div>
        </Card>

        <Card>
          <CardHeader title="Buscar en mensajes" description="Búsqueda de texto en español (incluye variaciones: pedir, pedí, pedido…)" />
          <form className="grid gap-2 p-5 sm:grid-cols-2" role="search">
            <Input name="q" defaultValue={q} placeholder="Ej.: harina proveedor" className="sm:col-span-2" aria-label="Términos de búsqueda" />
            <Select name="c" defaultValue={conversationId ?? ""} aria-label="Conversación" className="sm:col-span-2">
              <option value="">Todas las conversaciones</option>
              {convs.rows.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
            <Input type="date" name="from" defaultValue={date(sp.from)} aria-label="Desde" />
            <Input type="date" name="to" defaultValue={date(sp.to)} aria-label="Hasta" />
            <Button type="submit" variant="secondary" className="sm:col-span-2"><SearchIcon className="size-4" />Buscar</Button>
          </form>
          {q && (
            <div className="border-t border-line">
              {hits.length ? (
                <ul className="divide-y divide-line">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <Link href={`/conversations/${h.conversation_id}?m=${h.id}#m-${h.id}`} className="block px-5 py-3 transition-colors hover:bg-white/[0.025]">
                        <p className="text-xs"><span className="font-semibold">{h.author_label ?? "—"}</span> <span className="text-faint">· {h.conversation_title} · {fmtLocal(h.sent_at, true)}</span></p>
                        <p className="mt-1 line-clamp-3 text-sm text-fg/85"><HighlightedQuote body={h.body} quote={q} /></p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<SearchX className="size-5" />} title="Sin coincidencias">Probá con otras palabras o ampliá el rango de fechas.</EmptyState>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
