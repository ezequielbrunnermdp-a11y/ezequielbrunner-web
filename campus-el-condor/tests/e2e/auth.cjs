/* Verificación del modo con usuarios contra un servidor compatible (Supabase o el simulador local).
   Uso: node tests/e2e/auth.cjs <url-del-campus> <contraseña-temporal-admin> */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4190/';
const ADMIN_PASS = process.argv[3] || 'Temporal-Admin1';
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failures++; };
const seen = (loc) => loc.first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctxA = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await ctxA.newPage();
  a.on('pageerror', (e) => errors.push(e.message));
  await a.goto(BASE); 
  ok(await seen(a.getByRole('heading', { name: 'Ingresá con tu usuario' })), 'Sin sesión se muestra la pantalla de ingreso');
  ok(!(await a.locator('.sidebar').isVisible()), 'El contenido del campus no se muestra sin ingresar');
  await a.locator('#login-user').fill('admin'); await a.locator('#login-pass').fill('incorrecta');
  await a.getByRole('button', { name: 'Ingresar' }).click();
  ok(await seen(a.getByText('Usuario o contraseña incorrectos.')), 'Contraseña incorrecta rechazada con mensaje claro');
  await a.locator('#login-pass').fill(ADMIN_PASS);
  await a.getByRole('button', { name: 'Ingresar' }).click();
  ok(await seen(a.getByRole('heading', { name: 'Elegí tu contraseña' })), 'Con contraseña temporal se exige elegir una propia');
  await a.locator('#pw-cur').fill(ADMIN_PASS); await a.locator('#pw-new').fill('Admin-Nueva-2026'); await a.locator('#pw-rep').fill('Admin-Nueva-2026');
  await a.getByRole('button', { name: 'Guardar y entrar al campus' }).click();
  ok(await seen(a.locator('.hero h1')), 'Después de cambiarla entra al campus');
  ok(await seen(a.getByRole('link', { name: 'Usuarios' })), 'El administrador ve la sección Usuarios');

  // Crear usuario
  await a.goto(BASE + '#/usuarios');
  await a.getByRole('button', { name: 'Crear usuario' }).first().click();
  await a.locator('#nu-user').fill('Maria Gomez');
  await a.locator('dialog').getByRole('button', { name: 'Crear usuario' }).click();
  ok(await seen(a.getByText(/El usuario debe tener entre 3 y 32 caracteres/)), 'Valida el formato del nombre de usuario');
  await a.locator('#nu-user').fill('maria.gomez'); await a.locator('#nu-name').fill('María Gómez');
  await a.locator('#nu-sector').selectOption('Salón');
  const tempPass = await a.locator('#nu-pass').inputValue();
  await a.locator('dialog').getByRole('button', { name: 'Crear usuario' }).click();
  ok(await seen(a.getByText('Usuario “maria.gomez” creado')), 'Usuario creado con datos de acceso para entregar');
  await a.keyboard.press('Escape');
  ok(await seen(a.getByText('María Gómez')), 'El usuario aparece en la lista');
  await a.locator('dialog').getByRole('button', { name: 'Crear usuario' }).count();

  // El empleado ingresa en otro dispositivo
  const ctxB = await b.newContext({ viewport: { width: 390, height: 844 } });
  const e = await ctxB.newPage();
  e.on('pageerror', (x) => errors.push(x.message));
  await e.goto(BASE);
  await e.locator('#login-user').fill('MARIA.GOMEZ'); await e.locator('#login-pass').fill(tempPass);
  await e.getByRole('button', { name: 'Ingresar' }).click();
  ok(await seen(e.getByRole('heading', { name: 'Elegí tu contraseña' })), 'El usuario nuevo debe cambiar la contraseña temporal');
  await e.locator('#pw-cur').fill(tempPass); await e.locator('#pw-new').fill('Maria-Clave-1'); await e.locator('#pw-rep').fill('Maria-Clave-1');
  await e.getByRole('button', { name: 'Guardar y entrar al campus' }).click();
  ok(await seen(e.locator('.hero h1')), 'El usuario nuevo entra al campus');
  await e.goto(BASE + '#/usuarios');
  ok(await seen(e.getByText('Esta sección es solo para administradores.')), 'Un usuario del equipo no puede administrar usuarios');
  await e.goto(BASE + '#/gestionar');
  ok(await seen(e.getByText('La gestión de contenido es solo para administradores.')), 'Un usuario del equipo no ve la gestión de contenido');
  await e.goto(BASE + '#/aprender/m1');
  await e.locator('#m1-l1').getByRole('button', { name: 'Marcar como leída' }).click();
  await e.locator('#m1-l2').getByRole('button', { name: 'Marcar como leída' }).click();
  await e.waitForTimeout(2500); // espera la sincronización

  // Mismo usuario en un tercer dispositivo: ve su progreso
  const ctxC = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const c = await ctxC.newPage();
  await c.goto(BASE);
  await c.locator('#login-user').fill('maria.gomez'); await c.locator('#login-pass').fill('Maria-Clave-1');
  await c.getByRole('button', { name: 'Ingresar' }).click();
  await c.waitForTimeout(800);
  await c.goto(BASE + '#/progreso');
  ok(/^2\s*\//.test(await c.locator('.stat strong').first().innerText()), 'El progreso se sincroniza entre dispositivos (2 lecciones leídas)');
  await c.reload(); await c.waitForTimeout(800);
  ok(await seen(c.locator('.stat strong')), 'La sesión se mantiene al recargar');

  // El admin ve el avance y desactiva al usuario
  await a.goto(BASE + '#/usuarios'); await a.getByRole('button', { name: 'Actualizar' }).click(); await a.waitForTimeout(800);
  ok(await seen(a.getByText(/2\/29 lecturas/)), 'El administrador ve el avance real del usuario');
  await a.getByRole('button', { name: 'Editar maria.gomez' }).click();
  await a.locator('#eu-active').selectOption('0');
  await a.getByRole('button', { name: 'Guardar cambios' }).click();
  ok(await seen(a.getByText('Desactivado')), 'Se puede desactivar un usuario');
  await c.goto(BASE + '#/aprender/m1'); await c.locator('#m1-l3').getByRole('button', { name: 'Marcar como leída' }).click();
  await c.waitForTimeout(2500);
  ok(await seen(c.getByRole('heading', { name: 'Ingresá con tu usuario' })), 'Un usuario desactivado pierde la sesión');
  await c.locator('#login-user').fill('maria.gomez'); await c.locator('#login-pass').fill('Maria-Clave-1');
  await c.getByRole('button', { name: 'Ingresar' }).click();
  ok(await seen(c.getByText('Este usuario está desactivado.')), 'Un usuario desactivado no puede ingresar');

  // Restablecer contraseña y cerrar sesión
  await a.getByRole('button', { name: 'Editar maria.gomez' }).click();
  await a.locator('#eu-active').selectOption('1');
  await a.getByRole('button', { name: 'Guardar cambios' }).click();
  await a.getByRole('button', { name: 'Editar maria.gomez' }).click();
  await a.getByRole('button', { name: 'Restablecer contraseña' }).click();
  await a.getByRole('button', { name: 'Generar contraseña temporal' }).click();
  ok(await seen(a.getByText('Contraseña restablecida')), 'El administrador puede restablecer una contraseña');
  await a.keyboard.press('Escape');
  await a.goto(BASE + '#/cuenta');
  await a.getByRole('button', { name: 'Cerrar sesión' }).click();
  ok(await seen(a.getByRole('heading', { name: 'Ingresá con tu usuario' })), 'Cerrar sesión vuelve a la pantalla de ingreso');

  ok(errors.length === 0, `Sin errores de página${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await b.close();
  console.log(failures ? `\n${failures} verificación(es) fallida(s)` : '\nTodas las verificaciones de usuarios pasaron');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
