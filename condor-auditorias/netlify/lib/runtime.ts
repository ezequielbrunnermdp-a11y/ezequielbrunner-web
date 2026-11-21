// Recursos compartidos de las funciones en Netlify: base de datos y almacenamiento de archivos.
import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import pg from 'pg';
import type { BlobStore, GatewayEnv } from './gateway';

let pool: pg.Pool | null = null;

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

export function gatewayEnv(): GatewayEnv {
  const jwtSecret = Netlify.env.get('AUTH_JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('Falta configurar AUTH_JWT_SECRET (mínimo 32 caracteres)');
  return { pool: getPool(), jwtSecret, blobs: blobStore(), initialAdmin: Netlify.env.get('INITIAL_ADMIN') ?? null };
}
