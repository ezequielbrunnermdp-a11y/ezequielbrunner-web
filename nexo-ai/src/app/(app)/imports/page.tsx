import type { Metadata } from "next";
import Link from "next/link";
import { History, Lock } from "lucide-react";
import { requireCtx } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { Uploader } from "@/components/uploader";
import { ActionForm, SubmitButton } from "@/components/forms";
import { fmtInstant } from "@/components/labels";
import { deleteImportAction } from "../../actions/work";

export const metadata: Metadata = { title: "Importar" };

export default async function ImportsPage() {
  const ctx = await requireCtx("data.read");
  const [convs, branches, imports] = await Promise.all([
    ctx.db.query<{ id: string; title: string }>(`select id, title from conversations where company_id = $1 order by title`, [ctx.companyId]),
    ctx.db.query<{ id: string; name: string }>(`select id, name from branches where company_id = $1 order by name`, [ctx.companyId]),
    ctx.db.query<{ id: string; file_name: string; source_kind: string; conversation_id: string; title: string; total_parsed: number; inserted: number; duplicates: number; created_at: string; by: string | null; warnings: string[] }>(
      `select i.id, i.file_name, i.source_kind, i.conversation_id, c.title, i.total_parsed, i.inserted, i.duplicates, i.created_at, u.name as by, i.warnings
       from imports i join conversations c on c.id = i.conversation_id left join users u on u.id = i.created_by
       where i.company_id = $1 order by i.created_at desc limit 50`,
      [ctx.companyId],
    ),
  ]);
  const canImport = can(ctx.role, "imports.create");
  const canDelete = can(ctx.role, "imports.delete");

  return (
    <>
      <PageHeader
        eyebrow="Importador"
        title="Importar conversaciones"
        description="Cada mensaje conserva su procedencia: archivo, línea original e importación. Reimportar el mismo chat o una exportación más nueva no duplica mensajes."
      />
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card className="p-5 sm:p-6">
          {canImport ? (
            <Uploader conversations={convs.rows} branches={branches.rows} />
          ) : (
            <EmptyState icon={<Lock className="size-5" />} title="Sin permiso para importar">Tu rol permite ver datos, pero no importar conversaciones.</EmptyState>
          )}
        </Card>
        <div className="grid content-start gap-4">
          <Card className="p-5">
            <h2 className="text-[13px] font-semibold">Cómo exportar desde WhatsApp</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Abrí el chat o grupo.</li>
              <li>Android: ⋮ → Más → Exportar chat. iPhone: nombre del chat → Exportar chat.</li>
              <li>Elegí <strong className="text-fg">Sin archivos</strong> (recomendado) y guardá el .txt o .zip.</li>
            </ol>
          </Card>
          <Notice tone="info" title="Privacidad">
            Sólo se procesa el texto. Fotos, audios y documentos dentro del ZIP se descartan. Teléfonos y correos se enmascaran según la configuración de la empresa.
          </Notice>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Historial de importaciones" description="Eliminar una importación borra los mensajes que aportó y sus hallazgos pendientes." />
        {imports.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-medium">Archivo</th>
                  <th className="px-3 py-2.5 font-medium">Conversación</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leídos</th>
                  <th className="px-3 py-2.5 text-right font-medium">Nuevos</th>
                  <th className="px-3 py-2.5 text-right font-medium">Duplicados</th>
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {imports.rows.map((i) => (
                  <tr key={i.id} className="align-middle">
                    <td className="max-w-[240px] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge>{i.source_kind.toUpperCase()}</Badge>
                        <span className="truncate" title={i.file_name}>{i.file_name}</span>
                      </div>
                      {i.warnings.length > 0 && <p className="mt-1 truncate text-xs text-warn" title={i.warnings.join("\n")}>{i.warnings.length} advertencia(s)</p>}
                    </td>
                    <td className="px-3 py-3"><Link className="hover:text-accent" href={`/conversations/${i.conversation_id}`}>{i.title}</Link></td>
                    <td className="px-3 py-3 text-right tabular text-muted">{i.total_parsed}</td>
                    <td className="px-3 py-3 text-right tabular font-medium text-ok">{i.inserted}</td>
                    <td className="px-3 py-3 text-right tabular text-muted">{i.duplicates}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{fmtInstant(i.created_at)}{i.by && <span className="block text-faint">{i.by}</span>}</td>
                    <td className="px-5 py-3 text-right">
                      {canDelete && (
                        <ActionForm action={deleteImportAction}>
                          <input type="hidden" name="import_id" value={i.id} />
                          <SubmitButton size="sm" variant="ghost" confirm={`¿Eliminar la importación "${i.file_name}" y los ${i.inserted} mensajes que aportó? No se puede deshacer.`}>Eliminar</SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<History className="size-5" />} title="Sin importaciones">Las importaciones que hagas aparecerán acá con su resultado.</EmptyState>
        )}
      </Card>
    </>
  );
}
