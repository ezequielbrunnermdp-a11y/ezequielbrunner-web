import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ChevronRight, Building2, AlertTriangle } from 'lucide-react';
import { rpc } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { localDate } from '@/lib/format';
import { Card, CardHeader, EmptyState, Notice, PageHeader, Skeleton, Stat } from '@/components/ui';
import { managerItems } from '@/layout/AppShell';

interface Overview { employees_active: number; employees_invited: number; branches: number; branches_pending_verification: number; hr_pending: number; swaps_pending: number; meetings_pending: number; tickets_open: number; reports_open: number | null }
export interface Kpis { scheduled: number; checked_in: number; working: number; late: number; early_leave: number; missing: number; not_closed: number; pending_corrections: number; pending_punches: number; suspicious: number }

export function AdminDashboard() {
  const { ctx, can, needsMfa } = useAuth();
  const org = ctx?.organization?.id;
  const ov = useQuery({ queryKey: ['admin-overview', org], enabled: Boolean(org) && can('employees.view'), queryFn: () => rpc<Overview | null>('admin_overview', { p_org: org }) });
  const kpi = useQuery({ queryKey: ['att-kpis', localDate()], enabled: can('attendance.view'), refetchInterval: 60_000, queryFn: () => rpc<Kpis>('attendance_kpis', { p_day: localDate() }) });
  if (needsMfa) return <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="Verificación en dos pasos requerida" description="Por seguridad, los permisos de gerencia solo se activan con MFA. Cerrá sesión y volvé a ingresar para configurarla." />;
  const o = ov.data;
  const k = kpi.data;
  const tasks = [
    { n: o?.hr_pending, label: 'Solicitudes de RR. HH.', to: '/gerencia/solicitudes' },
    { n: o?.swaps_pending, label: 'Cambios de turno', to: '/gerencia/solicitudes' },
    { n: (k?.pending_punches ?? 0) + (k?.pending_corrections ?? 0), label: 'Fichadas y correcciones', to: '/gerencia/asistencia' },
    { n: o?.meetings_pending, label: 'Reuniones por responder', to: '/gerencia/agenda' },
    { n: o?.tickets_open, label: 'Mensajes a gerencia', to: '/gerencia/comunicaciones' },
    { n: o?.reports_open ?? 0, label: 'Denuncias de contenido', to: '/gerencia/comunidad' },
  ].filter((t) => (t.n ?? 0) > 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Panel de gerencia" subtitle={ctx?.organization?.name} />
      {(o?.branches_pending_verification ?? 0) > 0 && can('branches.manage') && (
        <Link to="/gerencia/sucursales"><Notice tone="warn" icon={<Building2 className="h-4 w-4" />} title={`${o!.branches_pending_verification} sucursales pendientes de verificación`}>Confirmá dirección, coordenadas, perímetro y razón social antes de usarlas para fichar.</Notice></Link>
      )}
      {can('attendance.view') && (
        <section>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[15px] font-semibold">Asistencia de hoy</h2><Link to="/gerencia/asistencia" className="text-sm font-medium text-accent">Ver detalle</Link></div>
          {kpi.isLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div> : k && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Programados" value={k.scheduled} />
              <Stat label="Con ingreso" value={k.checked_in} tone="ok" />
              <Stat label="Turno abierto" value={k.working} tone="info" />
              <Stat label="Llegadas tarde" value={k.late} tone={k.late ? 'warn' : undefined} />
              <Stat label="Sin fichar (a verificar)" value={k.missing} tone={k.missing ? 'warn' : undefined} hint="No implica ausencia injustificada" />
              <Stat label="Salidas anticipadas" value={k.early_leave} />
              <Stat label="Jornadas sin cierre" value={k.not_closed} tone={k.not_closed ? 'warn' : undefined} />
              <Stat label="Intentos sospechosos (24 h)" value={k.suspicious} tone={k.suspicious ? 'bad' : undefined} />
            </div>
          )}
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Pendientes" icon={<AlertTriangle className="h-4 w-4" />} />
          {tasks.length === 0 ? <p className="px-5 pb-5 pt-2 text-sm text-ink-3">No hay tareas pendientes.</p> : (
            <ul className="divide-y divide-line/70 px-2 pb-2">{tasks.map((t) => (
              <li key={t.label}><Link to={t.to} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"><span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-accent px-2 text-xs font-semibold text-accent-ink">{t.n}</span><span className="flex-1 text-sm">{t.label}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link></li>
            ))}</ul>
          )}
        </Card>
        {o && (
          <Card><CardHeader title="Personal" />
            <div className="grid grid-cols-3 gap-3 p-5 pt-3">
              <div><p className="text-2xl font-semibold tabular">{o.employees_active}</p><p className="text-xs text-ink-3">Activos</p></div>
              <div><p className="text-2xl font-semibold tabular">{o.employees_invited}</p><p className="text-xs text-ink-3">Invitados</p></div>
              <div><p className="text-2xl font-semibold tabular">{o.branches}</p><p className="text-xs text-ink-3">Sucursales</p></div>
            </div>
          </Card>
        )}
      </div>
      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Accesos</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {managerItems.filter((i) => i.to !== '/gerencia' && (!i.perm || can(i.perm))).map((i) => (
            <Link key={i.to} to={i.to} className="flex items-center gap-2.5 rounded-xl border border-line/70 bg-surface px-3.5 py-3 text-sm font-medium shadow-card hover:bg-surface-2"><span className="text-accent">{i.icon}</span>{i.label}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}
