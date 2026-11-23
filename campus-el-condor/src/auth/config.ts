/* Conexión con el servidor de cuentas (Supabase). La URL y la clave pública se definen al compilar:
   VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example). La clave pública es visible
   en el navegador por diseño: la seguridad la dan las funciones del servidor (supabase/schema.sql).
   Sin estas variables, el campus funciona en modo local, sin cuentas. */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
export const AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
