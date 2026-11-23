import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';

export interface Branch {
  id: string; organization_id: string; brand_id: string; legal_entity_id: string; name: string; address: string | null; lat: number | null; lng: number | null;
  geofence_radius_m: number; gps_max_accuracy_m: number; require_gps: boolean; require_qr: boolean; late_tolerance_min: number; early_leave_tolerance_min: number;
  max_open_hours: number; timezone: string; status: string;
}

export function useBranches() {
  const { ctx } = useAuth();
  return useQuery({
    queryKey: ['branches', ctx?.organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;
      return data as Branch[];
    },
  });
}

/** Sucursales donde la persona tiene un permiso (solo para la UI; el servidor vuelve a verificar). */
export function useBranchesWith(perm: string) {
  const { ctx, can } = useAuth();
  const q = useBranches();
  const list = (q.data ?? []).filter((b) => can(perm) && ctx!.roles.some((r) => r.permissions?.includes(perm) &&
    ((r.scope_type === 'organization' && r.scope_id === b.organization_id) || (r.scope_type === 'legal_entity' && r.scope_id === b.legal_entity_id) || (r.scope_type === 'branch' && r.scope_id === b.id))));
  return { ...q, data: list };
}

export function useLegalEntities() {
  return useQuery({ queryKey: ['legal-entities'], queryFn: async () => {
    const { data, error } = await supabase.from('legal_entities').select('*').order('legal_name');
    if (error) throw error; return data as { id: string; legal_name: string; cuit: string | null; verified: boolean; organization_id: string }[];
  } });
}

export function useBrands() {
  return useQuery({ queryKey: ['brands'], queryFn: async () => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) throw error; return data as { id: string; name: string; slug: string; logo_path: string | null; accent_color: string | null; organization_id: string }[];
  } });
}

export function useSectors() {
  return useQuery({ queryKey: ['sectors'], queryFn: async () => {
    const { data, error } = await supabase.from('sectors').select('*').order('name');
    if (error) throw error; return data as { id: string; name: string; branch_id: string | null }[];
  } });
}
