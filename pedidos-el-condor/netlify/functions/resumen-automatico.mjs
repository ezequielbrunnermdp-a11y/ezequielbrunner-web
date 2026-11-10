// Tarea programada: cada 10 minutos revisa si pasó la hora de corte y, si todavía no salió,
// envía el email "Pedidos del día" para la entrega del día siguiente.
import { admin } from './_lib/supa.js';
import { enviarResumen } from './_lib/dia.js';
import { ahoraAR, limitePedido, sumarDias } from '../../src/lib/formato.js';

export const config = { schedule: '*/10 * * * *' };

async function intentar(fecha) {
  // Se reserva la fecha antes de enviar para no mandarlo dos veces
  const { data, error } = await admin.from('resumenes_enviados')
    .upsert({ fecha_entrega: fecha }, { onConflict: 'fecha_entrega', ignoreDuplicates: true }).select();
  if (error) throw error;
  if (!data?.length) return 'ya enviado';
  try {
    const r = await enviarResumen(fecha);
    return `enviado (${r.pedidos} pedidos)`;
  } catch (e) {
    await admin.from('resumenes_enviados').delete().eq('fecha_entrega', fecha);
    throw e;
  }
}

export default async () => {
  const { data: cfg } = await admin.from('config').select('hora_corte').eq('id', 1).single();
  const ahora = ahoraAR();
  const actual = `${ahora.fecha} ${ahora.hora}`;
  const candidatas = [sumarDias(ahora.fecha, 1)];
  // Si la hora de corte es cerca de medianoche y la tarea corrió recién después, se envía el de hoy
  if (ahora.hora < '06:00:00') candidatas.unshift(ahora.fecha);
  for (const fecha of candidatas) {
    const lim = limitePedido(fecha, cfg?.hora_corte || '20:00:00');
    if (actual < `${lim.fecha} ${lim.hora}`) continue;
    try { console.log(fecha, await intentar(fecha)); } catch (e) { console.error('No se pudo enviar el resumen', fecha, e); }
  }
  return new Response('ok');
};
