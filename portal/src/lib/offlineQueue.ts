// Cola de fichadas declaradas SIN conexión. No son fichadas: son solicitudes
// pendientes que el servidor registrará como "pendiente de revisión", con la
// hora declarada y la hora real de recepción. Se guardan localmente solo hasta
// que se envían; la fuente de verdad es siempre la base de datos.
export interface PendingPunch {
  clientRequestId: string;
  kind: 'in' | 'out' | 'break_start' | 'break_end';
  branchId: string;
  branchName: string;
  declaredAt: string; // ISO, hora del dispositivo (no confiable; solo declarativa)
  note?: string;
}
const KEY = 'pending-punches-v1';

export function readQueue(): PendingPunch[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as PendingPunch[]; } catch { return []; }
}
function write(items: PendingPunch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* almacenamiento no disponible */ }
}
export function enqueue(p: PendingPunch) { write([...readQueue().filter((x) => x.clientRequestId !== p.clientRequestId), p]); }
export function remove(id: string) { write(readQueue().filter((x) => x.clientRequestId !== id)); }

/** Envía la cola; cada elemento es idempotente gracias a clientRequestId. */
export async function flushQueue(send: (p: PendingPunch) => Promise<void>): Promise<number> {
  let sent = 0;
  for (const p of readQueue()) {
    try { await send(p); remove(p.clientRequestId); sent++; } catch { break; }
  }
  return sent;
}
