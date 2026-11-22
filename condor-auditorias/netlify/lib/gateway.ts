// API compatible con el cliente @supabase/supabase-js, ejecutada en Netlify Functions
// sobre Netlify Database (PostgreSQL) y Netlify Blobs.
//
//   /rest/v1/*     → subconjunto de PostgREST (select con relaciones, filtros, orden,
//                    inserción/upsert/actualización/borrado, rpc)
//   /auth/v1/*     → subconjunto de GoTrue (contraseña, renovación, usuario, cierre)
//   /storage/v1/*  → subconjunto de Storage (subida, URLs firmadas, públicas, borrado)
//
// Seguridad: cada solicitud corre en una transacción con el rol "anon" o "authenticated"
// y el usuario en request.jwt.claim.sub; las políticas RLS de la base deciden el acceso.
// Los identificadores (tablas, columnas, funciones) se validan contra el catálogo y
// todos los valores viajan como parámetros.
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface BlobStore {
  get(key: string): Promise<{ data: ArrayBuffer; contentType: string } | null>;
  set(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface GatewayEnv {
  pool: Pool;
  jwtSecret: string;
  blobs: BlobStore;
  /** JSON {email, full_name, password_hash}: crea el administrador inicial si no existe ninguno. */
  initialAdmin?: string | null;
}

const ACCESS_TTL = 3600;
const REFRESH_TTL_DAYS = 30;
const IDENT = /^[a-z_][a-z0-9_]*$/;

// ---------------------------------------------------------------------------
// Utilidades HTTP / JWT
// ---------------------------------------------------------------------------
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token: string | null | undefined, secret: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  let given: Buffer;
  try { given = Buffer.from(parts[2], 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof p.exp === 'number' && p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  return h?.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;
}

/** Usuario autenticado de la solicitud (solo tokens de acceso firmados por esta API). */
function requestUser(req: Request, env: GatewayEnv): string | null {
  const p = verifyJwt(bearer(req), env.jwtSecret);
  return p && p.role === 'authenticated' && typeof p.sub === 'string' ? p.sub : null;
}

class HttpError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) { super(String(body.message ?? body.msg ?? 'error')); }
}

function pgError(e: unknown, uid: string | null): Response {
  if (e instanceof HttpError) return json(e.status, e.body);
  const err = e as { code?: string; message?: string; detail?: string; hint?: string };
  if (!err?.code) {
    console.error('api', e);
    return json(500, { code: 'PGRST000', message: 'Error interno del servidor', details: null, hint: null });
  }
  let status = 400;
  if (err.code === '42501') status = uid ? 403 : 401;
  else if (err.code === '23505' || err.code === '23503') status = 409;
  else if (err.code === '42P01' || err.code === '42883') status = 404;
  return json(status, { code: err.code, message: err.message ?? 'Error', details: err.detail ?? null, hint: err.hint ?? null });
}

async function withRole<T>(env: GatewayEnv, uid: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await env.pool.connect();
  try {
    await c.query('begin');
    await c.query(uid ? 'set local role app_authenticated' : 'set local role app_anon');
    await c.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [uid ?? '', uid ? 'authenticated' : 'anon']);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------------------
// Catálogo (tablas, columnas, claves foráneas, funciones)
// ---------------------------------------------------------------------------
interface Catalog {
  columns: Map<string, Set<string>>;
  pk: Map<string, string[]>;
  fks: { table: string; column: string; ref: string; refColumn: string }[];
  functions: Map<string, { returns: string; composite: boolean; set: boolean }>;
}
let catalogCache: { at: number; cat: Catalog } | null = null;

async function catalog(env: GatewayEnv): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60 * 1000) return catalogCache.cat;
  const [cols, pks, fks, fns] = await Promise.all([
    env.pool.query(`select c.relname as t, a.attname as c from pg_attribute a join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','m') and a.attnum > 0 and not a.attisdropped`),
    env.pool.query(`select c.relname as t, array_agg(a.attname order by k.ord) as cols from pg_constraint x
      join pg_class c on c.oid = x.conrelid join pg_namespace n on n.oid = c.relnamespace
      cross join lateral unnest(x.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
      where n.nspname = 'public' and x.contype = 'p' group by c.relname`),
    env.pool.query(`select c.relname as t, a.attname as c, rc.relname as rt, ra.attname as rcol from pg_constraint x
      join pg_class c on c.oid = x.conrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_class rc on rc.oid = x.confrelid join pg_namespace rn on rn.oid = rc.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = x.conkey[1]
      join pg_attribute ra on ra.attrelid = rc.oid and ra.attnum = x.confkey[1]
      where x.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public' and array_length(x.conkey, 1) = 1`),
    env.pool.query(`select p.proname as name, format_type(p.prorettype, null) as returns, t.typtype = 'c' as composite, p.proretset as set
      from pg_proc p join pg_type t on t.oid = p.prorettype where p.pronamespace = 'public'::regnamespace`),
  ]);
  const cat: Catalog = { columns: new Map(), pk: new Map(), fks: [], functions: new Map() };
  for (const r of cols.rows) {
    if (!cat.columns.has(r.t)) cat.columns.set(r.t, new Set());
    cat.columns.get(r.t)!.add(r.c);
  }
  for (const r of pks.rows) cat.pk.set(r.t, r.cols);
  for (const r of fks.rows) cat.fks.push({ table: r.t, column: r.c, ref: r.rt, refColumn: r.rcol });
  for (const r of fns.rows) cat.functions.set(r.name, { returns: r.returns, composite: r.composite, set: r.set });
  catalogCache = { at: Date.now(), cat };
  return cat;
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

function assertTable(cat: Catalog, t: string) {
  if (!IDENT.test(t) || !cat.columns.has(t)) throw new HttpError(404, { code: '42P01', message: `Relación desconocida: ${t}`, details: null, hint: null });
}
function assertColumn(cat: Catalog, t: string, c: string) {
  if (!IDENT.test(c) || !cat.columns.get(t)?.has(c)) throw new HttpError(400, { code: '42703', message: `Columna desconocida: ${t}.${c}`, details: null, hint: null });
}

// ---------------------------------------------------------------------------
// select=*,branches(name),questions(text,categories(name))
// ---------------------------------------------------------------------------
type SelItem = { kind: 'star' } | { kind: 'col'; name: string } | { kind: 'embed'; name: string; items: SelItem[] };

export function parseSelect(s: string): SelItem[] {
  let i = 0;
  const parseList = (): SelItem[] => {
    const items: SelItem[] = [];
    while (i < s.length) {
      let tok = '';
      while (i < s.length && !',()'.includes(s[i])) tok += s[i++];
      tok = tok.trim();
      if (s[i] === '(') {
        i++;
        const inner = parseList();
        if (s[i] !== ')') throw new HttpError(400, { code: 'PGRST100', message: 'select inválido', details: null, hint: null });
        i++;
        const name = tok.includes(':') ? tok.split(':').pop()! : tok;
        items.push({ kind: 'embed', name: name.replace(/!.*$/, ''), items: inner });
      } else if (tok === '*') items.push({ kind: 'star' });
      else if (tok) items.push({ kind: 'col', name: tok });
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ')' || i >= s.length) break;
    }
    return items;
  };
  const out = parseList();
  return out.length ? out : [{ kind: 'star' }];
}

