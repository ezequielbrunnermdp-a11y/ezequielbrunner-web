import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 64;

/** Hash con scrypt (memory-hard, nativo de Node). Formato: scrypt$N$r$p$salt$hash */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Igualar tiempos aunque no exista el usuario.
    await scrypt(secret, randomBytes(16), LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
    return false;
  }
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(secret, Buffer.from(saltB64, "base64"), expected.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "La contraseña debe combinar letras y números.";
  return null;
}
