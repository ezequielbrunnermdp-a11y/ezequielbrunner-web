import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Por defecto la API corre en el mismo sitio (Netlify Functions: /rest/v1, /auth/v1, /storage/v1).
// VITE_SUPABASE_URL permite apuntar a otro servidor compatible (por ejemplo, durante el desarrollo).
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || window.location.origin;
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'publica';

export const isConfigured = true;

// Clave pública: los permisos los aplica Row Level Security en la base de datos.
export const supabase: SupabaseClient = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Convierte errores de Supabase/PostgreSQL en mensajes comprensibles, sin exponer detalles internos. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message ?? String(err ?? 'Error desconocido');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sin conexión con el servidor. Los cambios quedan guardados en este dispositivo.';
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'El correo todavía no fue confirmado.';
  if (/row-level security|permission denied|No autorizado/i.test(msg)) return 'No tiene permisos para realizar esta acción.';
  if (/duplicate key/i.test(msg)) return 'Ya existe un registro con esos datos.';
  if (/JWT expired/i.test(msg)) return 'La sesión expiró. Vuelva a ingresar.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}

export async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(friendlyError(error));
  return data;
}
