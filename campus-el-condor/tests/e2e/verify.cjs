/* Verificación de punta a punta sobre la build (npm run build && npm run preview).
   Uso: node tests/e2e/verify.cjs [url]   — requiere Playwright con Chromium disponible. */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:4173/';
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const go = async (hash) => { await page.goto(BASE + hash); await page.waitForTimeout(250); };
  const text = () => page.locator('main').innerText();
  const seen = (loc) => loc.first().waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);

  // Inicio
  await go('#/');
  ok(await page.getByRole('link', { name: 'Empezar mi recorrido' }).isVisible(), 'Inicio sin progreso muestra “Empezar mi recorrido”');

  // Lectura de una lección y persistencia
  await go('#/aprender/m1');
  await page.locator('#m1-l1').getByRole('button', { name: 'Marcar como leída' }).click();
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.locator('#m1-l1').getByText('Leída', { exact: true }).isVisible(), 'La lectura persiste tras recargar');
  await go('#/');
  ok(await page.getByRole('link', { name: 'Continuar donde quedé' }).isVisible(), 'Inicio con progreso muestra “Continuar donde quedé”');

  // Secuencia ordenada: evaluación completa, botones y teclado
  await go('#/aprender/m2?l=m2-x1');
  const ex = page.locator('#m2-x1');
  await ex.getByRole('button', { name: 'Comprobar secuencia' }).click();
  ok(await ex.getByText(/pasos están en su lugar/).isVisible(), 'Secuencia incorrecta se informa como incompleta');
  const target = ['Recibir y orientar', 'Escuchar y recomendar', 'Confirmar y entregar con cuidado', 'Acompañar sin interrumpir', 'Cerrar y dejar preparado'];
  // ordenar con botones
  for (let pos = 0; pos < target.length; pos++) {
    for (let guard = 0; guard < 6; guard++) {
      const items = await ex.locator('.order-item .txt').allInnerTexts();
      const idx = items.indexOf(target[pos]);
      if (idx === pos) break;
      await ex.getByRole('button', { name: `Subir ${target[pos]}` }).click();
    }
  }
  await page.reload(); await page.waitForTimeout(300);
  const persisted = await page.locator('#m2-x1 .order-item .txt').allInnerTexts();
  ok(JSON.stringify(persisted) === JSON.stringify(target), 'El orden elegido se conserva al recargar');
  // teclado: tomar el último y subirlo, luego volver
  const last = page.locator('#m2-x1 .order-item').last();
  await last.focus();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
  const afterKey = await page.locator('#m2-x1 .order-item .txt').allInnerTexts();
  ok(afterKey[3] === 'Cerrar y dejar preparado', 'Se puede reordenar con teclado');
  await page.locator('#m2-x1 .order-item').nth(3).focus();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space');
  await page.locator('#m2-x1').getByRole('button', { name: 'Comprobar secuencia' }).click();
  ok(await page.locator('#m2-x1').getByText('Secuencia correcta', { exact: true }).isVisible(), 'Secuencia completa correcta se aprueba');

  // Caso con decisiones y reintento
  await go('#/casos/c3');
  await page.getByRole('button', { name: /sale en cinco minutos/ }).click();
  ok(await page.getByText('Genera un problema').first().isVisible(), 'Caso: decisión incorrecta muestra consecuencia');
  await page.getByRole('button', { name: 'Probar otra opción' }).click();
  await page.getByRole('button', { name: /Consultás en cocina/ }).click();
  await page.getByRole('button', { name: 'Ver cierre del caso' }).click();
  ok(await page.getByText('Qué falta consultar en El Cóndor').isVisible(), 'Caso: cierre con explicación e información pendiente');

  // Evaluación: intento conservado al recargar, explicación, resultado y reintento
  await go('#/evaluacion/m1');
  await page.getByRole('button', { name: /Comenzar|Nuevo intento/ }).click();
  const firstOpt = page.locator('.exercise .option').first();
  await firstOpt.click();
  ok(await page.locator('.feedback').isVisible(), 'Se muestra la explicación después de responder');
  const prompt1 = await page.locator('.exercise h2').innerText();
  const opts1 = await page.locator('.exercise .option').allInnerTexts();
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.getByText('1 de 3 respondidas').isVisible(), 'El intento en curso se conserva al recargar');
  await page.getByRole('button', { name: 'Anterior' }).click().catch(() => {});
  const prompt1b = await page.locator('.exercise h2').innerText();
  const opts1b = await page.locator('.exercise .option').allInnerTexts();
  ok(prompt1 === prompt1b && opts1.map((t) => t.split('\n')[1]).join() === opts1b.map((t) => t.split('\n')[1]).join(), 'El orden de opciones no cambia durante el intento');
  for (let i = 0; i < 3; i++) {
    const h = await page.locator('.exercise h2').innerText();
    if (!(await page.locator('.feedback').isVisible())) await page.locator('.exercise .option').first().click();
    const next = page.getByRole('button', { name: 'Siguiente', exact: true });
    if (await next.isEnabled().catch(() => false)) await next.click(); else break;
    void h;
  }
  await page.getByRole('button', { name: 'Ver resultado' }).click();
  await page.waitForTimeout(300);
  ok(await page.getByText(/de 3 respuestas correctas/).isVisible(), 'Resultado del cuestionario');
  ok(await page.getByRole('link', { name: 'Reintentar' }).isVisible(), 'Se ofrece reintentar');

  // Integrador
  await go('#/evaluacion/final');
  await page.getByRole('button', { name: /Comenzar|Nuevo intento/ }).click();
  let mods = new Set();
  for (let i = 0; i < 15; i++) {
    const eb = await page.locator('.exercise .eyebrow').textContent();
    mods.add(eb.match(/Módulo (\d+)/)[1]);
    await page.locator('.exercise .option').first().click();
    if (i < 14) await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  }
  ok(mods.size === 10, 'El integrador incluye preguntas de los 10 módulos');
  await page.getByRole('button', { name: 'Ver resultado' }).click();
  ok(await seen(page.getByText(/de 15 respuestas correctas/)), 'Integrador completo con 15 preguntas');

  // Búsqueda sin tildes
  await go('#/consultar?q=alergenos');
  ok(await page.locator('.result h3', { hasText: 'Alergias y restricciones' }).first().isVisible(), 'La búsqueda sin tildes encuentra la lección de alérgenos');
  await page.locator('.result', { hasText: 'Alergias y restricciones' }).first().click();
  await page.waitForTimeout(400);
  ok(page.url().includes('l=m4-l2'), 'El resultado lleva a la sección exacta');

  // Catálogo y promociones vacíos, sin precios inventados
  await go('#/consultar/productos');
  const prodText = await text();
  ok(prodText.includes('Todavía no hay carta oficial cargada'), 'Catálogo vacío con estado diseñado');
  ok(!/\$\s?0/.test(prodText) && prodText.includes('Precio sin informar'), 'Productos de práctica sin precios (null no se muestra como $ 0)');
  await go('#/consultar/promociones');
  ok((await text()).includes('No hay promociones de El Cóndor confirmadas'), 'Promociones reales vacías con estado diseñado');
  await go('#/consultar/codigos');
  ok((await text()).includes('Tabla oficial de códigos vacía'), 'Códigos vacíos con importación');

  // Importación de códigos: vista previa con errores, cancelar sin cambios, importar
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'condor-'));
  const csvPath = path.join(tmp, 'codigos.csv');
  fs.writeFileSync(csvPath, 'codigo;nombre;categoria\n012;Café chico;Cafetería\n013;Café mediano;Cafetería\n014;Té;Infusiones\n015;Medialuna;Panadería\n012;Repetido;X\n');
  await page.getByRole('button', { name: 'Importar CSV o JSON' }).click();
  await page.locator('dialog input[type=file]').setInputFiles(csvPath);
  ok(await seen(page.getByText(/Fila 6: Código “012” duplicado/)), 'Errores por fila en la vista previa');
  await page.getByRole('button', { name: 'Cancelar sin cambios' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok((await text()).includes('Tabla oficial de códigos vacía'), 'Cancelar no modifica el catálogo');
  await page.getByRole('button', { name: 'Importar CSV o JSON' }).click();
  await page.locator('dialog input[type=file]').setInputFiles(csvPath);
  await page.getByRole('button', { name: /Importar 4 códigos/ }).click();
  await page.waitForTimeout(300);
  ok(await page.locator('td.code', { hasText: '012' }).isVisible(), 'Códigos importados conservando ceros iniciales');
  ok(await page.getByText('Práctica de códigos del catálogo cargado').isVisible(), 'La práctica de códigos se activa con registros válidos');

  // Recarga directa de una sección
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.locator('td.code', { hasText: '012' }).isVisible(), 'Abrir y recargar una sección directamente funciona');

  // Respaldo: exportar, rechazar inválido sin pérdida, detectar conflicto
  await go('#/progreso');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar respaldo' }).click()]);
  const backupPath = path.join(tmp, 'backup.json');
  await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  ok(backup.kind === 'el-condor-campus/progreso' && Object.keys(backup.progress.lessonsRead).length >= 1, 'Exportación de progreso con datos reales');
  const badPath = path.join(tmp, 'malo.json');
  fs.writeFileSync(badPath, '{"kind":"otra-cosa"}');
  const before = await page.locator('.stat strong').first().innerText();
  await page.locator('input[type=file]').setInputFiles(badPath);
  await page.waitForTimeout(200);
  ok(await page.getByText('No se importó el respaldo').isVisible(), 'Respaldo inválido rechazado con explicación');
  ok((await page.locator('.stat strong').first().innerText()) === before, 'El progreso no cambia ante un respaldo inválido');
  await page.locator('input[type=file]').setInputFiles(backupPath);
  ok(await seen(page.getByText('Conflicto: este perfil ya existe')), 'Se detecta conflicto antes de reemplazar');
  await page.getByRole('button', { name: 'Cancelar' }).first().click();

  // Perfiles separados
  await go('#/perfiles');
  await page.locator('#np-alias').fill('Prueba B');
  await page.getByRole('button', { name: 'Crear y usar' }).click();
  await go('#/progreso');
  ok((await page.locator('.stat strong').first().innerText()).startsWith('0/'), 'Un perfil nuevo empieza sin progreso');
  await go('#/perfiles');
  await page.getByRole('button', { name: 'Usar este perfil' }).first().click();
  await go('#/progreso');
  ok(!(await page.locator('.stat strong').first().innerText()).startsWith('0/'), 'El perfil anterior conserva su progreso');
  await go('#/perfiles');
  await page.getByRole('button', { name: 'Eliminar Prueba B' }).click();
  ok(await page.getByText('No se puede deshacer').isVisible(), 'Eliminar un perfil pide confirmación');
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();

  // Facilitador
  await go('#/facilitador');
  await page.getByRole('button', { name: 'Ver respuesta esperada' }).click();
  ok(await seen(page.getByText('Criterio para calificar', { exact: true })), 'Facilitador muestra respuesta esperada y criterio');

  // Videos pendientes sin reproductor roto
  await go('#/videos');
  ok((await page.locator('video').count()) === 0 && (await page.getByText('Video propio pendiente').count()) >= 3, 'Videos pendientes sin reproductor roto');

  // Biblioteca: sin botones de descarga inexistentes
  await go('#/consultar/biblioteca');
  ok((await page.getByRole('link', { name: 'Descargar' }).count()) === 0, 'La biblioteca no ofrece descargas de archivos inexistentes');
  await page.getByRole('button', { name: 'Ver estado' }).first().click();
  ok(await page.getByText('Material pendiente').isVisible(), 'Material faltante con estado pendiente útil');
  await page.keyboard.press('Escape');

  // Modal: foco atrapado y devuelto
  await go('#/consultar/promociones');
  const trigger = page.getByRole('button', { name: 'Ver ejemplo' });
  await trigger.click();
  ok(await page.evaluate(() => !!document.activeElement?.closest('dialog')), 'El foco entra al modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok(await page.evaluate(() => document.activeElement?.textContent?.includes('Ver ejemplo')), 'El foco vuelve al disparador al cerrar');

  // Móvil
  const m = await browser.newPage({ viewport: { width: 360, height: 760 } });
  for (const r of ['#/', '#/aprender/m3', '#/consultar/codigos', '#/progreso', '#/gestionar?t=promociones', '#/aprender/m8']) {
    await m.goto(BASE + r); await m.waitForTimeout(300);
    const wide = await m.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > window.innerWidth + 1 && !el.closest('.table-wrap, .tabs, .lesson-nav, dialog'); }).map((el) => el.className || el.tagName).slice(0, 5));
    ok(wide.length === 0, `Móvil 360 px sin desbordes horizontales en ${r}${wide.length ? ' → ' + wide.join(', ') : ''}`);
  }
  ok(await m.locator('.bottom-nav').isVisible(), 'Navegación inferior visible en móvil');
  await m.getByRole('button', { name: 'Más' }).click();
  ok(await m.getByRole('link', { name: 'Modo facilitador' }).isVisible(), 'El menú “Más” agrupa otras funciones');

  ok(errors.length === 0, `Sin errores de consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(failures ? `\n${failures} verificación(es) fallida(s)` : '\nTodas las verificaciones pasaron');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
