#!/usr/bin/env node
// Pruebas de base de datos: aplica las migraciones REALES sobre un PostgreSQL
// limpio (con una emulación mínima de Supabase) y verifica RLS, permisos y la
// lógica de fichaje simulando cada rol, incluso con llamadas directas a la API.
//
// Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres node scripts/test-db.mjs
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const DB = process.env.TEST_DB || 'portal_test';
const base = { host: process.env.PGHOST || '/tmp', port: +(process.env.PGPORT || 54329), user: process.env.PGUSER || 'postgres' };

let passed = 0, failed = 0;
const results = [];
function ok(cond, name, extra = '') {
  if (cond) { passed++; results.push(`  ✔ ${name}`); }
  else { failed++; results.push(`  ✘ ${name} ${extra}`); }
}
function section(t) { results.push(`\n${t}`); }

const admin = new pg.Client({ ...base, database: 'postgres' });
await admin.connect();
await admin.query(`drop database if exists ${DB}`);
await admin.query(`create database ${DB}`);
await admin.end();

const db = new pg.Client({ ...base, database: DB });
await db.connect();
await db.query('set client_min_messages = warning');
await db.query(readFileSync(join(root, 'tests', '00_supabase_shim.sql'), 'utf8'));
for (const f of readdirSync(join(root, 'migrations')).sort()) {
  await db.query(readFileSync(join(root, 'migrations', f), 'utf8'));
}
await db.query(readFileSync(join(root, 'seed.sql'), 'utf8'));

const q = async (sql, params) => (await db.query(sql, params)).rows;

// Ejecuta como un rol de la API (authenticated/anon/service_role) con claims JWT.
async function as(user, sql, params = [], { aal = 'aal2', role = 'authenticated' } = {}) {
  await db.query('begin');
  try {
    await db.query(`set local role ${role}`);
    const claims = user ? { sub: user, role, aal } : { role };
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const r = await db.query(sql, params);
    await db.query('commit');
    return { rows: r.rows, error: null };
  } catch (e) {
    await db.query('rollback');
    return { rows: [], error: e };
  }
}
const one = async (...a) => { const r = await as(...a); if (r.error) throw r.error; return r.rows[0]; };

