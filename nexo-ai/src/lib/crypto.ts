import crypto from "node:crypto";

const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n) });
  return crypto.timingSafeEqual(key, expected);
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function sha256(input: string | Uint8Array): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

let warned = false;
function encryptionKey(): Buffer {
  const raw = process.env.NEXO_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("NEXO_ENCRYPTION_KEY debe ser de 32 bytes en base64");
    return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Falta NEXO_ENCRYPTION_KEY");
  if (!warned) {
    warned = true;
    console.warn("[nexo] NEXO_ENCRYPTION_KEY no definida: usando clave de desarrollo. No usar en producción.");
  }
  return crypto.createHash("sha256").update("nexo-dev-only-key").digest();
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1") throw new Error("Formato de cifrado desconocido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
