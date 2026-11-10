import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente con permisos totales: solo se usa en el servidor.
export const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export const appUrl = () => (process.env.APP_URL || process.env.URL || '').replace(/\/$/, '');

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Usuario que hace la llamada (token de Supabase en Authorization: Bearer ...)
export async function usuarioActual(req, rolesPermitidos) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Tenés que iniciar sesión.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'La sesión venció. Volvé a ingresar.');
  const { data: perfil } = await admin.from('perfiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!perfil || !perfil.activo) throw new HttpError(403, 'Tu usuario no está habilitado.');
  if (rolesPermitidos && !rolesPermitidos.includes(perfil.rol)) throw new HttpError(403, 'No tenés permiso para esto.');
  return { user: data.user, perfil };
}

export function manejar(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Ocurrió un error inesperado. Probá de nuevo en un momento.' }, 500);
    }
  };
}

export async function cuerpo(req) {
  try { return await req.json(); } catch { throw new HttpError(400, 'Datos inválidos.'); }
}
