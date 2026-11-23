import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Eye, CheckCircle2, FolderLock, Info } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingList, Notice, PageHeader, Segmented } from '@/components/ui';
import { useToast } from '@/components/Toast';

export interface Doc { id: string; owner_user_id: string | null; category: string; title: string; description: string | null; storage_path: string; mime_type: string | null; size_bytes: number | null; requires_ack: boolean; published_at: string }
export const DOC_CAT: Record<string, string> = {
  payslip: 'Recibo de haberes', certificate: 'Certificado', training: 'Constancia de capacitación', contract: 'Documentación laboral',
  disciplinary: 'Comunicación disciplinaria', medical: 'Documentación médica', general: 'Documento general', policy: 'Política interna', manual: 'Manual', communication: 'Comunicación institucional',
};

export function DocumentsPage() {
  const { ctx } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'mine' | 'general'>('mine');
  const q = useQuery({ queryKey: ['documents'], queryFn: async () => {
    const { data, error } = await supabase.from('documents').select('*').order('published_at', { ascending: false });
    if (error) throw error; return data as Doc[];
  } });
  const events = useQuery({ queryKey: ['doc-events'], queryFn: async () => {
    const { data, error } = await supabase.from('document_events').select('document_id, event').eq('user_id', ctx!.user_id);
    if (error) throw error; return data as { document_id: string; event: string }[];
  } });
  const ack = useAction((id: string) => rpc('log_document_event', { p_doc: id, p_event: 'acknowledged' }), { success: 'Registramos que lo leíste', invalidate: [['doc-events']] });
  const open = async (d: Doc, download: boolean) => {
    try {
      // URL firmada de 2 minutos: el servidor valida el permiso; conocer la ruta no alcanza.
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 120, download ? { download: d.title + (d.mime_type === 'application/pdf' ? '.pdf' : '') } : undefined);
      if (error) throw error;
      await rpc('log_document_event', { p_doc: d.id, p_event: download ? 'downloaded' : 'viewed' });
      window.open(data.signedUrl, '_blank', 'noopener');
      void events.refetch();
    } catch (e) { toast(errorMessage(e), 'bad'); }
  };
  const mine = q.data?.filter((d) => d.owner_user_id === ctx?.user_id) ?? [];
  const general = q.data?.filter((d) => !d.owner_user_id) ?? [];
  const list = tab === 'mine' ? mine : general;
  const has = (id: string, ev: string) => events.data?.some((e) => e.document_id === id && e.event === ev);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Documentos" subtitle="Tu legajo digital y la documentación de la empresa" />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'mine', label: 'Personales' }, { value: 'general', label: 'Generales' }]} />
      {tab === 'mine' && <div className="mb-4"><Notice tone="info" icon={<Info className="h-4 w-4" />}>Solo vos y las áreas autorizadas pueden ver tus documentos personales. Ver o descargar un documento en el portal no equivale a una firma ni a una notificación fehaciente.</Notice></div>}
      {q.isLoading ? <LoadingList /> : q.isError ? <ErrorState error={q.error} /> : list.length === 0 ? (
        <EmptyState icon={<FolderLock className="h-5 w-5" />} title={tab === 'mine' ? 'No tenés documentos personales todavía' : 'No hay documentos generales'} compact />
      ) : (
        <ul className="space-y-2.5">
          {list.map((d) => (
            <Card as="li" key={d.id} className="flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                <p className="text-xs text-ink-3">{DOC_CAT[d.category]} · {fmtDate(d.published_at)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {!has(d.id, 'viewed') && !has(d.id, 'downloaded') && <Badge tone="accent">Nuevo</Badge>}
                  {d.requires_ack && (has(d.id, 'acknowledged') ? <Badge tone="ok"><CheckCircle2 className="h-3 w-3" />Leído</Badge> : <Badge tone="warn">Requiere confirmar lectura</Badge>)}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => void open(d, false)}>Ver</Button>
                <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void open(d, true)} aria-label="Descargar" />
                {d.requires_ack && !has(d.id, 'acknowledged') && <Button size="sm" onClick={() => ack.mutate(d.id)}>Confirmar lectura</Button>}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
