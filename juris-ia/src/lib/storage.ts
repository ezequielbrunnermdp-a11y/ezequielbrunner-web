import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";
import { decrypt, encrypt, sha256 } from "./crypto";

/**
 * Almacenamiento privado: los archivos originales se guardan cifrados (AES-256-GCM) fuera
 * del directorio público. Nunca se modifican; la integridad se verifica con SHA-256 al leer.
 */
export async function storeOriginal(buf: Buffer): Promise<{ key: string; sha256: string }> {
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.bin`;
  const full = path.join(env.storageDir, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, encrypt(buf, env.encryptionKey), { flag: "wx", mode: 0o600 });
  return { key, sha256: sha256(buf) };
}

export async function readOriginal(key: string, expectedSha256: string): Promise<Buffer> {
  if (key.includes("..")) throw new Error("Clave de almacenamiento inválida");
  const blob = await fs.readFile(path.join(env.storageDir, key));
  const plain = decrypt(blob, env.encryptionKey);
  if (sha256(plain) !== expectedSha256) {
    throw new Error("INTEGRIDAD: el archivo almacenado no coincide con el hash original");
  }
  return plain;
}
