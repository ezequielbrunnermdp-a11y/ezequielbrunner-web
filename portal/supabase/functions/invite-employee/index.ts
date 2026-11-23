// Edge Function: envía la invitación de una persona y vincula su identidad.
//
// Seguridad:
//  1. La invitación se CREA con la sesión de quien invita (RPC create_employee_invitation),
//     que verifica en la base el permiso employees.manage sobre la sucursal.
//  2. Esta función vuelve a verificar que quien llama sea quien creó la invitación y
//     que la invitación esté pendiente. Recién entonces usa la clave de servicio
//     (que existe SOLO en el servidor) para invitar por correo.
//  3. Si el correo ya tiene identidad, no se duplica: se agrega la relación laboral.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json(req, { error: 'unauthorized' }, 401);

  let body: { invitation_id?: string; redirect_to?: string };
  try { body = await req.json(); } catch { return json(req, { error: 'invalid_body' }, 400); }
  if (!body.invitation_id || !/^[0-9a-f-]{36}$/.test(body.invitation_id)) return json(req, { error: 'invalid_invitation' }, 400);

  // Cliente con la identidad de quien llama: RLS aplica.
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: me, error: meErr } = await asUser.auth.getUser();
  if (meErr || !me.user) return json(req, { error: 'unauthorized' }, 401);

  // La fila solo es visible si quien llama tiene employees.view en esa sucursal.
  const { data: inv, error: invErr } = await asUser.from('employee_invitations')
    .select('id, email, first_name, last_name, invited_by, status, organization_id').eq('id', body.invitation_id).maybeSingle();
  if (invErr || !inv) return json(req, { error: 'not_found' }, 404);
  if (inv.invited_by !== me.user.id) return json(req, { error: 'forbidden' }, 403);
  if (!['pending', 'failed'].includes(inv.status)) return json(req, { error: 'already_processed' }, 409);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const redirectTo = SITE_URL ? `${SITE_URL.replace(/\/$/, '')}/activar` : body.redirect_to;

  try {
    const { data: existing } = await admin.rpc('find_user_id_by_email', { p_email: inv.email });
    let userId = existing as string | null;
    let status = 'invited';
    if (!userId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(inv.email, {
        redirectTo, data: { first_name: inv.first_name, last_name: inv.last_name },
      });
      if (error) throw error;
      userId = data.user.id;
    } else {
      status = 'linked';
    }
    const { error: cErr } = await admin.rpc('complete_employee_invitation', { p_invitation: inv.id, p_user: userId });
    if (cErr) throw cErr;
    return json(req, { status });
  } catch (e) {
    await admin.rpc('fail_employee_invitation', { p_invitation: inv.id, p_error: String((e as Error).message ?? e) });
    // No se exponen detalles internos al cliente.
    console.error('invite-employee failed', inv.id);
    return json(req, { error: 'invite_failed' }, 502);
  }
});