// ---------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------
const mkUser = async (email) => (await q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
const [org] = await q(`select id from organizations where slug = 'grupo-gastronomico'`);
const [guemes] = await q(`select * from branches where name = 'Güemes'`);
const [colon] = await q(`select * from branches where name = 'Colón'`);
const [casino] = await q(`select * from branches where name = 'Casino Central'`);
const LAT = -38.0055, LNG = -57.5426;
await q(`update branches set lat = $1, lng = $2, status = 'active', geofence_radius_m = 40, gps_max_accuracy_m = 75 where id = $3`, [LAT, LNG, guemes.id]);
await q(`update branches set lat = $1, lng = $2, status = 'active' where id = $3`, [LAT + 0.01, LNG, colon.id]);
await q(`update branches set status = 'active' where id = $1`, [casino.id]);

// Otra organización (cliente SaaS distinto)
const [orgB] = await q(`insert into organizations (name, slug) values ('Otra Empresa SA', 'otra-empresa') returning id`);
const [brandB] = await q(`insert into brands (organization_id, name, slug) values ($1, 'Otra Marca', 'otra') returning id`, [orgB.id]);
const [leB] = await q(`insert into legal_entities (organization_id, legal_name) values ($1, 'Otra SA') returning id`, [orgB.id]);
const [branchB] = await q(`insert into branches (organization_id, brand_id, legal_entity_id, name, status, lat, lng) values ($1,$2,$3,'Centro','active',$4,$5) returning *`,
  [orgB.id, brandB.id, leB.id, LAT, LNG]);

const U = {};
for (const k of ['admin', 'manager', 'emp1', 'emp2', 'emp3', 'empB', 'platform']) U[k] = await mkUser(`${k}@test.local`);
async function employ(user, orgId, branch, code, first) {
  await q(`insert into profiles (user_id, organization_id, first_name, last_name) values ($1,$2,$3,'Prueba') on conflict do nothing`, [user, orgId, first]);
  await q(`insert into employments (user_id, organization_id, legal_entity_id, primary_branch_id, position, employee_code, status)
           values ($1,$2,$3,$4,'Barista',$5,'active')`, [user, orgId, branch.legal_entity_id, branch.id, code]);
}
await employ(U.admin, org.id, guemes, 'ADM-1', 'Ana');
await employ(U.manager, org.id, guemes, 'GER-1', 'Mario');
await employ(U.emp1, org.id, guemes, 'EMP-1', 'Eva');
await employ(U.emp2, org.id, guemes, 'EMP-2', 'Pablo');
await employ(U.emp3, org.id, casino, 'EMP-3', 'Lucía');
await employ(U.empB, orgB.id, branchB, 'B-1', 'Bruno');
const role = async (key) => (await q(`select id from roles where key = $1 and organization_id is null`, [key]))[0].id;
await q(`insert into role_assignments (user_id, role_id, organization_id, scope_type, scope_id) values ($1,$2,$3,'organization',$3)`, [U.admin, await role('company_admin'), org.id]);
await q(`insert into role_assignments (user_id, role_id, organization_id, scope_type, scope_id) values ($1,$2,$3,'branch',$4)`, [U.manager, await role('branch_manager'), org.id, guemes.id]);
await q(`insert into platform_admins (user_id) values ($1)`, [U.platform]);

// =====================================================================
section('PRUEBA 1 — Usuarios (invitación, activación, persistencia)');
{
  const inv = await as(U.admin, `select public.create_employee_invitation($1,'nuevo@test.local','Nora','Nueva','Cajera','EMP-9') as id`, [guemes.id]);
  ok(!inv.error, 'el administrador crea la invitación', inv.error?.message);
  const denied = await as(U.emp1, `select public.create_employee_invitation($1,'x@test.local','X','Y','Z','EMP-8')`, [guemes.id]);
  ok(denied.error?.code === '42501', 'un empleado NO puede invitar');
  const svc = await as(null, `select public.complete_employee_invitation($1, $2)`, [inv.rows[0]?.id, U.emp1], { role: 'authenticated' });
  ok(!!svc.error, 'complete_employee_invitation no es invocable por usuarios');
  const newUser = await mkUser('nuevo@test.local');
  const done = await as(null, `select public.complete_employee_invitation($1, $2) as emp`, [inv.rows[0].id, newUser], { role: 'service_role' });
  ok(!done.error && done.rows[0].emp, 'la Edge Function (service_role) vincula identidad y relación laboral', done.error?.message);
  await as(newUser, `select public.activate_my_account()`);
  const ctx = await one(newUser, `select public.my_context() as c`);
  ok(ctx.c.employments[0]?.status === 'active' && ctx.c.profile.first_name === 'Nora', 'la cuenta queda activa y su información persiste');
  const pub = await as(null, `select public.my_context()`, [], { role: 'anon' });
  ok(!!pub.error, 'sin sesión no hay acceso (anon)');
}

section('PRUEBA 2 — Amistades');
{
  const s = await one(U.emp1, `select public.send_friend_request($1) as r`, [U.emp2]);
  ok(s.r.status === 'pending', 'emp1 envía solicitud a emp2');
  const inbox = await as(U.emp2, `select * from public.friend_requests_inbox()`);
  ok(inbox.rows.some((r) => r.direction === 'received'), 'emp2 la ve como recibida');
  const acc = await as(U.emp2, `select public.respond_friend_request($1, true)`, [s.r.request_id]);
  ok(!acc.error, 'emp2 acepta');
  const f1 = await as(U.emp1, `select * from public.my_friends()`);
  const f2 = await as(U.emp2, `select * from public.my_friends()`);
  ok(f1.rows.some((r) => r.user_id === U.emp2) && f2.rows.some((r) => r.user_id === U.emp1), 'ambos aparecen como amigos');
  const cross = await as(U.emp1, `select public.send_friend_request($1)`, [U.empB]);
  ok(cross.error?.code === '42501', 'no se puede agregar a alguien de otra empresa');
  const brand = await as(U.emp1, `select public.send_friend_request($1)`, [U.emp3]);
  ok(brand.error?.code === '42501', 'entre marcas distintas está deshabilitado por defecto');
  const search = await as(U.emp1, `select * from public.people_search('')`);
  ok(!search.rows.some((r) => r.user_id === U.empB), 'el directorio no muestra personas de otra empresa');
}

section('PRUEBA 3 — Publicaciones');
let postId;
{
  const p = await as(U.emp1, `select public.create_post('Hola equipo ☕', 'community') as id`);
  ok(!p.error, 'emp1 publica', p.error?.message);
  postId = p.rows[0]?.id;
  const feed2 = await as(U.emp2, `select * from public.feed()`);
  ok(feed2.rows.some((r) => r.id === postId), 'emp2 (misma comunidad) la ve');
  const like = await as(U.emp2, `insert into post_reactions (post_id, user_id) values ($1, $2)`, [postId, U.emp2]);
  const com = await as(U.emp2, `insert into post_comments (post_id, author_id, body) values ($1, $2, 'Buenísimo')`, [postId, U.emp2]);
  ok(!like.error && !com.error, 'emp2 reacciona y comenta');
  const feed1 = await as(U.emp1, `select likes, comments from public.feed() where id = $1`, [postId]);
  ok(+feed1.rows[0].likes === 1 && +feed1.rows[0].comments === 1, 'contadores persistidos');
  const fB = await as(U.empB, `select * from posts where id = $1`, [postId]);
  ok(fB.rows.length === 0, 'otra empresa no ve la publicación (consulta directa)');
  const f3 = await as(U.emp3, `select * from posts where id = $1`, [postId]);
  ok(f3.rows.length === 0, 'otra marca no la ve por defecto');
  const friendsOnly = await as(U.emp1, `select public.create_post('Solo amigos', 'friends') as id`);
  const seenByAdmin = await as(U.admin, `select * from posts where id = $1`, [friendsOnly.rows[0].id]);
  ok(seenByAdmin.rows.length === 0, 'una publicación "solo amigos" no es visible para quien no es amigo (ni administración)');
  const notif = await as(U.emp1, `select count(*)::int n from notifications where type = 'comment'`);
  ok(notif.rows[0].n === 1, 'el autor recibe notificación del comentario');
  const fakeInst = await as(U.emp1, `select public.create_post('Comunicado', 'community', '{}', null, '{}', 'institutional', 'announcement')`);
  ok(fakeInst.error?.code === '42501', 'un empleado no puede publicar contenido institucional');
}

section('PRUEBA 4 — Mensajería privada');
{
  const c = await one(U.emp1, `select public.start_direct_conversation($1) as id`, [U.emp2]);
  const m = await as(U.emp1, `insert into messages (conversation_id, sender_id, body, client_id) values ($1,$2,'¿Cubrís el sábado?',$3)`, [c.id, U.emp1, randomUUID()]);
  ok(!m.error, 'emp1 envía un mensaje', m.error?.message);
  const r2 = await as(U.emp2, `select body from messages where conversation_id = $1`, [c.id]);
  ok(r2.rows[0]?.body === '¿Cubrís el sábado?', 'emp2 lo recibe (persistido)');
  const unread = await as(U.emp2, `select unread from public.my_conversations() where id = $1`, [c.id]);
  ok(+unread.rows[0].unread === 1, 'indicador de no leídos');
  for (const k of ['emp3', 'manager', 'admin', 'platform', 'empB']) {
    const r = await as(U[k], `select * from messages where conversation_id = $1`, [c.id]);
    ok(r.rows.length === 0, `${k} NO puede leer la conversación (consulta directa)`);
  }
  const inject = await as(U.emp3, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'intruso')`, [c.id, U.emp3]);
  ok(!!inject.error, 'un tercero no puede escribir en la conversación');
  const joinHack = await as(U.manager, `insert into conversation_participants (conversation_id, user_id) values ($1,$2)`, [c.id, U.manager]);
  ok(!!joinHack.error, 'no es posible sumarse a una conversación ajena');
  await as(U.emp2, `select public.block_user($1)`, [U.emp1]);
  const blocked = await as(U.emp1, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'hola?')`, [c.id, U.emp1]);
  ok(!!blocked.error, 'tras un bloqueo no se pueden enviar mensajes');
  await as(U.emp2, `select public.unblock_user($1)`, [U.emp1]);
  ok((await as(U.emp1, `select public.send_friend_request($1) as r`, [U.emp2])).rows[0].r.status === 'pending', 'el bloqueo eliminó la amistad');
}

