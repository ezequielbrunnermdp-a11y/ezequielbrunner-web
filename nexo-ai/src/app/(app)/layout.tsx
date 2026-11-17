import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Shell } from "@/components/shell";
import { logoutAction, switchCompanyAction } from "../actions/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  if (!ws.active) redirect("/onboarding");
  const db = await getDb();
  const inbox = await db.query<{ n: number }>(`select count(*)::int n from findings where company_id = $1 and status = 'proposed'`, [ws.active.company_id]);
  return (
    <Shell
      user={{ name: ws.user.name, email: ws.user.email }}
      companies={ws.memberships.map((m) => ({ id: m.company_id, name: m.name, isDemo: m.is_demo, role: m.role }))}
      activeId={ws.active.company_id}
      roleLabel={`${ROLE_LABELS[ws.active.role]} · ${ws.active.name}`}
      inboxCount={inbox.rows[0].n}
      switchAction={switchCompanyAction}
      logoutAction={logoutAction}
    >
      {children}
    </Shell>
  );
}
