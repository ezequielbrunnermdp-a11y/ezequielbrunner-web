import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, rpc } from '@/lib/supabase';
import { isConfigured } from '@/lib/env';
import { setTimeZone } from '@/lib/format';
import type { AppContext } from '@/lib/types';

interface AuthState {
  session: Session | null;
  loading: boolean;
  ctx: AppContext | null;
  ctxLoading: boolean;
  refreshCtx: () => Promise<void>;
  can: (perm: string) => boolean;
  isManager: boolean;
  needsMfa: boolean;
  signOut: (scope?: 'local' | 'global' | 'others') => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

function jwtAal(token?: string): string {
  try { return (JSON.parse(atob(token!.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { aal?: string }).aal ?? 'aal1'; } catch { return 'none'; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const ctxQuery = useQuery({
    queryKey: ['ctx', session?.user.id, jwtAal(session?.access_token)],
    enabled: Boolean(session),
    staleTime: 60_000,
    queryFn: async () => {
      const ctx = await rpc<AppContext>('my_context');
      if (ctx.employments.some((e) => e.status === 'invited')) {
        await rpc('activate_my_account');
        return rpc<AppContext>('my_context');
      }
      return ctx;
    },
  });
  const ctx = ctxQuery.data ?? null;
  useEffect(() => { setTimeZone(ctx?.organization?.settings?.timezone); }, [ctx?.organization?.settings?.timezone]);

  // Acento de marca configurable (los logos y colores se cargan luego sin rediseñar).
  useEffect(() => {
    const hex = ctx?.employments[0]?.brand_color;
    const root = document.documentElement;
    if (hex && /^#[0-9a-f]{6}$/i.test(hex) && !root.classList.contains('dark')) {
      const n = parseInt(hex.slice(1), 16);
      root.style.setProperty('--accent', `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`);
    } else root.style.removeProperty('--accent');
  }, [ctx?.employments]);

  const perms = useMemo(() => new Set(ctx?.roles.flatMap((r) => r.permissions ?? []) ?? []), [ctx]);
  const needsMfa = Boolean(ctx?.mfa_required && ctx.aal !== 'aal2');
  const can = useCallback((p: string) => perms.has(p) && !needsMfa, [perms, needsMfa]);

  const signOut = useCallback(async (scope: 'local' | 'global' | 'others' = 'local') => {
    await supabase.auth.signOut({ scope });
    if (scope !== 'others') qc.clear();
  }, [qc]);

  const value: AuthState = {
    session, loading, ctx, ctxLoading: ctxQuery.isLoading,
    refreshCtx: async () => { await ctxQuery.refetch(); },
    can, isManager: perms.size > 0, needsMfa, signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}
