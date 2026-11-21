// Función privilegiada: alta y gestión de usuarios.
// Usa la clave de servicio de Supabase SOLO en el servidor (variable SUPABASE_SERVICE_ROLE_KEY de Netlify).
// Verifica que quien llama sea un administrador activo antes de ejecutar cualquier acción.
import type { Config, Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

type Role = 'admin' | 'auditor' | 'franquiciado';
const ROLES: Role[] = ['admin', 'auditor', 'franquiciado'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) => Response.json(body, { status });

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const url = Netlify.env.get('SUPABASE_URL') ?? Netlify.env.get('VITE_SUPABASE_URL');
  const serviceKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify.' });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'No autenticado' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return json(401, { error: 'Sesión inválida' });
  const { data: callerProfile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) return json(403, { error: 'Solo un administrador puede gestionar usuarios' });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: 'Solicitud inválida' }); }
  const action = body.action;
  const log = (act: string, id: string, details: unknown) =>
    admin.from('activity_log').insert({ actor_id: caller.user.id, action: act, entity: 'usuario', entity_id: id, details });

  const setBranches = async (userId: string, ids: unknown) => {
    if (!Array.isArray(ids)) return;
    const clean = ids.filter((x): x is string => typeof x === 'string' && UUID.test(x));
    await admin.from('user_branches').delete().eq('user_id', userId);
    if (clean.length) {
      const { error } = await admin.from('user_branches').insert(clean.map((b) => ({ user_id: userId, branch_id: b })));
      if (error) throw new Error('No se pudieron asignar las sucursales');
    }
  };

  try {
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const fullName = String(body.full_name ?? '').trim().slice(0, 120);
      const role = body.role as Role;
      const mode = body.mode === 'invite' ? 'invite' : 'password';
      const password = String(body.password ?? '');
      if (!EMAIL.test(email)) return json(400, { error: 'Correo inválido' });
      if (!ROLES.includes(role)) return json(400, { error: 'Rol inválido' });
      if (!fullName) return json(400, { error: 'Indique el nombre' });
      if (mode === 'password' && password.length < 10) return json(400, { error: 'La contraseña inicial debe tener al menos 10 caracteres' });

      const appMeta = { role, active: true, full_name: fullName };
      let userId: string;
      if (mode === 'invite') {
        const origin = req.headers.get('origin') ?? new URL(req.url).origin;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/restablecer`, data: { full_name: fullName } });
        if (error) return json(400, { error: error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message });
        userId = data.user.id;
        await admin.auth.admin.updateUserById(userId, { app_metadata: appMeta });
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: appMeta, user_metadata: { full_name: fullName } });
        if (error) return json(400, { error: error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message });
        userId = data.user.id;
      }
      // El perfil lo crea el trigger; se asegura el rol y el estado definidos por el administrador.
      await admin.from('profiles').upsert({ id: userId, email, full_name: fullName, role, active: true });
      await setBranches(userId, body.branch_ids);
      await log('crear', userId, { email, role, mode });
      return json(200, { ok: true, id: userId });
    }

    if (action === 'update') {
      const userId = String(body.user_id ?? '');
      if (!UUID.test(userId)) return json(400, { error: 'Usuario inválido' });
      const patch: Record<string, unknown> = {};
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role as Role)) return json(400, { error: 'Rol inválido' });
        patch.role = body.role;
      }
      if (body.active !== undefined) patch.active = Boolean(body.active);
      if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim().slice(0, 120);
      if (userId === caller.user.id && (patch.role && patch.role !== 'admin' || patch.active === false)) {
        return json(400, { error: 'No puede quitarse a sí mismo el rol de administrador ni desactivarse' });
      }
      if (Object.keys(patch).length) {
        const { error } = await admin.from('profiles').update(patch).eq('id', userId);
        if (error) return json(400, { error: 'No se pudo actualizar el perfil' });
        await admin.auth.admin.updateUserById(userId, {
          app_metadata: { ...(patch.role ? { role: patch.role } : {}), ...(patch.active !== undefined ? { active: patch.active } : {}) },
          ...(patch.active === false ? { ban_duration: '876000h' } : patch.active === true ? { ban_duration: 'none' } : {}),
        });
      }
      await setBranches(userId, body.branch_ids);
      await log('editar', userId, { ...patch, branch_ids: body.branch_ids });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Acción desconocida' });
  } catch (e) {
    console.error('admin-users', e);
    return json(500, { error: 'Error interno al gestionar el usuario' });
  }
};

export const config: Config = { path: '/api/admin-users', method: ['POST'] };