section('PRUEBA 5 — Horarios');
let shiftId;
{
  const ins = await as(U.manager, `insert into shifts (branch_id, user_id, starts_at, ends_at) values ($1,$2, now() + interval '1 day', now() + interval '1 day 8 hours') returning id`, [guemes.id, U.emp1]);
  ok(!ins.error, 'el gerente crea un turno', ins.error?.message);
  shiftId = ins.rows[0]?.id;
  const draft = await as(U.emp1, `select * from public.my_shifts(now(), now() + interval '7 days')`);
  ok(draft.rows.length === 0, 'un borrador no es visible para el empleado');
  const pub = await one(U.manager, `select public.publish_schedule($1, current_date, current_date + 7) as n`, [guemes.id]);
  ok(pub.n >= 1, 'el gerente publica el horario');
  const seen = await as(U.emp1, `select * from public.my_shifts(now(), now() + interval '7 days')`);
  ok(seen.rows.some((r) => r.id === shiftId), 'el empleado ve su turno publicado');
  const upd = await as(U.manager, `update shifts set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour' where id = $1`, [shiftId]);
  ok(!upd.error, 'el gerente modifica el turno');
  const hist = await as(U.emp1, `select * from shift_changes where shift_id = $1 and change_type = 'updated'`, [shiftId]);
  const n = await as(U.emp1, `select count(*)::int n from notifications where type = 'schedule' and title like 'Se modificó%'`);
  ok(hist.rows.length === 1 && n.rows[0].n === 1, 'queda historial y el empleado recibe la novedad');
  const overlap = await as(U.manager, `insert into shifts (branch_id, user_id, starts_at, ends_at) values ($1,$2, now() + interval '1 day 2 hours', now() + interval '1 day 5 hours')`, [guemes.id, U.emp1]);
  ok(overlap.error?.code === '23P01', 'se impiden solapamientos');
  const selfEdit = await as(U.emp1, `update shifts set ends_at = ends_at - interval '2 hours' where id = $1`, [shiftId]);
  const after = await q(`select ends_at, starts_at from shifts where id = $1`, [shiftId]);
  ok(!!selfEdit.error || (after[0].ends_at - after[0].starts_at) === 8 * 3600e3, 'un empleado no puede modificar su horario publicado');
  const otherBranch = await as(U.manager, `insert into shifts (branch_id, user_id, starts_at, ends_at) values ($1,$2, now() + interval '3 day', now() + interval '3 day 6 hours')`, [colon.id, U.emp1]);
  ok(otherBranch.error?.code === '42501', 'un gerente de sucursal no programa en otra sucursal');
  const adminOther = await as(U.admin, `insert into shifts (branch_id, user_id, starts_at, ends_at, status) values ($1,$2, now() + interval '3 day', now() + interval '3 day 6 hours', 'published')`, [colon.id, U.emp1]);
  ok(!adminOther.error, 'se puede asignar personal a otra sucursal de la misma razón social sin duplicar identidad', adminOther.error?.message);
  const crossLe = await as(U.admin, `insert into shifts (branch_id, user_id, starts_at, ends_at) values ($1,$2, now() + interval '5 day', now() + interval '5 day 6 hours')`, [casino.id, U.emp1]);
  ok(crossLe.error?.code === '23514', 'no se asigna a una razón social con la que no hay relación laboral');
}

