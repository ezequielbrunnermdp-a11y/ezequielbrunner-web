import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isConfigured } from './env';

// Si faltan las variables, la app muestra una pantalla de configuración
// en lugar de simular un backend.
export const supabase: SupabaseClient = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseAnonKey || 'public-anon-key-missing',
  {
    auth: { persistSession: isConfigured, autoRefreshToken: isConfigured, detectSessionInUrl: true, flowType: 'pkce' },
    realtime: { params: { eventsPerSecond: 5 } },
  },
);

/** Llama a una función RPC y lanza un error legible si falla. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
