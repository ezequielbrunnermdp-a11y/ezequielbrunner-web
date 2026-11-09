import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token QR firmado con HMAC-SHA256.
 * Formato: v1.<branchId>.<terminalId>.<issuedAtSec>.<expSec>.<jti>.<firma base64url>
 * La firma usa un secreto del servidor que nunca llega al cliente.
 */
function secret(): string {
  const s = process.env.QR_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("QR_SIGNING_SECRET ausente o demasiado corto (mínimo 32 caracteres)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function ttlSeconds(): number {
  return Math.min(300, Math.max(15, Number(process.env.QR_TTL_SECONDS ?? 45)));
}

export function issueQrToken(branchId: string, terminalId: string, now = Date.now()): { token: string; expiresAt: number } {
  const iat = Math.floor(now / 1000);
  const exp = iat + ttlSeconds();
  const jti = randomBytes(12).toString("base64url");
  const payload = ["v1", branchId, terminalId, iat, exp, jti].join(".");
  return { token: `${payload}.${sign(payload)}`, expiresAt: exp * 1000 };
}

export type QrCheck =
  | { ok: true; branchId: string; terminalId: string; jti: string; exp: number }
  | { ok: false; reason: "qr_malformed" | "qr_bad_signature" | "qr_expired" | "qr_future" };

export function verifyQrToken(token: string, now = Date.now()): QrCheck {
  if (typeof token !== "string" || token.length > 300) return { ok: false, reason: "qr_malformed" };
  // Aceptar también la URL completa codificada en el QR (…/fichar?qr=TOKEN)
  const m = token.match(/[?&]qr=([^&]+)/);
  if (m) token = decodeURIComponent(m[1]);
  const parts = token.split(".");
  if (parts.length !== 7 || parts[0] !== "v1") return { ok: false, reason: "qr_malformed" };
  const [, branchId, terminalId, iatS, expS, jti, sig] = parts;
  const payload = parts.slice(0, 6).join(".");
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { ok: false, reason: "qr_bad_signature" };
  const iat = Number(iatS), exp = Number(expS);
  const nowS = now / 1000;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return { ok: false, reason: "qr_malformed" };
  if (iat > nowS + 5) return { ok: false, reason: "qr_future" };
  if (exp < nowS) return { ok: false, reason: "qr_expired" };
  return { ok: true, branchId, terminalId, jti, exp };
}