section('PRUEBA 6 — Fichaje móvil (GPS + QR)');
let deviceSecret, qrToken;
{
  const reg = await one(U.manager, `select public.register_kiosk_device($1, 'Tablet mostrador', 'both') as r`, [guemes.id]);
  const pair = await as(null, `select public.kiosk_pair($1) as r`, [reg.r.pairing_code], { role: 'anon' });
  ok(!pair.error, 'la tablet se vincula con código de un solo uso', pair.error?.message);
  deviceSecret = pair.rows[0].r.device_secret;
  const again = await as(null, `select public.kiosk_pair($1)`, [reg.r.pairing_code], { role: 'anon' });
  ok(!!again.error, 'el código de vinculación no se reutiliza');
  qrToken = (await one(null, `select public.kiosk_issue_qr($1) as r`, [deviceSecret], { role: 'anon' })).r.token;

  const far = await one(U.emp1, `select public.clock_punch('in', $1, $2, $3, $4, 10, $5) as r`, [guemes.id, qrToken, LAT + 0.01, LNG, randomUUID()]);
  ok(far.r.result === 'geo_outside' && far.r.review_available, 'fuera del perímetro: no se confirma y se ofrece revisión');
  const cnt0 = await q(`select count(*)::int n from attendance_punches where user_id = $1`, [U.emp1]);
  ok(cnt0[0].n === 0, '…y no se registra ninguna fichada');
  const imprecise = await one(U.emp1, `select public.clock_punch('in', $1, $2, $3, $4, 300, $5) as r`, [guemes.id, qrToken, LAT, LNG, randomUUID()]);
  ok(imprecise.r.result === 'geo_imprecise', 'precisión insuficiente se informa como imprecisa');
  const rid = randomUUID();
  const good = await one(U.emp1, `select public.clock_punch('in', $1, $2, $3, $4, 15, $5) as r`, [guemes.id, qrToken, LAT + 0.0001, LNG, rid]);
  ok(good.r.result === 'confirmed' && good.r.status === 'confirmed', 'dentro del perímetro y con QR vigente: el servidor confirma');
  const dup = await one(U.emp1, `select public.clock_punch('in', $1, $2, $3, $4, 15, $5) as r`, [guemes.id, qrToken, LAT, LNG, rid]);
  ok(dup.r.result === 'duplicate' && dup.r.punch_id === good.r.punch_id, 'reintento con el mismo id: idempotente');
  const twice = await one(U.emp1, `select public.clock_punch('in', $1, $2, $3, $4, 15, $5) as r`, [guemes.id, qrToken, LAT, LNG, randomUUID()]);
  ok(twice.r.result === 'already_open', 'un segundo ingreso con jornada abierta no se registra');
  const board = await as(U.manager, `select * from public.attendance_board(current_date) where user_id = $1`, [U.emp1]);
  ok(board.rows.length === 1 && board.rows[0].session_id, 'el gerente visualiza el registro en el panel');
  const boardB = await as(U.empB, `select * from attendance_punches where user_id = $1`, [U.emp1]);
  ok(boardB.rows.length === 0, 'otra empresa no ve las fichadas');
  const review = await one(U.emp2, `select public.clock_punch('in', $1, $2, $3, $4, 10, $5, true, 'GPS falla adentro') as r`, [guemes.id, qrToken, LAT + 0.01, LNG, randomUUID()]);
  ok(review.r.result === 'pending_review' && review.r.status === 'pending_review', 'procedimiento de excepción: queda pendiente de revisión, no confirmada');
  const rv = await as(U.manager, `select public.review_punch($1, true, 'Verificado en persona')`, [review.r.punch_id]);
  ok(!rv.error, 'el responsable valida la fichada pendiente', rv.error?.message);
  const orig = await q(`select status, server_time, reviewed_by from attendance_punches where id = $1`, [review.r.punch_id]);
  ok(orig[0].status === 'confirmed' && orig[0].reviewed_by === U.manager, 'queda registrado quién aprobó');
  const tamper = await as(U.emp1, `update attendance_punches set server_time = now() - interval '2 hours' where id = $1`, [good.r.punch_id]);
  ok(!!tamper.error, 'el empleado no puede alterar la hora de su fichada');
  const tamper2 = await as(U.manager, `delete from attendance_punches where id = $1`, [good.r.punch_id]);
  ok(!!tamper2.error, 'nadie puede borrar fichadas desde la API');
  const offline = await one(U.emp2, `select public.clock_punch('out', $1, null, null, null, null, $2, false, null, now() - interval '20 minutes') as r`, [guemes.id, randomUUID()]);
  ok(offline.r.status === 'pending_review', 'fichada sin conexión: pendiente, con hora declarada y de recepción');
  const outNoIn = await one(U.emp3, `select public.clock_punch('out', $1, null, null, null, null, $2) as r`, [casino.id, randomUUID()]);
  ok(['qr_required'].includes(outNoIn.r.result), 'sin QR no se registra (sucursal con QR obligatorio)');
  const anonPunch = await as(null, `select public.clock_punch('in', $1, $2)`, [guemes.id, qrToken], { role: 'anon' });
  ok(!!anonPunch.error, 'no se puede fichar sin sesión');
}

