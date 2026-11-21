// Servidor local de la API (mismo código que las Netlify Functions) para desarrollo y pruebas.
//   DATABASE_URL=postgres://... AUTH_JWT_SECRET=... npx vite-node scripts/servidor-local.ts
// Expone http://localhost:8787/rest/v1, /auth/v1, /storage/v1 y /api/admin-users.
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { handle, type BlobStore, type GatewayEnv } from '../netlify/lib/gateway';
import { adminUsers } from '../netlify/lib/admin-users';

const PORT = Number(process.env.PORT ?? 8787);
const DIR = process.env.BLOBS_DIR ?? '/tmp/condor-blobs';
const blobs: BlobStore = {
  async get(key) {
    try {
      const data = await readFile(join(DIR, key));
      const contentType = await readFile(join(DIR, key + '.type'), 'utf8').catch(() => 'application/octet-stream');
      return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, contentType };
    } catch { return null; }
  },
  async set(key, data, type) {
    await mkdir(dirname(join(DIR, key)), { recursive: true });
    await writeFile(join(DIR, key), Buffer.from(data));
    await writeFile(join(DIR, key + '.type'), type);
  },
  async delete(key) { await rm(join(DIR, key), { force: true }); await rm(join(DIR, key + '.type'), { force: true }); },
};
const env: GatewayEnv = {
  pool: new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 }),
  jwtSecret: process.env.AUTH_JWT_SECRET ?? 'desarrollo-local-secreto-de-al-menos-32-caracteres',
  blobs,
  initialAdmin: process.env.INITIAL_ADMIN ?? null,
};

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
  const response = req.method === 'OPTIONS' ? new Response(null, { status: 204 })
    : req.url?.startsWith('/api/admin-users') ? await adminUsers(request, env) : await handle(request, env);
  const out: Record<string, string> = {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-headers': 'authorization, apikey, content-type, prefer, accept, x-client-info, x-upsert, accept-profile, content-profile, x-supabase-api-version',
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS',
    'access-control-expose-headers': 'content-range',
  };
  response.headers.forEach((v, k) => { out[k] = v; });
  if (response.status >= 400 && process.env.LOG_ERRORS) console.log(response.status, req.method, req.url, await response.clone().text());
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`API local en http://localhost:${PORT}`));
