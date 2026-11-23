import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/ui';
import { AdminDashboard } from './AdminDashboard';
import { TicketThreadPage } from '../work/MgmtContactPage';

const AttendanceAdmin = lazy(() => import('./AttendanceAdmin'));
const Planner = lazy(() => import('./Planner'));
const Employees = lazy(() => import('./Employees'));
const Branches = lazy(() => import('./Branches'));
const RequestsAdmin = lazy(() => import('./RequestsAdmin'));
const Agenda = lazy(() => import('./Agenda'));
const Communications = lazy(() => import('./Communications'));
const CommunityAdmin = lazy(() => import('./CommunityAdmin'));
const DocumentsAdmin = lazy(() => import('./DocumentsAdmin'));
const TrainingsAdmin = lazy(() => import('./TrainingsAdmin'));
const Reports = lazy(() => import('./Reports'));
const Roles = lazy(() => import('./Roles'));
const OrgSettings = lazy(() => import('./OrgSettings'));

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can, needsMfa } = useAuth();
  if (can(perm)) return <>{children}</>;
  return <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title={needsMfa ? 'Verificación en dos pasos requerida' : 'Sin acceso'}
    description={needsMfa ? 'Cerrá sesión y volvé a ingresar para verificar tu identidad. Los permisos de gerencia requieren MFA.' : 'Tu rol no incluye esta sección. El servidor también lo impide.'} />;
}

export default function AdminRoutes() {
  const { isManager } = useAuth();
  if (!isManager) return <Navigate to="/" replace />;
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="asistencia" element={<Guard perm="attendance.view"><AttendanceAdmin /></Guard>} />
      <Route path="horarios" element={<Guard perm="schedules.manage"><Planner /></Guard>} />
      <Route path="empleados" element={<Guard perm="employees.view"><Employees /></Guard>} />
      <Route path="sucursales" element={<Guard perm="branches.manage"><Branches /></Guard>} />
      <Route path="solicitudes" element={<Guard perm="requests.review"><RequestsAdmin /></Guard>} />
      <Route path="agenda" element={<Guard perm="meetings.manage"><Agenda /></Guard>} />
      <Route path="comunicaciones" element={<Guard perm="tickets.receive"><Communications /></Guard>} />
      <Route path="comunicaciones/:id" element={<Guard perm="tickets.receive"><TicketThreadPage manager /></Guard>} />
      <Route path="comunidad" element={<Guard perm="community.publish"><CommunityAdmin /></Guard>} />
      <Route path="documentos" element={<Guard perm="docs.manage"><DocumentsAdmin /></Guard>} />
      <Route path="capacitaciones" element={<Guard perm="trainings.manage"><TrainingsAdmin /></Guard>} />
      <Route path="reportes" element={<Guard perm="reports.view"><Reports /></Guard>} />
      <Route path="roles" element={<Guard perm="roles.manage"><Roles /></Guard>} />
      <Route path="configuracion" element={<Guard perm="org.manage"><OrgSettings /></Guard>} />
      <Route path="*" element={<Navigate to="/gerencia" replace />} />
    </Routes>
  );
}