function buildExprs(cat: Catalog, table: string, alias: string, items: SelItem[], depth: number): string[] {
  const exprs: string[] = [];
  for (const it of items) {
    if (it.kind === 'star') exprs.push(`${alias}.*`);
    else if (it.kind === 'col') { assertColumn(cat, table, it.name); exprs.push(`${alias}.${q(it.name)}`); }
    else {
      assertTable(cat, it.name);
      const sub = `_t${depth + 1}`;
      const inner = buildExprs(cat, it.name, sub, it.items, depth + 1).join(', ');
      const m2o = cat.fks.find((f) => f.table === table && f.ref === it.name);
      const o2m = cat.fks.find((f) => f.table === it.name && f.ref === table);
      if (m2o) {
        exprs.push(`(select to_json(_e${depth}) from (select ${inner} from public.${q(it.name)} ${sub} where ${sub}.${q(m2o.refColumn)} = ${alias}.${q(m2o.column)}) _e${depth}) as ${q(it.name)}`);
      } else if (o2m) {
        exprs.push(`(select coalesce(json_agg(_e${depth}), '[]'::json) from (select ${inner} from public.${q(it.name)} ${sub} where ${sub}.${q(o2m.column)} = ${alias}.${q(o2m.refColumn)}) _e${depth}) as ${q(it.name)}`);
      } else {
        throw new HttpError(400, { code: 'PGRST200', message: `Sin relación entre ${table} y ${it.name}`, details: null, hint: null });
      }
    }
  }
  return exprs;
}

