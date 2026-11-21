import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { useSession } from './lib/session';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ResetPassword from './pages/ResetPassword';
import Inactive from './pages/Inactive';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewAudit = lazy(() => import('./pages/NewAudit'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const Branches = lazy(() => import('./pages/Branches'));
const BranchDetail = lazy(() => import('./pages/BranchDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const Nonconformities = lazy(() => import('./pages/Nonconformities'));
const NonconformityDetail = lazy(() => import('./pages/NonconformityDetail'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Indicators = lazy(() => import('./pages/Indicators'));
const Manual = lazy(() => import('./pages/Manual'));
const Users = lazy(() => import('./pages/admin/Users'));
const Questionnaire = lazy(() => import('./pages/admin/Questionnaire'));
const BrandAdmin = lazy(() => import('./pages/admin/BrandAdmin'));
const ActivityLog = lazy(() => import('./pages/admin/ActivityLog'));

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { profile } = useSession();
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { session, profile, loading } = useSession();
  const loc = useLocation();

  if (!isConfigured) return <Setup />;
  if (loc.pathname === '/restablecer') return <ResetPassword />;
  if (loading) return <Loading label="Iniciando…" />;
  if (!session) return <Login />;
  if (!profile) return <Loading label="Cargando perfil…" />;
  if (!profile.active) return <Inactive />;

  const staff = ['admin', 'auditor'];
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="auditorias/nueva" element={<RequireRole roles={staff}><NewAudit /></RequireRole>} />
          <Route path="auditorias/:id" element={<AuditPage />} />
          <Route path="sucursales" element={<Branches />} />
          <Route path="sucursales/:id" element={<BranchDetail />} />
          <Route path="reportes" element={<Reports />} />
          <Route path="incumplimientos" element={<Nonconformities />} />
          <Route path="incumplimientos/:id" element={<NonconformityDetail />} />
          <Route path="alertas" element={<Alerts />} />
          <Route path="indicadores" element={<Indicators />} />
          <Route path="manual" element={<Manual />} />
          <Route path="admin/usuarios" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
          <Route path="admin/cuestionario" element={<RequireRole roles={['admin']}><Questionnaire /></RequireRole>} />
          <Route path="admin/marca" element={<RequireRole roles={['admin']}><BrandAdmin /></RequireRole>} />
          <Route path="admin/registro" element={<RequireRole roles={['admin']}><ActivityLog /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
