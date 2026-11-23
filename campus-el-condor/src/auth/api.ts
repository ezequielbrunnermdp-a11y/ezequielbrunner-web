import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export interface AccountUser {
  id: string;
  username: string;
  displayName: string;
  sector: string;
  role: 'admin' | 'empleado';
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserRow extends AccountUser {
  progress: unknown;
  progressUpdatedAt: string | null;
}

const MESSAGES: Record<string, string> = {
  CREDENCIALES: 'Usuario o contraseña incorrectos.',
  BLOQUEADO: 'Demasiados intentos fallidos. Esperá 15 minutos o pedí a un administrador que restablezca tu contraseña.',
  INACTIVO: 'Este usuario está desactivado. Consultá con un administrador.',
  SESION_INVALIDA: 'Tu sesión venció. Volvé a ingresar.',
  SIN_PERMISO: 'Esta acción requiere un usuario administrador.',
  CONTRASENA_CORTA: 'La contraseña debe tener al menos 8 caracteres.',
  USUARIO_EXISTE: 'Ya existe un usuario con ese nombre.',
  ROL_INVALIDO: 'El rol elegido no es válido.',
  NO_AUTO_DEGRADAR: 'No podés desactivar, eliminar ni quitar el rol de administrador a tu propio usuario.',
  NO_EXISTE: 'El usuario ya no existe.',
  PROGRESO_GRANDE: 'El progreso es demasiado grande para guardarse.',
};

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new ApiError('RED', 'No hay conexión con el servidor. Revisá tu conexión a internet.');
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = String(body?.message ?? 'ERROR');
    throw new ApiError(code, MESSAGES[code] ?? 'Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');
  }
  return body as T;
}

export async function login(username: string, password: string) {
  const r = await rpc<{ token?: string; user?: AccountUser; error?: string }>('campus_login', { p_username: username, p_password: password });
  if (r.error || !r.token || !r.user) throw new ApiError(r.error ?? 'CREDENCIALES', MESSAGES[r.error ?? 'CREDENCIALES'] ?? MESSAGES.CREDENCIALES);
  return { token: r.token, user: r.user };
}

export const api = {
  me: (t: string) => rpc<AccountUser>('campus_me', { p_token: t }),
  logout: (t: string) => rpc<null>('campus_logout', { p_token: t }),
  changePassword: (t: string, current: string, next: string) => rpc<null>('campus_change_password', { p_token: t, p_current: current, p_new: next }),
  getProgress: (t: string) => rpc<{ data: unknown; updatedAt: string } | null>('campus_get_progress', { p_token: t }),
  saveProgress: (t: string, data: unknown) => rpc<string>('campus_save_progress', { p_token: t, p_data: data }),
  listUsers: (t: string) => rpc<AdminUserRow[]>('campus_admin_list_users', { p_token: t }),
  createUser: (t: string, u: { username: string; password: string; displayName: string; sector: string; role: string }) =>
    rpc<AccountUser>('campus_admin_create_user', { p_token: t, p_username: u.username, p_password: u.password, p_display_name: u.displayName, p_sector: u.sector, p_role: u.role }),
  updateUser: (t: string, id: string, u: { displayName: string; sector: string; role: string; active: boolean }) =>
    rpc<AccountUser>('campus_admin_update_user', { p_token: t, p_user_id: id, p_display_name: u.displayName, p_sector: u.sector, p_role: u.role, p_active: u.active }),
  resetPassword: (t: string, id: string, password: string) => rpc<null>('campus_admin_reset_password', { p_token: t, p_user_id: id, p_password: password }),
  deleteUser: (t: string, id: string) => rpc<null>('campus_admin_delete_user', { p_token: t, p_user_id: id }),
};

/** Contraseña temporal legible: sin caracteres ambiguos. */
export function generatePassword(len = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}
