import { randomBytes, randomInt } from "node:crypto";
import { one, q } from "./db";
import { sha256 } from "./auth";
import { hit } from "./rate-limit";

export const TERMINAL_COOKIE = "asis_terminal";

/** Genera un código de vinculación de 8 dígitos válido por 15 minutos. */
export async function createPairingCode(terminalId: string): Promise<string> {
  const code = String(randomInt(0, 100_000_000)).padStart(8, "0");
  await q(
    `update terminals set pairing_code_hash = $2, pairing_expires_at = now() + interval '15 minutes' where id = $1`,
    [terminalId, sha256(code)],
  );
  return code;
}

/** Canjea el código por un token permanente del dispositivo (se guarda sólo su hash). */
export async function pairTerminal(code: string, ip: string | null): Promise<{ token: string; terminalId: string } | null> {
  const rl = await hit(`pair:${ip ?? "?"}`, 10, 15 * 60);
  if (!rl.allowed || !/^\d{8}$/.test(code)) return null;
  const token = randomBytes(32).toString("base64url");
  const t = await one(
    `update terminals set token_hash = $2, pairing_code_hash = null, pairing_expires_at = null, last_seen_at = now()
     where pairing_code_hash = $1 and pairing_expires_at > now() and active returning id`,
    [sha256(code), sha256(token)],
  );
  return t ? { token, terminalId: t.id } : null;
}

export async function terminalFromToken(token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  return one(
    `update terminals t set last_seen_at = now() from branches b, companies c
     where t.token_hash = $1 and t.active and b.id = t.branch_id and c.id = b.company_id and b.active and c.active
     returning t.id, t.name, t.branch_id, t.allow_kiosk_punch, b.name as branch_name, b.timezone, c.name as company_name`,
    [sha256(token)],
  );
}
