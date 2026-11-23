// Puesta en marcha completa del campus con usuarios:
//   1. Busca o crea el proyecto de Supabase "campus-el-condor" (región São Paulo).
//   2. Aplica supabase/schema.sql (idempotente).
//   3. Crea el usuario "admin" con una contraseña temporal (solo si no existe) y la muestra una vez.
//   4. Obtiene la URL y la clave pública (anon), compila el sitio y lo publica en Cloudflare Pages.
//
// Requisitos: acceso a la API de Supabase (token personal sbp_…) y a la de Cloudflare (token con Pages: Edit),
// ya sea por variables SUPABASE_ACCESS_TOKEN / CLOUDFLARE_API_TOKEN o inyectados por el entorno.
// Uso: node scripts/publicar-con-usuarios.mjs [--solo-supabase] [--sin-publicar]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const PROJECT = 'campus-el-condor';
const REGION = 'sa-east-1';
const args = new Set(process.argv.slice(2));
const sbHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || 'inyectado-por-el-entorno'}` };

async function sb(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers || {}) } });
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new Error(`Supabase ${init.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (ref, query) => sb(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query }) });

function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join('');
}

async function main() {
  // 1. Proyecto
  const projects = await sb('/projects');
  let project = projects.find((p) => p.name === PROJECT);
  if (!project) {
    const orgs = await sb('/organizations');
    if (!orgs.length) throw new Error('La cuenta de Supabase no tiene organizaciones. Creá una en supabase.com.');
    console.log(`Creando el proyecto ${PROJECT} en ${REGION} (organización ${orgs[0].name})…`);
    project = await sb('/projects', { method: 'POST', body: JSON.stringify({ name: PROJECT, organization_id: orgs[0].id, region: REGION, db_pass: randomBytes(24).toString('base64url') }) });
  }
  const ref = project.id || project.ref;
  for (let i = 0; i < 60; i++) {
    const p = await sb(`/projects/${ref}`);
    if (p.status === 'ACTIVE_HEALTHY') break;
    if (i === 0) console.log('Esperando que el proyecto esté listo…');
    await sleep(10000);
  }
  console.log(`Proyecto listo: ${ref}`);

  // 2. Esquema
  await sql(ref, readFileSync(join(root, 'supabase/schema.sql'), 'utf8'));
  console.log('Esquema aplicado.');

  // 3. Administrador
  const existing = await sql(ref, "select count(*)::int as n from public.campus_users where username = 'admin'");
  if (!existing?.[0]?.n) {
    const pass = tempPassword();
    await sql(ref, `insert into public.campus_users(username, password_hash, display_name, role, must_change_password)
      values ('admin', extensions.crypt('${pass}', extensions.gen_salt('bf', 10)), 'Administración', 'admin', true)`);
    console.log('\n==============================================');
    console.log(' Usuario administrador creado');
    console.log('   Usuario: admin');
    console.log(`   Contraseña temporal: ${pass}`);
    console.log(' Se pide cambiarla en el primer ingreso. No se vuelve a mostrar.');
    console.log('==============================================\n');
  } else {
    console.log('El usuario admin ya existía: no se modificó su contraseña.');
  }

  // 4. Claves públicas y compilación
  const keys = await sb(`/projects/${ref}/api-keys`);
  const anon = (keys.find((k) => k.name === 'anon') || {}).api_key;
  if (!anon) throw new Error('No se encontró la clave anon del proyecto.');
  const url = `https://${ref}.supabase.co`;
  writeFileSync(join(root, '.env.production.local'), `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anon}\n`);
  console.log(`Configuración escrita en .env.production.local (${url}).`);
  if (args.has('--solo-supabase')) return;

  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (args.has('--sin-publicar')) return;

  const env = { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || 'inyectado-por-el-entorno-0000000000000000' };
  try {
    execFileSync('npx', ['-y', 'wrangler@4', 'pages', 'project', 'create', PROJECT, '--production-branch', 'main'], { cwd: root, stdio: 'inherit', env });
  } catch { console.log('El proyecto de Pages ya existía (o no se pudo crear); se intenta publicar igual.'); }
  execFileSync('npx', ['-y', 'wrangler@4', 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'], { cwd: root, stdio: 'inherit', env });
  console.log(`\nListo. Dirección habitual: https://${PROJECT}.pages.dev (Cloudflare muestra la definitiva arriba).`);
}

main().catch((e) => { console.error(`\nNo se completó la puesta en marcha:\n${e.message}`); process.exit(1); });