// ---------------------------------------------------------------------------
// Filtros: col=eq.valor | in.("a","b") | is.null | ilike.%x% ...
// ---------------------------------------------------------------------------
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

function splitInList(v: string): string[] {
  const body = v.replace(/^\(/, '').replace(/\)$/, '');
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === '\\' && quoted) { cur += body[++i] ?? ''; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.length || body.length) out.push(cur);
  return out;
}

function buildWhere(cat: Catalog, table: string, alias: string, params: URLSearchParams, values: unknown[]): string {
  const conds: string[] = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    assertColumn(cat, table, key);
    let v = raw, negate = false;
    if (v.startsWith('not.')) { negate = true; v = v.slice(4); }
    const dot = v.indexOf('.');
    const op = dot === -1 ? v : v.slice(0, dot);
    const val = dot === -1 ? '' : v.slice(dot + 1);
    const col = `${alias}.${q(key)}`;
    let cond: string;
    if (op in OPS) {
      values.push(op === 'like' || op === 'ilike' ? val.replace(/\*/g, '%') : val);
      cond = `${col} ${OPS[op]} $${values.length}`;
    } else if (op === 'is') {
      const lit = val.toLowerCase();
      if (!['null', 'true', 'false', 'unknown'].includes(lit)) throw new HttpError(400, { code: 'PGRST100', message: 'Filtro is inválido', details: null, hint: null });
      cond = `${col} is ${lit}`;
    } else if (op === 'in') {
      const list = splitInList(val);
      if (!list.length) cond = 'false';
      else cond = `${col} in (${list.map((x) => { values.push(x); return `$${values.length}`; }).join(', ')})`;
    } else {
      throw new HttpError(400, { code: 'PGRST100', message: `Operador no admitido: ${op}`, details: null, hint: null });
    }
    conds.push(negate ? `not (${cond})` : cond);
  }
  return conds.length ? ` where ${conds.join(' and ')}` : '';
}

function buildOrder(cat: Catalog, table: string, alias: string, order: string | null): string {
  if (!order) return '';
  const parts = order.split(',').map((p) => {
    const [col, ...mods] = p.split('.');
    assertColumn(cat, table, col);
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
    return `${alias}.${q(col)} ${dir}${nulls}`;
  });
  return ` order by ${parts.join(', ')}`;
}

function intParam(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, 10000) : null;
}

function prefer(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get('prefer') ?? '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k) out[k] = v ?? '';
  }
  return out;
}

