# Usuarios, administrador y publicación

Estado al 23/11/2026: el sistema de usuarios está **construido y verificado** contra una base PostgreSQL local
(22 comprobaciones en navegador). **Todavía no está publicado**: las conexiones con Supabase y Cloudflare de la
sesión de desarrollo fueron rechazadas por esos servicios, así que no existe aún la base en la nube ni la URL pública.

## Cómo funciona

- **Ingreso obligatorio:** con el servidor configurado, el campus muestra primero la pantalla de ingreso.
- **Usuario administrador** (`admin`): crea usuarios, edita nombre, sector y rol, desactiva, restablece contraseñas,
  elimina y ve el avance de cada persona. También es el único que ve “Gestionar contenido”.
- **Usuarios del equipo:** ingresan con su usuario y su progreso se guarda en el servidor; ven el mismo avance desde cualquier dispositivo.
- **Contraseñas temporales:** al crear o restablecer un usuario se genera una contraseña temporal que el administrador entrega;
  en el primer ingreso la persona elige una propia (mínimo 8 caracteres). Cambiar la contraseña cierra las otras sesiones.
- **Seguridad:** contraseñas con bcrypt; sesiones de 30 días con token aleatorio guardado en forma de hash; bloqueo de 15 minutos
  tras 8 intentos fallidos; las tablas no son accesibles desde el navegador y todos los permisos se verifican en el servidor
  (`supabase/schema.sql`). La clave pública de Supabase es visible en el navegador por diseño.
- **Sin servidor configurado** (variables vacías) el campus sigue funcionando en modo local con perfiles, como antes.

## Puesta en marcha automática (recomendada)

Requiere que la sesión tenga acceso válido a las API de Supabase y Cloudflare.

```bash
cd campus-el-condor
npm ci
node scripts/publicar-con-usuarios.mjs
```

El script crea (o reutiliza) el proyecto de Supabase `campus-el-condor` en São Paulo, aplica el esquema, crea el usuario `admin`
con una contraseña temporal que muestra **una sola vez**, compila con la URL y la clave pública, y publica en Cloudflare Pages.

## Puesta en marcha manual

1. Creá un proyecto en supabase.com (región São Paulo, plan gratuito).
2. En **SQL Editor**, pegá y ejecutá `supabase/schema.sql`.
3. Creá el administrador (reemplazá la contraseña temporal; se pedirá cambiarla en el primer ingreso):
   ```sql
   insert into public.campus_users(username, password_hash, display_name, role, must_change_password)
   values ('admin', extensions.crypt('CONTRASEÑA-TEMPORAL', extensions.gen_salt('bf', 10)), 'Administración', 'admin', true);
   ```
4. En **Project Settings → API**, copiá la *Project URL* y la clave *anon public*.
5. Creá `campus-el-condor/.env.production.local` con:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. `npm run build` y subí `dist/` (o `npm run package` y el ZIP) a Cloudflare Pages, como indica `publicacion-cloudflare.md`.

## Verificación

- `node tests/e2e/verify.cjs` — modo local (53 comprobaciones).
- `node tests/e2e/auth.cjs <url> <contraseña-temporal-admin>` — flujo con usuarios: ingreso, cambio obligatorio de contraseña,
  creación de usuario, permisos, sincronización entre dispositivos, desactivación, restablecimiento y cierre de sesión.
  Usalo contra una base de prueba: crea el usuario `maria.gomez`.

## Límites

- “Gestionar contenido” (productos, promociones, archivos) sigue guardando sus cambios en el navegador donde se hacen.
  Para compartir esos cambios con todo el equipo hay que incorporarlos al código y publicar una nueva versión.
- El avance que ve el administrador es pedagógico: no es una calificación laboral.
- Si se olvida la contraseña del único administrador, se restablece desde el SQL Editor de Supabase.