section('PRUEBA 7 — QR dinámico');
{
  const reused = await one(U.emp1, `select public.clock_punch('out', $1, $2, $3, $4, 10, $5) as r`, [guemes.id, qrToken, LAT, LNG, randomUUID()]);
  ok(reused.r.result === 'qr_reused', 'el mismo QR no puede reutilizarse por la misma persona');
  const t2 = (await one(null, `select public.kiosk_issue_qr($1) as r`, [deviceSecret], { role: 'anon' })).r.token;
  await q(`update qr_tokens set expires_at = now() - interval '1 second' where token_hash = app.sha256($1)`, [t2]);
  const expired = await one(U.emp1, `select public.clock_punch('out', $1, $2, $3, $4, 10, $5) as r`, [guemes.id, t2, LAT, LNG, randomUUID()]);
  ok(expired.r.result === 'qr_expired', 'un QR vencido no se acepta');
  const fake = await one(U.emp1, `select public.clock_punch('out', $1, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', $2, $3, 10, $4) as r`, [guemes.id, LAT, LNG, randomUUID()]);
  ok(fake.r.result === 'qr_invalid', 'un QR inventado se rechaza');
  const t3 = (await one(null, `select public.kiosk_issue_qr($1) as r`, [deviceSecret], { role: 'anon' })).r.token;
  await q(`insert into employment_branches (employment_id, branch_id) select id, $1 from employments where user_id = $2`, [colon.id, U.emp1]);
  const wrong = await one(U.emp1, `select public.clock_punch('out', $1, $2, $3, $4, 10, $5) as r`, [colon.id, t3, LAT + 0.01, LNG, randomUUID()]);
  ok(wrong.r.result === 'qr_wrong_branch', 'un QR de otra sucursal se rechaza');
  const att = await as(U.manager, `select count(*)::int n from punch_attempts where user_id = $1 and reason like 'qr_%'`, [U.emp1]);
  ok(att.rows[0].n >= 3, 'los intentos sospechosos quedan registrados y visibles para gerencia');
  const tokensHidden = await as(U.manager, `select * from qr_tokens`);
  ok(!!tokensHidden.error || tokensHidden.rows.length === 0, 'los tokens no son legibles desde la API');
  const out = await one(U.emp1, `select public.clock_punch('out', $1, $2, $3, $4, 10, $5) as r`, [guemes.id, t3, LAT, LNG, randomUUID()]);
  ok(out.r.result === 'confirmed', 'con un QR nuevo y vigente, la salida se confirma');
}

section('PRUEBA 8 — Tablet de fichaje (kiosco)');
{
  const weak = await as(U.emp2, `select public.set_kiosk_pin('123456')`);
  ok(!!weak.error, 'se rechazan PIN triviales');
  await one(U.emp2, `select public.set_kiosk_pin('480159')`);
  const hidden = await as(U.manager, `select kiosk_pin_hash from employments limit 1`);
  ok(!!hidden.error, 'el hash del PIN no es legible desde la API');
  // emp2 tiene una jornada abierta (validada en la prueba 6): registra la salida.
  const k = await one(null, `select public.kiosk_punch($1, 'emp-2', '480159', 'out', $2) as r`, [deviceSecret, randomUUID()], { role: 'anon' });
  ok(k.r.result === 'confirmed' && k.r.first_name === 'Pablo', 'el empleado ficha desde la tablet autorizada');
  const stored = await q(`select source, device_id from attendance_punches where id = $1`, [k.r.punch_id]);
  ok(stored[0].source === 'kiosk', 'se guarda en el mismo sistema que las fichadas móviles');
  const bad = await one(null, `select public.kiosk_punch($1, 'EMP-2', '000001', 'in', $2) as r`, [deviceSecret, randomUUID()], { role: 'anon' });
  const ghost = await one(null, `select public.kiosk_punch($1, 'NOEXISTE', '000001', 'in', $2) as r`, [deviceSecret, randomUUID()], { role: 'anon' });
  ok(bad.r.result === 'bad_credentials' && ghost.r.result === 'bad_credentials', 'PIN incorrecto y código inexistente responden igual (sin enumeración)');
  for (let i = 0; i < 5; i++) await as(null, `select public.kiosk_punch($1, 'EMP-2', '000001', 'in', $2)`, [deviceSecret, randomUUID()], { role: 'anon' });
  const locked = await as(null, `select public.kiosk_punch($1, 'EMP-2', '480159', 'in', $2)`, [deviceSecret, randomUUID()], { role: 'anon' });
  ok(/bloqueado/.test(locked.error?.message || ''), 'bloqueo tras intentos fallidos repetidos');
  const devId = (await q(`select id from kiosk_devices limit 1`))[0].id;
  await one(U.manager, `select public.revoke_kiosk_device($1)`, [devId]);
  const revoked = await as(null, `select public.kiosk_issue_qr($1)`, [deviceSecret], { role: 'anon' });
  ok(!!revoked.error, 'un dispositivo revocado deja de funcionar');
  const noDevice = await as(null, `select public.kiosk_punch('secreto-inventado-1234567890', 'EMP-1', '480159', 'in', $1)`, [randomUUID()], { role: 'anon' });
  ok(!!noDevice.error, 'un dispositivo no autorizado no puede fichar');
}