const toParam = (v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

// ---------------------------------------------------------------------------
// /rest/v1
// ---------------------------------------------------------------------------
async function rest(req: Request, env: GatewayEnv, path: string, url: URL): Promise<Response> {
  const uid = requestUser(req, env);
  const cat = await catalog(env);
  const params = url.searchParams;
  const pref = prefer(req);
  const wantsObject = (req.headers.get('accept') ?? '').includes('application/vnd.pgrst.object+json');

  try {
    // RPC
    if (path.startsWith('rpc/')) {
      const name = path.slice(4);
      const fn = cat.functions.get(name);
      if (!IDENT.test(name) || !fn) throw new HttpError(404, { code: '42883', message: `Función desconocida: ${name}`, details: null, hint: null });
      const args = req.method === 'GET' ? Object.fromEntries(params) : ((await req.json().catch(() => ({}))) as Record<string, unknown>);
      const values: unknown[] = [];
      const named = Object.entries(args ?? {}).map(([k, v]) => {
        if (!IDENT.test(k)) throw new HttpError(400, { code: 'PGRST100', message: 'Argumento inválido', details: null, hint: null });
        values.push(toParam(v));
        return `${q(k)} := $${values.length}`;
      }).join(', ');
      const call = `public.${q(name)}(${named})`;
      const sql = fn.returns === 'void' ? `select ${call}, null::json as data`
        : fn.composite ? `select to_json(_f) as data from ${call} _f`
        : `select to_json(${call}) as data`;
      const rows = await withRole(env, uid, (c) => c.query(sql, values));
      const data = rows.rows[0]?.data ?? null;
      // Funciones de borrado: eliminar también el contenido de los archivos.
      if (data && typeof data === 'object' && Array.isArray((data as { deleted_files?: unknown }).deleted_files)) {
        for (const f of (data as { deleted_files: string[] }).deleted_files) await env.blobs.delete(blobKey('evidencias', f)).catch(() => undefined);
      }
      return json(200, data);
    }

    const table = path.replace(/\/$/, '');
    assertTable(cat, table);

    if (req.method === 'GET' || req.method === 'HEAD') {
      const values: unknown[] = [];
      const exprs = buildExprs(cat, table, '_t0', parseSelect(params.get('select') ?? '*'), 0).join(', ');
      const where = buildWhere(cat, table, '_t0', params, values);
      const order = buildOrder(cat, table, '_t0', params.get('order'));
      const limit = intParam(params.get('limit'));
      const offset = intParam(params.get('offset'));
      const page = `${limit != null ? ` limit ${limit}` : ''}${offset != null ? ` offset ${offset}` : ''}`;
      const countWanted = pref.count === 'exact';
      const result = await withRole(env, uid, async (c) => {
        const data = req.method === 'HEAD' ? null
          : (await c.query(`select coalesce(json_agg(_r), '[]'::json) as data from (select ${exprs} from public.${q(table)} _t0${where}${order}${page}) _r`, values)).rows[0].data as unknown[];
        const total = countWanted ? Number((await c.query(`select count(*) as n from public.${q(table)} _t0${where}`, values)).rows[0].n) : null;
        return { data, total };
      });
      const n = result.data?.length ?? 0;
      const range = `${n ? `${offset ?? 0}-${(offset ?? 0) + n - 1}` : '*'}/${result.total ?? '*'}`;
      if (req.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': range } });
      if (wantsObject) {
        if (n !== 1) return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${n} rows`, hint: null });
        return json(200, result.data![0], { 'content-range': range });
      }
      return json(200, result.data, { 'content-range': range });
    }

    const representation = pref.return === 'representation';
    const selectExprs = representation ? buildExprs(cat, table, '_w', parseSelect(params.get('select') ?? '*').filter((x) => x.kind !== 'embed'), 0).join(', ') : '';

    if (req.method === 'POST') {
      const body = await req.json();
      const rows = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
      if (!rows.length) return json(201, representation ? [] : undefined);
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      cols.forEach((c) => assertColumn(cat, table, c));
      const values: unknown[] = [];
      const tuples = rows.map((r) => `(${cols.map((c) => { values.push(r[c] === undefined ? null : toParam(r[c])); return `$${values.length}`; }).join(', ')})`).join(', ');
      let conflict = '';
      if (pref.resolution === 'merge-duplicates' || pref.resolution === 'ignore-duplicates') {
        const target = (params.get('on_conflict')?.split(',').map((s) => s.trim()) ?? cat.pk.get(table) ?? []);
        target.forEach((c) => assertColumn(cat, table, c));
        if (!target.length) throw new HttpError(400, { code: 'PGRST100', message: 'Sin columnas de conflicto', details: null, hint: null });
        const updates = cols.filter((c) => !target.includes(c));
        conflict = pref.resolution === 'ignore-duplicates' || !updates.length
          ? ` on conflict (${target.map(q).join(', ')}) do nothing`
          : ` on conflict (${target.map(q).join(', ')}) do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}`;
      }
      const ins = `insert into public.${q(table)} (${cols.map(q).join(', ')}) values ${tuples}${conflict}`;
      const out = await withRole(env, uid, async (c) => representation
        ? (await c.query(`with _w as (${ins} returning *) select coalesce(json_agg(_r), '[]'::json) as data from (select ${selectExprs} from _w) _r`, values)).rows[0].data
        : (await c.query(ins, values), null));
      if (!representation) return new Response(null, { status: 201 });
      if (wantsObject) return out.length === 1 ? json(201, out[0]) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows`, hint: null });
      return json(201, out);
    }

    if (req.method === 'PATCH') {
      const body = (await req.json()) as Record<string, unknown>;
      const cols = Object.keys(body);
      if (!cols.length) return json(400, { code: 'PGRST100', message: 'Sin datos para actualizar', details: null, hint: null });
      cols.forEach((c) => assertColumn(cat, table, c));
      const values: unknown[] = cols.map((c) => toParam(body[c]));
      const set = cols.map((c, i) => `${q(c)} = $${i + 1}`).join(', ');
      const where = buildWhere(cat, table, '_t0', params, values);
      const upd = `update public.${q(table)} _t0 set ${set}${where}`;
      const out = await withRole(env, uid, async (c) => representation
        ? (await c.query(`with _w as (${upd} returning _t0.*) select coalesce(json_agg(_r), '[]'::json) as data from (select ${selectExprs} from _w) _r`, values)).rows[0].data
        : (await c.query(upd, values), null));
      if (!representation) return new Response(null, { status: 204 });
      return wantsObject ? (out.length === 1 ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null })) : json(200, out);
    }

    if (req.method === 'DELETE') {
      const values: unknown[] = [];
      const where = buildWhere(cat, table, '_t0', params, values);
      const del = `delete from public.${q(table)} _t0${where}`;
      const out = await withRole(env, uid, async (c) => representation
        ? (await c.query(`with _w as (${del} returning _t0.*) select coalesce(json_agg(_r), '[]'::json) as data from (select ${selectExprs} from _w) _r`, values)).rows[0].data
        : (await c.query(del, values), null));
      return representation ? json(200, out) : new Response(null, { status: 204 });
    }

    return json(405, { code: 'PGRST000', message: 'Método no permitido', details: null, hint: null });
  } catch (e) {
    return pgError(e, uid);
  }
}

