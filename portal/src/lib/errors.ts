// Traduce errores técnicos a mensajes claros, sin exponer detalles internos.
export function errorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number } | null;
  if (!err) return 'Ocurrió un error inesperado.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  const msg = err.message || '';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'No pudimos comunicarnos con el servidor. Intentá de nuevo.';
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Tenés que activar tu cuenta desde el correo de invitación.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Esperá unos minutos.';
  if (/Password should be/i.test(msg)) return 'La contraseña no cumple los requisitos mínimos.';
  if (/JWT expired/i.test(msg)) return 'Tu sesión venció. Volvé a ingresar.';
  switch (err.code) {
    case '42501': return msg && !/permission denied|row-level security/i.test(msg) ? msg : 'No tenés permiso para realizar esta acción.';
    case '23505': return msg.includes('duplicate key') ? 'Ese registro ya existe.' : msg;
    case '23P01': return msg.includes('conflicting key') ? 'Se superpone con otro turno de la misma persona.' : msg;
    case '23514': case '22023': case '54000': case 'P0001': return msg.includes('violates check constraint') ? 'Algún dato no es válido.' : msg;
    case '28000': return 'Tenés que iniciar sesión.';
  }
  return msg && msg.length < 200 && !/relation|column|syntax|function .* does not exist/i.test(msg) ? msg : 'Ocurrió un error. Intentá de nuevo.';
}