section('PRUEBA 9 — Reuniones');
{
  const rec = await as(U.emp1, `select * from public.allowed_recipients('meeting')`);
  ok(rec.rows.some((r) => r.user_id === U.manager) && !rec.rows.some((r) => r.user_id === U.empB), 'el empleado solo ve responsables autorizados');
  const m = await one(U.emp1, `select public.request_meeting($1, 'Hablar de mis horarios', 'Quisiera ver mis francos', current_date + 2, '10:00', 'in_person') as id`, [U.manager]);
  const inbox = await as(U.manager, `select * from meeting_requests where id = $1`, [m.id]);
  ok(inbox.rows.length === 1, 'gerencia recibe la solicitud');
  await one(U.manager, `select public.respond_meeting($1, 'propose', now() + interval '3 days', 'Mejor el jueves', 'Oficina')`, [m.id]);
  const mine = await one(U.emp1, `select status, scheduled_at, response_note from meeting_requests where id = $1`, [m.id]);
  ok(mine.status === 'proposed' && mine.scheduled_at && mine.response_note === 'Mejor el jueves', 'el empleado ve la fecha propuesta');
  const other = await as(U.emp2, `select * from meeting_requests where id = $1`, [m.id]);
  ok(other.rows.length === 0, 'otros trabajadores no ven la reunión');
  const t = await as(U.emp1, `select public.create_mgmt_ticket($1, (select id from mgmt_categories where key='personal' and organization_id=$2), 'Consulta', 'Detalle de la consulta') as id`, [U.manager, org.id]);
  ok(!t.error, 'se crea un mensaje a gerencia', t.error?.message);
  const tAdmin = await as(U.admin, `select * from mgmt_ticket_messages where ticket_id = $1`, [t.rows[0].id]);
  ok(tAdmin.rows.length === 0, 'el canal institucional es exclusivo de sus participantes');
}

section('PRUEBA 10 — Aislamiento entre empresas y escalamiento de privilegios');
{
  for (const [tbl, col] of [['employments', 'organization_id'], ['profiles', 'organization_id'], ['attendance_sessions', 'organization_id'],
                            ['shifts', 'organization_id'], ['hr_requests', 'organization_id'], ['branches', 'organization_id'], ['audit_log', 'organization_id']]) {
    const r = await as(U.empB, `select count(*)::int n from ${tbl} where ${col} = $1`, [org.id]);
    ok(!r.error && r.rows[0].n === 0, `empB no lee ${tbl} de otra empresa`, r.error?.message);
  }
  const card = await as(U.empB, `select public.person_card($1)`, [U.emp1]);
  ok(card.error?.code === '42501', 'perfil de otra empresa no disponible vía RPC');
  const punch = await one(U.empB, `select public.clock_punch('in', $1, null, $2, $3, 10, $4) as r`, [guemes.id, LAT, LNG, randomUUID()]);
  ok(punch.r.result === 'branch_not_allowed', 'no se puede fichar en sucursales de otra empresa');
  const esc1 = await as(U.emp1, `insert into role_assignments (user_id, role_id, organization_id, scope_type, scope_id) values ($1,$2,$3,'organization',$3)`, [U.emp1, await role('company_admin'), org.id]);
  ok(!!esc1.error, 'un empleado no puede autoasignarse roles');
  const esc2 = await as(U.manager, `select public.assign_role($1, $2, 'organization', $3)`, [U.emp1, await role('company_admin'), org.id]);
  ok(esc2.error?.code === '42501', 'un gerente de sucursal no puede otorgar roles');
  const esc3 = await as(U.emp1, `update employments set status = 'terminated' where user_id = $1`, [U.emp2]);
  const st = await q(`select status from employments where user_id = $1`, [U.emp2]);
  ok(st[0].status === 'active', 'un empleado no puede modificar relaciones laborales', esc3.error?.message);
  const aal1 = await as(U.manager, `select count(*)::int n from public.admin_employees()`, [], { aal: 'aal1' });
  ok(aal1.rows[0]?.n === 0, 'sin MFA (aal1) los permisos administrativos no se aplican');
  const aal2 = await as(U.manager, `select count(*)::int n from public.admin_employees()`);
  ok(aal2.rows[0]?.n >= 3, 'con MFA (aal2) el gerente ve a su equipo');
  const scope = await as(U.manager, `select count(*)::int n from public.admin_employees() where branch_name = 'Casino Central'`);
  ok(scope.rows[0].n === 0, 'un gerente de sucursal no ve personal de otras sucursales');
  const priv = await as(U.manager, `select * from employee_private`);
  ok(priv.rows.length === 0, 'un gerente de sucursal no accede a datos personales sensibles');
  const plat = await as(U.platform, `select count(*)::int n from messages`);
  ok(plat.rows[0].n === 0, 'la superadministración técnica no lee mensajes privados');
  const assign = await as(U.admin, `select public.assign_role($1, $2, 'branch', $3)`, [U.emp1, await role('supervisor'), guemes.id]);
  ok(!assign.error, 'el administrador de empresa sí puede asignar roles (auditado)', assign.error?.message);
  const aud = await as(U.admin, `select count(*)::int n from audit_log where action = 'role.assign'`);
  ok(aud.rows[0].n === 1, 'la asignación queda en auditoría');
}

