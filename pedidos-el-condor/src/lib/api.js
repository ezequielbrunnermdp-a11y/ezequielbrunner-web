import { supabase } from './supabase.js';

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// Llama a una Netlify Function y devuelve el JSON (o lanza Error con el mensaje en español)
export async function api(nombre, body) {
  let r;
  try {
    r = await fetch(`/.netlify/functions/${nombre}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('No hay conexión. Revisá internet y probá de nuevo.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Ocurrió un error. Probá de nuevo.');
  return j;
}

// Abre un PDF generado por una función (la ventana se abre antes para que el celular no la bloquee)
export async function abrirPdf(ruta) {
  const w = window.open('', '_blank');
  try {
    const r = await fetch(`/.netlify/functions/${ruta}`, { headers: { authorization: `Bearer ${await token()}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo generar el PDF.');
    const url = URL.createObjectURL(await r.blob());
    if (w) w.location.href = url; else window.location.href = url;
  } catch (e) {
    if (w) w.close();
    alert(e.message);
  }
}
