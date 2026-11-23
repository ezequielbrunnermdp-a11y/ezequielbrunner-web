import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { AppShell } from './layout/AppShell';
import { Spinner } from './components/ui';
import { isConfigured } from './lib/env';
import { NotConfigured, Welcome, Login, ForgotPassword, SetPassword, MfaGate } from './features/auth/AuthPages';
import { HomePage } from './features/home/HomePage';
import { CommunityPage } from './features/community/CommunityPage';
import { PostDetailPage } from './features/community/PostDetailPage';
import { GroupDetailPage } from './features/community/GroupDetailPage';
import { ProfilePage, EditProfilePage } from './features/profile/ProfilePages';
import { InboxPage } from './features/messages/InboxPage';
import { ConversationPage } from './features/messages/ConversationPage';
import { SchedulePage } from './features/schedule/SchedulePage';
import { ClockPage } from './features/clock/ClockPage';
import { AttendanceHistoryPage } from './features/clock/AttendanceHistoryPage';
import { RequestsPage } from './features/work/RequestsPage';
import { MeetingsPage } from './features/work/MeetingsPage';
import { MgmtContactPage, TicketThreadPage } from './features/work/MgmtContactPage';
import { DocumentsPage } from './features/docs/DocumentsPage';
import { TrainingsPage, CoursePage } from './features/training/TrainingPages';
import { BenefitsPage, EventsPage, SuggestionsPage } from './features/extras/ExtrasPages';
import { NotificationsPage } from './features/extras/NotificationsPage';
import { SettingsPage } from './features/extras/SettingsPage';

const Admin = lazy(() => import('./features/admin/AdminRoutes'));
const Kiosk = lazy(() => import('./features/kiosk/KioskRoutes'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: (n, e) => n < 2 && !String((e as { code?: string })?.code ?? '').startsWith('42'), refetchOnWindowFocus: true },
  },
});

const Loading = () => <div className="flex min-h-[50dvh] items-center justify-center"><Spinner /></div>;

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, ctxLoading, ctx } = useAuth();
  const loc = useLocation();
  if (loading || (session && ctxLoading)) return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!session) return <Navigate to="/bienvenida" replace state={{ from: loc.pathname }} />;
  if (ctx && !ctx.profile && !ctx.is_platform_admin) return <NoAccess />;
  return <MfaGate>{children}</MfaGate>;
}

function NoAccess() {
  const { signOut } = useAuth();
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-semibold">Tu cuenta no tiene un perfil asignado</p>
      <p className="mt-2 text-sm text-ink-3">Pedile a la persona responsable de tu empresa que revise tu invitación.</p>
      <button className="mt-6 text-sm font-medium text-accent" onClick={() => void signOut()}>Cerrar sesión</button>
    </div>
  );
}

export function App() {
  if (!isConfigured) return <NotConfigured />;
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/bienvenida" element={<Welcome />} />
                <Route path="/ingresar" element={<Login />} />
                <Route path="/recuperar" element={<ForgotPassword />} />
                <Route path="/nueva-clave" element={<SetPassword mode="reset" />} />
                <Route path="/activar" element={<SetPassword mode="invite" />} />
                <Route path="/kiosco/*" element={<Kiosk />} />
                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route index element={<HomePage />} />
                  <Route path="comunidad" element={<CommunityPage />} />
                  <Route path="comunidad/:tab" element={<CommunityPage />} />
                  <Route path="comunidad/post/:id" element={<PostDetailPage />} />
                  <Route path="comunidad/grupos/:id" element={<GroupDetailPage />} />
                  <Route path="perfil" element={<ProfilePage />} />
                  <Route path="perfil/editar" element={<EditProfilePage />} />
                  <Route path="perfil/:id" element={<ProfilePage />} />
                  <Route path="mensajes" element={<InboxPage />} />
                  <Route path="mensajes/:id" element={<ConversationPage />} />
                  <Route path="horarios" element={<SchedulePage />} />
                  <Route path="fichaje" element={<ClockPage />} />
                  <Route path="fichaje/historial" element={<AttendanceHistoryPage />} />
                  <Route path="solicitudes" element={<RequestsPage />} />
                  <Route path="reuniones" element={<MeetingsPage />} />
                  <Route path="gerencia-contacto" element={<MgmtContactPage />} />
                  <Route path="gerencia-contacto/:id" element={<TicketThreadPage />} />
                  <Route path="documentos" element={<DocumentsPage />} />
                  <Route path="capacitaciones" element={<TrainingsPage />} />
                  <Route path="capacitaciones/:id" element={<CoursePage />} />
                  <Route path="beneficios" element={<BenefitsPage />} />
                  <Route path="eventos" element={<EventsPage />} />
                  <Route path="sugerencias" element={<SuggestionsPage />} />
                  <Route path="notificaciones" element={<NotificationsPage />} />
                  <Route path="configuracion" element={<SettingsPage />} />
                  <Route path="gerencia/*" element={<Admin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