// ---------------------------------------------------------------------------
// /auth/v1
// ---------------------------------------------------------------------------
interface UserRow { id: string; email: string; raw_app_meta_data: Record<string, unknown>; raw_user_meta_data: Record<string, unknown>; created_at: string; updated_at: string; last_sign_in_at: string | null; banned_until: string | null }

const USER_COLS = 'id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, banned_until';

function userJson(u: UserRow) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.created_at, confirmed_at: u.created_at, phone: '',
    app_metadata: { provider: 'email', providers: ['email'], ...u.raw_app_meta_data },
    user_metadata: u.raw_user_meta_data ?? {}, identities: [],
    created_at: u.created_at, updated_at: u.updated_at, last_sign_in_at: u.last_sign_in_at, is_anonymous: false,
  };
}

const authError = (status: number, code: string, msg: string) => json(status, { code: status, error: code, error_code: code, error_description: msg, msg });

async function ensureInitialAdmin(env: GatewayEnv) {
  if (!env.initialAdmin) return;
  let cfg: { email?: string; full_name?: string; password_hash?: string };
  try { cfg = JSON.parse(env.initialAdmin); } catch { return; }
  if (!cfg.email || !cfg.password_hash?.startsWith('$2')) return;
  const { rows } = await env.pool.query(`select exists (select 1 from public.profiles where role = 'admin') as has`);
  if (rows[0].has) return;
  const meta = { role: 'admin', active: true, full_name: cfg.full_name ?? 'Administración' };
  const ins = await env.pool.query(
    `insert into auth.users (email, encrypted_password, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3, $4)
     on conflict (email) do update set raw_app_meta_data = excluded.raw_app_meta_data returning id`,
    [cfg.email.toLowerCase(), cfg.password_hash, JSON.stringify(meta), JSON.stringify({ full_name: meta.full_name })]);
  await env.pool.query(`insert into public.profiles (id, email, full_name, role, active) values ($1, $2, $3, 'admin', true)
    on conflict (id) do update set role = 'admin', active = true`, [ins.rows[0].id, cfg.email.toLowerCase(), meta.full_name]);
}

