import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";
import { decrypt, encrypt, sha256 } from "./crypto";

/**
 * Almacenamiento privado: los archivos originales se guardan cifrados (AES-256-GCM).
 * - En Netlify: Netlify Blobs (store privado "juris-documentos").
 * - En otro entorno: disco local (STORAGE_DIR), fuera del directorio público.
 * Los originales nunca se modifican; la integridad se verifica con SHA-256 al leer.
 */
interface Backend {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  del(key: string): Promise<void>;
}

const diskBackend: Backend = {
  async put(key, data) {
    const full = path.join(env.storageDir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data, { mode: 0o600 });
  },
  async get(key) {
    try {
      return await fs.readFile(path.join(env.storageDir, key));
    } catch {
      return null;
    }
  },
  async del(key) {
    await fs.rm(path.join(env.storageDir, key), { force: true });
  },
};

async function blobsBackend(): Promise<Backend> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "juris-documentos", consistency: "strong" });
  return {
    async put(key, data) {
      await store.set(key, new Uint8Array(data).buffer as ArrayBuffer);
    },
    async get(key) {
      const ab = await store.get(key, { type: "arrayBuffer" });
      return ab ? Buffer.from(ab) : null;
    },
    async del(key) {
      await store.delete(key);
    },
  };
}

let backendPromise: Promise<Backend> | null = null;
function backend(): Promise<Backend> {
  if (!backendPromise) backendPromise = env.onNetlify ? blobsBackend() : Promise.resolve(diskBackend);
  return backendPromise;
}

function checkKey(key: string) {
  if (key.includes("..") || key.startsWith("/")) throw new Error("Clave de almacenamiento inválida");
}

export async function storeOriginal(buf: Buffer): Promise<{ key: string; sha256: string }> {
  const key = `originales/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.bin`;
  await (await backend()).put(key, encrypt(buf, env.encryptionKey));
  return { key, sha256: sha256(buf) };
}

export async function readOriginal(key: string, expectedSha256: string): Promise<Buffer> {
  checkKey(key);
  const blob = await (await backend()).get(key);
  if (!blob) throw new Error("Archivo original no encontrado en el almacenamiento");
  const plain = decrypt(blob, env.encryptionKey);
  if (sha256(plain) !== expectedSha256) {
    throw new Error("INTEGRIDAD: el archivo almacenado no coincide con el hash original");
  }
  return plain;
}

/* ---- Partes temporales de cargas grandes (también cifradas) ---- */
const partKey = (uploadId: string, n: number) => `cargas/${uploadId}/${String(n).padStart(5, "0")}`;

export async function storeUploadPart(uploadId: string, n: number, data: Buffer) {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || n < 0 || n > 200) throw new Error("Parte inválida");
  await (await backend()).put(partKey(uploadId, n), encrypt(data, env.encryptionKey));
}

export async function assembleUpload(uploadId: string, parts: number): Promise<Buffer> {
  const b = await backend();
  const bufs: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    const blob = await b.get(partKey(uploadId, i));
    if (!blob) throw new Error(`Falta la parte ${i + 1} de ${parts} del archivo`);
    bufs.push(decrypt(blob, env.encryptionKey));
  }
  for (let i = 0; i < parts; i++) await b.del(partKey(uploadId, i));
  return Buffer.concat(bufs);
}
