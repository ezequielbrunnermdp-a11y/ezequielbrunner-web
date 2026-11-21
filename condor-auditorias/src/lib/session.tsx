import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Branch, BrandSettings, Profile } from './types';

const DEFAULT_BRAND: BrandSettings = {
  company_name: 'EL CÓNDOR COFFEE SHOP',
  platform_name: 'EL CÓNDOR | CONTROL DE FRANQUICIAS',
  subtitle: 'Sistema Integral de Auditorías y Calidad Operativa',
  logo_path: null,
  color_primary: '#2e2016',
  color_accent: '#b08d3e',
  color_background: '#f7f1e7',
  receipt_enabled: true,
};

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  branches: Branch[];
  loading: boolean;
  brand: BrandSettings;
  logoUrl: string | null;
  isAdmin: boolean;
  isStaff: boolean;
  refreshBranches: () => Promise<void>;
  refreshBrand: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '46 32 22';
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

export function logoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('marca').getPublicUrl(path).data.publicUrl;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);

  const refreshBrand = useCallback(async () => {
    const { data } = await supabase.from('brand_settings').select('*').eq('id', 1).maybeSingle();
    if (data) setBrand({ ...DEFAULT_BRAND, ...data });
  }, []);

  const refreshBranches = useCallback(async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches((data as Branch[]) ?? []);
  }, []);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setBranches([]);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
    if (data?.active) await refreshBranches();
  }, [refreshBranches]);

  useEffect(() => {
    let alive = true;
    refreshBrand();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        loadProfile(s);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, refreshBrand]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', hexToRgb(brand.color_primary));
    root.style.setProperty('--brand-accent', hexToRgb(brand.color_accent));
    root.style.setProperty('--brand-bg', hexToRgb(brand.color_background));
  }, [brand]);

  const value = useMemo<Ctx>(() => ({
    session,
    profile,
    branches,
    loading,
    brand,
    logoUrl: logoPublicUrl(brand.logo_path),
    isAdmin: profile?.role === 'admin' && profile.active,
    isStaff: (profile?.role === 'admin' || profile?.role === 'auditor') && !!profile?.active,
    refreshBranches,
    refreshBrand,
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  }), [session, profile, branches, loading, brand, refreshBranches, refreshBrand]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}