async function issueSession(env: GatewayEnv, u: UserRow) {
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + ACCESS_TTL }, env.jwtSecret);
  const refresh = randomBytes(32).toString('base64url');
  await env.pool.query(`insert into auth.refresh_tokens (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${REFRESH_TTL_DAYS} days')`, [sha256(refresh), u.id]);
  await env.pool.query(`delete from auth.refresh_tokens where user_id = $1 and (expires_at < now() or revoked_at < now() - interval '1 day')`, [u.id]);
  return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, expires_at: now + ACCESS_TTL, refresh_token: refresh, user: userJson(u) };
}

const banned = (u: UserRow) => u.banned_until && new Date(u.banned_until) > new Date();

async function auth(req: Request, env: GatewayEnv, path: string, url: URL): Promise<Response> {
  try {
    if (path === 'token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      const body = (await req.json().catch(() => ({}))) as Record<string, string>;
      if (grant === 'password') {
        await ensureInitialAdmin(env);
        const email = String(body.email ?? '').trim().toLowerCase();
        const { rows } = await env.pool.query(`select ${USER_COLS} from auth.users where lower(email) = $1 and encrypted_password is not null and encrypted_password = crypt($2, encrypted_password)`, [email, String(body.password ?? '')]);
        const u = rows[0] as UserRow | undefined;
        if (!u) {
          await new Promise((r) => setTimeout(r, 400));
          return authError(400, 'invalid_credentials', 'Invalid login credentials');
        }
        if (banned(u)) return authError(400, 'user_banned', 'Usuario desactivado');
        await env.pool.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]);
        return json(200, await issueSession(env, u));
      }
      if (grant === 'refresh_token') {
        const h = sha256(String(body.refresh_token ?? ''));
        // Rotación con tolerancia de 30 s (varias pestañas pueden renovar a la vez)
        const { rows } = await env.pool.query(`update auth.refresh_tokens set revoked_at = coalesce(revoked_at, now())
          where token_hash = $1 and expires_at > now() and (revoked_at is null or revoked_at > now() - interval '30 seconds') returning user_id`, [h]);
        if (!rows[0]) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
        const { rows: us } = await env.pool.query(`select ${USER_COLS} from auth.users where id = $1`, [rows[0].user_id]);
        if (!us[0] || banned(us[0])) return authError(400, 'user_banned', 'Usuario desactivado');
        return json(200, await issueSession(env, us[0]));
      }
      return authError(400, 'unsupported_grant_type', 'Tipo de ingreso no admitido');
    }

    const uid = requestUser(req, env);
    if (path === 'user') {
      if (!uid) return authError(401, 'bad_jwt', 'invalid JWT');
      if (req.method === 'PUT') {
        const body = (await req.json().catch(() => ({}))) as { password?: string; data?: Record<string, unknown> };
        if (body.password !== undefined) {
          if (String(body.password).length < 10) return authError(422, 'weak_password', 'La contraseña debe tener al menos 10 caracteres');
          await env.pool.query(`update auth.users set encrypted_password = crypt($2, gen_salt('bf', 10)), updated_at = now() where id = $1`, [uid, String(body.password)]);
        }
        if (body.data) await env.pool.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() where id = $1`, [uid, JSON.stringify(body.data)]);
      }
      const { rows } = await env.pool.query(`select ${USER_COLS} from auth.users where id = $1`, [uid]);
      if (!rows[0] || banned(rows[0])) return authError(401, 'user_not_found', 'Usuario inexistente o desactivado');
      return json(200, userJson(rows[0]));
    }
    if (path === 'logout') {
      if (uid) await env.pool.query('update auth.refresh_tokens set revoked_at = now() - interval \'1 minute\' where user_id = $1 and revoked_at is null', [uid]);
      return new Response(null, { status: 204 });
    }
    if (path === 'recover') {
      return authError(400, 'recovery_disabled', 'La recuperación por correo no está habilitada. Solicite a la administración el restablecimiento de su contraseña.');
    }
    if (path === 'settings') return json(200, { external: { email: true }, disable_signup: true, mailer_autoconfirm: true });
    return authError(404, 'not_found', 'Ruta desconocida');
  } catch (e) {
    console.error('auth', e);
    return authError(500, 'unexpected_failure', 'Error interno del servidor');
  }
}

// ---------------------------------------------------------------------------
// /storage/v1
// ---------------------------------------------------------------------------
const SAFE_PATH = /^[A-Za-z0-9._\-/]+$/;
const blobKey = (bucket: string, name: string) => `${bucket}/${name}`;
const storageError = (status: number, message: string) => json(status, { statusCode: String(status), error: message, message });

async function serveBlob(env: GatewayEnv, bucket: string, name: string, cache: string): Promise<Response> {
  const b = await env.blobs.get(blobKey(bucket, name));
  if (!b) return storageError(404, 'Archivo no encontrado');
  return new Response(new Blob([b.data]).stream(), { status: 200, headers: { 'content-type': b.contentType, 'cache-control': cache, 'x-content-type-options': 'nosniff' } });
}

function signedPath(env: GatewayEnv, bucket: string, name: string, expiresIn: number) {
  const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(Number(expiresIn) || 3600, 60), 7 * 24 * 3600);
  const token = signJwt({ b: bucket, p: name, exp, t: 'obj' }, env.jwtSecret);
  return `/object/sign/${bucket}/${name}?token=${token}`;
}

async function storage(req: Request, env: GatewayEnv, path: string, url: URL): Promise<Response> {
  const uid = requestUser(req, env);
  const seg = path.split('/');
  try {
    if (seg[0] !== 'object') return storageError(404, 'Ruta desconocida');

    // GET /object/public/{bucket}/{path}
    if (seg[1] === 'public' && req.method === 'GET') {
      const bucket = seg[2], name = seg.slice(3).join('/');
      const { rows } = await env.pool.query('select public from storage.buckets where id = $1', [bucket]);
      if (!rows[0]?.public || !SAFE_PATH.test(name)) return storageError(404, 'Archivo no encontrado');
      return serveBlob(env, bucket, name, 'public, max-age=300');
    }

    if (seg[1] === 'sign') {
      const bucket = seg[2];
      if (req.method === 'GET') {
        const name = seg.slice(3).join('/');
        const p = verifyJwt(url.searchParams.get('token'), env.jwtSecret);
        if (!p || p.t !== 'obj' || p.b !== bucket || p.p !== name) return storageError(400, 'Enlace inválido o vencido');
        return serveBlob(env, bucket, name, 'private, max-age=3000');
      }
      if (req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as { expiresIn?: number; paths?: string[] };
        const single = seg.length > 3 ? [seg.slice(3).join('/')] : null;
        const paths = (single ?? body.paths ?? []).filter((x) => typeof x === 'string').slice(0, 500);
        const visible = await withRole(env, uid, async (c) => new Set((await c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [bucket, paths])).rows.map((r) => r.name)));
        if (single) {
          if (!visible.has(single[0])) return storageError(404, 'Archivo no encontrado o sin permiso');
          return json(200, { signedURL: signedPath(env, bucket, single[0], body.expiresIn ?? 3600) });
        }
        return json(200, paths.map((p) => visible.has(p)
          ? { path: p, signedURL: signedPath(env, bucket, p, body.expiresIn ?? 3600), error: null }
          : { path: p, signedURL: null, error: 'Archivo no encontrado o sin permiso' }));
      }
    }

    const bucket = seg[1];
    // DELETE /object/{bucket}  {prefixes: [...]}
    if (req.method === 'DELETE' && seg.length === 2) {
      const body = (await req.json().catch(() => ({}))) as { prefixes?: string[] };
      const names = (body.prefixes ?? []).filter((x) => typeof x === 'string');
      const deleted = await withRole(env, uid, async (c) => (await c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name, id', [bucket, names])).rows);
      for (const d of deleted) await env.blobs.delete(blobKey(bucket, d.name)).catch(() => undefined);
      return json(200, deleted.map((d) => ({ name: d.name, id: d.id, bucket_id: bucket })));
    }

    // POST/PUT /object/{bucket}/{path}  (subida)
    if ((req.method === 'POST' || req.method === 'PUT') && seg.length > 2) {
      if (!uid) return storageError(401, 'No autenticado');
      const name = seg.slice(2).join('/');
      if (!SAFE_PATH.test(name) || name.includes('..')) return storageError(400, 'Nombre de archivo inválido');
      let data: ArrayBuffer, type: string;
      const ct = req.headers.get('content-type') ?? '';
      if (ct.includes('multipart/form-data')) {
        const form = await req.formData();
        const file = [...form.values()].find((v) => typeof v !== 'string') as Blob | undefined;
        if (!file) return storageError(400, 'Falta el archivo');
        data = await file.arrayBuffer();
        type = file.type || 'application/octet-stream';
      } else {
        data = await req.arrayBuffer();
        type = ct || 'application/octet-stream';
      }
      const { rows: bk } = await env.pool.query('select file_size_limit, allowed_mime_types from storage.buckets where id = $1', [bucket]);
      if (!bk[0]) return storageError(404, 'Bucket inexistente');
      if (bk[0].file_size_limit && data.byteLength > Number(bk[0].file_size_limit)) return storageError(413, `El archivo supera el máximo de ${Math.round(Number(bk[0].file_size_limit) / 1048576)} MB`);
      if (bk[0].allowed_mime_types?.length && !bk[0].allowed_mime_types.includes(type)) return storageError(415, `Tipo de archivo no admitido: ${type}`);
      const upsert = req.headers.get('x-upsert') === 'true' || req.method === 'PUT';
      // Sin RETURNING: la política de lectura puede exigir que el archivo ya esté vinculado (p. ej. a una auditoría).
      const id = randomUUID();
      // ON CONFLICT exige poder leer la fila: solo se usa al reemplazar (upsert).
      try {
        await withRole(env, uid, (c) => c.query(
          `insert into storage.objects (id, bucket_id, name, mime_type, size) values ($1, $2, $3, $4, $5)${upsert
            ? ' on conflict (bucket_id, name) do update set mime_type = excluded.mime_type, size = excluded.size, updated_at = now()' : ''}`,
          [id, bucket, name, type, data.byteLength]));
      } catch (e) {
        if ((e as { code?: string }).code === '23505') return storageError(409, 'El archivo ya existe');
        throw e;
      }
      await env.blobs.set(blobKey(bucket, name), data, type);
      return json(200, { Key: `${bucket}/${name}`, Id: id, path: name, id });
    }

    return storageError(404, 'Ruta desconocida');
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === '42501') return storageError(uid ? 403 : 401, 'No tiene permisos sobre este archivo');
    console.error('storage', e);
    return storageError(500, 'Error interno del servidor');
  }
}

// ---------------------------------------------------------------------------
export async function handle(req: Request, env: GatewayEnv): Promise<Response> {
  const url = new URL(req.url);
  const m = /\/(rest|auth|storage)\/v1\/?(.*)$/.exec(url.pathname);
  if (!m) return json(404, { message: 'Ruta desconocida' });
  const path = decodeURIComponent(m[2]);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (m[1] === 'rest') return rest(req, env, path, url);
  if (m[1] === 'auth') return auth(req, env, path, url);
  return storage(req, env, path, url);
}