section('PRUEBA 11 — Jornada nocturna (22:00 → 06:00)');
{
  const tz = 'America/Argentina/Buenos_Aires';
  const [{ d }] = await q(`select (now() at time zone $1)::date - 3 as d`, [tz]);
  const day = d.toISOString().slice(0, 10);
  const [sh] = await q(`insert into shifts (branch_id, user_id, starts_at, ends_at, status)
                        values ($1, $2, ($3::date + time '22:00') at time zone $4, ($3::date + 1 + time '06:00') at time zone $4, 'published') returning *`,
                        [guemes.id, U.emp2, day, tz]);
  ok(sh && (sh.ends_at - sh.starts_at) === 8 * 3600e3, 'el turno de 8 h que cruza la medianoche se guarda como una unidad');
  // Se usa la función interna con hora efectiva controlada (solo posible para el rol postgres).
  await q(`select app.record_punch($1, (select e from employments e where e.user_id = $1), $2, 'in', 'kiosk', 'confirmed', null, null, null, null, 'not_required', null, null, '{}', null, $3, null, ($4::date + time '22:02') at time zone $5)`,
    [U.emp2, guemes.id, randomUUID(), day, tz]);
  await q(`select app.record_punch($1, (select e from employments e where e.user_id = $1), $2, 'out', 'kiosk', 'confirmed', null, null, null, null, 'not_required', null, null, '{}', null, $3, null, ($4::date + 1 + time '06:01') at time zone $5)`,
    [U.emp2, guemes.id, randomUUID(), day, tz]);
  const rep = await as(U.manager, `select * from public.attendance_report($1::date, $1::date + 1) where user_id = $2 and day = $1::date`, [day, U.emp2]);
  ok(rep.rows.length === 1, 'la jornada nocturna figura como UNA jornada, en el día de inicio');
  ok(rep.rows[0]?.worked_minutes === 479, `duración correcta (7 h 59 min)`, `→ ${rep.rows[0]?.worked_minutes}`);
  ok(rep.rows[0]?.shift_starts && +rep.rows[0].shift_starts === +sh.starts_at, 'se asocia al turno nocturno programado');
  const nextDay = await as(U.manager, `select * from public.attendance_report($1::date + 1, $1::date + 1) where user_id = $2`, [day, U.emp2]);
  ok(nextDay.rows.length === 0, 'no se divide en el día siguiente');
}

section('PRUEBA 12 — Documentos privados (recibos)');
{
  const path = `le/${guemes.legal_entity_id}/u/${U.emp1}/recibo-2026-10.pdf`;
  await q(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [path]);
  const reg = await as(U.admin, `select public.register_document($1, $2, 'payslip', 'Recibo octubre 2026', $3, 'application/pdf', 1024) as id`, [guemes.legal_entity_id, U.emp1, path]);
  ok(!reg.error, 'RR. HH./administración publica el recibo', reg.error?.message);
  const own = await as(U.emp1, `select name from storage.objects where bucket_id = 'documents' and name = $1`, [path]);
  ok(own.rows.length === 1, 'el titular puede acceder a su recibo');
  for (const k of ['emp2', 'manager', 'empB', 'platform']) {
    const r = await as(U[k], `select name from storage.objects where bucket_id = 'documents' and name = $1`, [path]);
    const d = await as(U[k], `select id from documents where storage_path = $1`, [path]);
    ok(r.rows.length === 0 && d.rows.length === 0, `${k} NO puede abrirlo aunque conozca la ruta`);
  }
  const mgrPub = await as(U.manager, `select public.register_document($1, $2, 'payslip', 'x', $3, 'application/pdf', 1)`, [guemes.legal_entity_id, U.emp2, `le/${guemes.legal_entity_id}/u/x.pdf`]);
  ok(mgrPub.error?.code === '42501', 'un gerente de sucursal no publica recibos');
  const ev = await as(U.emp1, `select public.log_document_event($1, 'viewed')`, [reg.rows[0].id]);
  ok(!ev.error, 'se registra la visualización (distinta de firma o notificación fehaciente)');
}

section('Extra — Correcciones, solicitudes y privacidad');
{
  const c = await as(U.emp1, `select public.request_attendance_correction($1, 'in', now() - interval '3 hours', 'Olvidé fichar al llegar') as id`, [guemes.id]);
  ok(!c.error, 'el empleado solicita una corrección', c.error?.message);
  const selfApprove = await as(U.emp1, `select public.review_attendance_correction($1, true)`, [c.rows[0].id]);
  ok(!!selfApprove.error, 'no puede aprobarla él mismo');
  const appr = await as(U.manager, `select public.review_attendance_correction($1, true, 'OK')`, [c.rows[0].id]);
  ok(!appr.error, 'el responsable la aprueba', appr.error?.message);
  const corr = await q(`select * from attendance_corrections where id = $1`, [c.rows[0].id]);
  const np = await q(`select * from attendance_punches where id = $1`, [corr[0].result_punch_id]);
  ok(np[0].source === 'correction' && np[0].reviewed_by === U.manager && np[0].declared_time, 'la corrección genera un registro nuevo con aprobador; el original no se altera');
  const hr = await as(U.emp1, `select public.create_hr_request('vacation', current_date + 30, current_date + 34, 'Vacaciones de verano') as id`);
  ok(!hr.error, 'solicitud de vacaciones creada');
  const hrOther = await as(U.emp2, `select * from hr_requests where id = $1`, [hr.rows[0].id]);
  ok(hrOther.rows.length === 0, 'otro empleado no ve la solicitud');
  const ok2 = await as(U.manager, `select public.review_hr_request($1, true, 'Aprobado')`, [hr.rows[0].id]);
  const offs = await as(U.emp1, `select count(*)::int n from public.my_days_off(current_date, current_date + 40)`);
  ok(!ok2.error && offs.rows[0].n === 5, 'al aprobarse, los días figuran en su calendario');
  const exp = await one(U.emp1, `select public.export_my_data() as d`);
  ok(exp.d.profile && !JSON.stringify(exp.d).includes('kiosk_pin_hash'), 'la persona puede exportar sus datos (Ley 25.326) sin secretos');
  const vote = await as(U.emp1, `select public.vote_poll(gen_random_uuid(), 0)`);
  ok(!!vote.error, 'no se vota en encuestas inexistentes o ajenas');
}

