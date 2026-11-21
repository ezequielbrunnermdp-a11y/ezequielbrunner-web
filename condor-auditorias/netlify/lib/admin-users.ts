// Alta y gestión de usuarios (solo administradores activos). Lógica independiente del entorno.
import type { GatewayEnv } from './gateway';
import { verifyJwt } from './gateway';

type Role = 'admin' | 'auditor' | 'franquiciado';
const ROLES: Role[] = ['admin', 'auditor', 'franquiciado'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) => Response.json(body, { status });

export async function adminUsers(req: Request, env: GatewayEnv): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const claims = verifyJwt(token, env.jwtSecret);
  if (!claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string') return json(401, { error: 'Sesión inválida' });
  const callerId = claims.sub;
  const db = env.pool;
  const { rows: me } = await db.query('select role, active from public.profiles where id = $1', [callerId]);
  if (!me[0] || me[0].role !== 'admin' || !me[0].active) return json(403, { error: 'Solo un administrador puede gestionar usuarios' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Solicitud inválida' });
  }
  const log = (action: string, id: string, details: unknown) =>
    db.query(`insert into public.activity_log (actor_id, action, entity, entity_id, details) values ($1, $2, 'usuario', $3, $4)`, [callerId, action, id, JSON.stringify(details)]);
  const setBranches = async (userId: string, ids: unknown) => {
    if (!Array.isArray(ids)) return;
    const clean = ids.filter((x): x is string => typeof x === 'string' && UUID.test(x));
    await db.query('delete from public.user_branches where user_id = $1', [userId]);
    if (clean.length) await db.query('insert into public.user_branches (user_id, branch_id) select $1, unnest($2::uuid[])', [userId, clean]);
  };
  const revokeSessions = (userId: string) =>
    db.query(`update auth.refresh_tokens set revoked_at = now() - interval '1 minute' where user_id = $1 and revoked_at is null`, [userId]);

  try {
    if (body.action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const fullName = String(body.full_name ?? '').trim().slice(0, 120);
      const role = body.role as Role;
      const password = String(body.password ?? '');
      if (!EMAIL.test(email)) return json(400, { error: 'Correo inválido' });
      if (!ROLES.includes(role)) return json(400, { error: 'Rol inválido' });
      if (!fullName) return json(400, { error: 'Indique el nombre' });
      if (password.length < 10) return json(400, { error: 'La contraseña inicial debe tener al menos 10 caracteres' });
      const exists = await db.query('select 1 from auth.users where lower(email) = $1', [email]);
      if (exists.rowCount) return json(400, { error: 'Ya existe un usuario con ese correo' });
      const meta = { role, active: true, full_name: fullName };
      const { rows } = await db.query(
        `insert into auth.users (email, encrypted_password, raw_app_meta_data, raw_user_meta_data) values ($1, crypt($2, gen_salt('bf', 10)), $3, $4) returning id`,
        [email, password, JSON.stringify(meta), JSON.stringify({ full_name: fullName })]);
      const id = rows[0].id as string;
      await db.query(`insert into public.profiles (id, email, full_name, role, active) values ($1, $2, $3, $4, true)
        on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, active = true`, [id, email, fullName, role]);
      await setBranches(id, body.branch_ids);
      await log('crear', id, { email, role });
      return json(200, { ok: true, id });
    }

    const userId = String(body.user_id ?? '');
    if (!UUID.test(userId)) return json(400, { error: 'Usuario inválido' });

    if (body.action === 'reset_password') {
      const pw = String(body.password ?? '');
      if (pw.length < 10) return json(400, { error: 'La contraseña debe tener al menos 10 caracteres' });
      await db.query(`update auth.users set encrypted_password = crypt($2, gen_salt('bf', 10)), updated_at = now() where id = $1`, [userId, pw]);
      await revokeSessions(userId);
      await log('restablecer_contrasena', userId, {});
      return json(200, { ok: true });
    }

    if (body.action === 'update') {
      const patch: Record<string, unknown> = {};
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role as Role)) return json(400, { error: 'Rol inválido' });
        patch.role = body.role;
      }
      if (body.active !== undefined) patch.active = Boolean(body.active);
      if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim().slice(0, 120);
      if (userId === callerId && ((patch.role && patch.role !== 'admin') || patch.active === false)) {
        return json(400, { error: 'No puede quitarse a sí mismo el rol de administrador ni desactivarse' });
      }
      const keys = Object.keys(patch);
      if (keys.length) {
        await db.query(`update public.profiles set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [userId, ...keys.map((k) => patch[k])]);
        if (patch.active !== undefined) {
          await db.query('update auth.users set banned_until = $2 where id = $1', [userId, patch.active ? null : '9999-12-31']);
          if (!patch.active) await revokeSessions(userId);
        }
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
}
