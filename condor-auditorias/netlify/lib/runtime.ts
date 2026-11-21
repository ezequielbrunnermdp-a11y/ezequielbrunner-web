// Recursos compartidos de las funciones en Netlify: base de datos y almacenamiento de archivos.
import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import pg from 'pg';
import type { BlobStore, GatewayEnv } from './gateway';

let pool: pg.Pool | null = null;
let secret: string | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const local = Netlify.env.get('DATABASE_URL');
  pool = local ? new pg.Pool({ connectionString: local, max: 4 }) : (getDatabase().pool as unknown as pg.Pool);
  return pool;
}

function blobStore(): BlobStore {
  const store = getStore({ name: 'condor-archivos', consistency: 'strong' });
  return {
    async get(key) {
      const r = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!r) return null;
      return { data: r.data as ArrayBuffer, contentType: String(r.metadata?.contentType ?? 'application/octet-stream') };
    },
    async set(key, data, contentType) {
      await store.set(key, data, { metadata: { contentType } });
    },
    async delete(key) {
      await store.delete(key);
    },
  };
}

/** Clave de firma: variable AUTH_JWT_SECRET si existe; si no, la generada en la base al instalar. */
async function jwtSecret(p: pg.Pool): Promise<string> {
  if (secret) return secret;
  const fromEnv = Netlify.env.get('AUTH_JWT_SECRET');
  if (fromEnv && fromEnv.length >= 32) return (secret = fromEnv);
  const { rows } = await p.query('select jwt_secret from auth.secrets where id = 1');
  if (!rows[0]?.jwt_secret) throw new Error('Falta la clave de firma de sesiones (auth.secrets)');
  return (secret = rows[0].jwt_secret as string);
}

export async function gatewayEnv(): Promise<GatewayEnv> {
  const p = getPool();
  return { pool: p, jwtSecret: await jwtSecret(p), blobs: blobStore(), initialAdmin: Netlify.env.get('INITIAL_ADMIN') ?? null };
}