section('Extra — Cambio de turno, grupos y almacenamiento');
{
  // Turnos publicados futuros para emp1 y emp2 en Güemes (días distintos, sin solaparse)
  const [s1] = await q(`insert into shifts (branch_id, user_id, starts_at, ends_at, status) values ($1,$2, now() + interval '10 days', now() + interval '10 days 6 hours', 'published') returning id`, [guemes.id, U.emp1]);
  const [s2] = await q(`insert into shifts (branch_id, user_id, starts_at, ends_at, status) values ($1,$2, now() + interval '12 days', now() + interval '12 days 6 hours', 'published') returning id`, [guemes.id, U.emp2]);
  const cand = await as(U.emp1, `select * from public.swap_candidates($1)`, [s1.id]);
  ok(cand.rows.some((c) => c.shift_id === s2.id), 'el empleado ve turnos compatibles para intercambiar');
  const req = await one(U.emp1, `select public.request_shift_swap($1, $2, $3, 'Tengo un turno médico') as id`, [s1.id, U.emp2, s2.id]);
  const early = await as(U.manager, `select public.review_shift_swap($1, true)`, [req.id]);
  ok(!!early.error, 'gerencia no puede aprobar antes de que acepte el compañero');
  await one(U.emp2, `select public.respond_shift_swap($1, true)`, [req.id]);
  const self = await as(U.emp1, `select public.review_shift_swap($1, true)`, [req.id]);
  ok(!!self.error, 'el empleado no puede autoaprobar el cambio');
  const appr = await as(U.manager, `select public.review_shift_swap($1, true, 'OK')`, [req.id]);
  ok(!appr.error, 'el responsable aprueba el cambio', appr.error?.message);
  const after = await q(`select id, user_id from shifts where id in ($1, $2)`, [s1.id, s2.id]);
  ok(after.find((x) => x.id === s1.id).user_id === U.emp2 && after.find((x) => x.id === s2.id).user_id === U.emp1, 'los turnos quedan intercambiados');
  const hist = await q(`select count(*)::int n from shift_changes where shift_id in ($1,$2) and change_type = 'swapped'`, [s1.id, s2.id]);
  ok(hist[0].n === 2, 'el intercambio queda en el historial');

  const g = await as(U.emp1, `insert into groups (organization_id, brand_id, name, kind, join_policy, created_by) values ($1,$2,'Baristas','interest','open',$3) returning id`, [org.id, guemes.brand_id, U.emp1]);
  ok(!g.error, 'un empleado crea un grupo de interés', g.error?.message);
  const j = await one(U.emp2, `select public.join_group($1) as r`, [g.rows[0].id]);
  ok(j.r === 'active', 'otro empleado se une');
  const gp = await as(U.emp2, `select public.create_post('Hola grupo', 'group', '{}', $1) as id`, [g.rows[0].id]);
  const seen3 = await as(U.emp3, `select * from posts where id = $1`, [gp.rows[0]?.id]);
  ok(!gp.error && seen3.rows.length === 0, 'publicación de grupo: no visible para no miembros');
  const inst = await as(U.admin, `insert into groups (organization_id, name, kind, created_by) values ($1, 'Oficial', 'official', $2)`, [org.id, U.emp1]);
  ok(!!inst.error, 'no se puede crear un grupo a nombre de otra persona');

  const conv = await one(U.emp1, `select public.start_direct_conversation($1) as id`, [U.emp2]);
  await q(`insert into storage.objects (bucket_id, name) values ('chat', $1)`, [`conv/${conv.id}/foto.jpg`]);
  const c1 = await as(U.emp2, `select name from storage.objects where bucket_id = 'chat'`);
  const c2 = await as(U.manager, `select name from storage.objects where bucket_id = 'chat'`);
  ok(c1.rows.length === 1 && c2.rows.length === 0, 'adjuntos de chat: solo participantes');
  const up = await as(U.emp3, `insert into storage.objects (bucket_id, name) values ('chat', $1)`, [`conv/${conv.id}/intruso.jpg`]);
  ok(!!up.error, 'un tercero no puede subir archivos a una conversación ajena');
  const mediaOk = await as(U.emp1, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`org/${org.id}/u/${U.emp1}/a.jpg`]);
  const mediaBad = await as(U.emp1, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`org/${org.id}/u/${U.emp2}/a.jpg`]);
  const mediaB = await as(U.empB, `select name from storage.objects where bucket_id = 'media'`);
  ok(!mediaOk.error && !!mediaBad.error && mediaB.rows.length === 0, 'fotos: cada uno sube solo en su carpeta; otra empresa no las ve');

  const boardOther = await as(U.manager, `select count(*)::int n from public.attendance_board(current_date) where branch_id = $1`, [casino.id]);
  ok(boardOther.rows[0].n === 0, 'un gerente de sucursal no ve la asistencia de otras sucursales');
  const fp = await as(U.empB, `select * from public.feed_post($1)`, [postId]);
  ok(fp.rows.length === 0, 'feed_post respeta la visibilidad');
}

await db.end();
console.log(results.join('\n'));
console.log(`\n${passed} pruebas superadas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
