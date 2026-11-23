# Instalación y despliegue

Necesitás: una cuenta de **Supabase** (plan Pro recomendado para producción: backups diarios y PITR), una cuenta de
**Netlify** con acceso a este repositorio, y Node.js 22.

## 1. Proyecto de Supabase

1. Crear un proyecto nuevo (región sugerida: São Paulo `sa-east-1`, la más cercana a Argentina).
2. Guardar: **Project URL**, **anon key** (pública) y **service_role key** (secreta: nunca va al frontend ni al repo).

### 1.1 Aplicar migraciones

Opción A — Supabase CLI (recomendada):

```bash
cd portal
npx supabase login
npx supabase link --project-ref <REF_DEL_PROYECTO>
npx supabase db push            # aplica supabase/migrations en orden
psql "<CADENA_DE_CONEXION>" -f supabase/seed.sql   # marcas y sucursales iniciales
```

Opción B — Editor SQL del panel: ejecutar uno por uno, **en orden**, los archivos de `supabase/migrations/`
y luego `supabase/seed.sql`.

> Las migraciones crean los buckets privados (`media`, `chat`, `documents`, `branding`) y sus políticas.
> Verificá en *Storage* que los cuatro figuren como **privados**.

### 1.2 Autenticación (Authentication → Settings)

- **Allow new users to sign up: DESACTIVADO** (solo invitaciones).
- Site URL: `https://<tu-dominio-del-portal>`; Redirect URLs: `https://<dominio>/activar`, `https://<dominio>/nueva-clave`.
- Longitud mínima de contraseña: 10, con letras y números. Activar protección de contraseñas filtradas si el plan lo permite.
- **MFA → TOTP: habilitado** (necesario para roles administrativos).
- SMTP propio (Authentication → SMTP): el SMTP de prueba de Supabase tiene límites muy bajos. Configurar un proveedor (p. ej. el dominio de la empresa).
- Plantillas de correo (en español), por ejemplo *Invite user*:
  > Asunto: Tu acceso al portal del equipo
  > Hola {{ .Data.first_name }}: tu empresa te invitó al portal. Creá tu contraseña acá: {{ .ConfirmationURL }}
  > Si no esperabas este correo, ignoralo.
- *Reset password*: "Para crear una nueva contraseña ingresá a {{ .ConfirmationURL }}".

### 1.3 Edge Function de invitaciones

```bash
npx supabase functions deploy invite-employee
npx supabase secrets set SITE_URL=https://<dominio-del-portal> ALLOWED_ORIGINS=https://<dominio-del-portal>
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las provee Supabase automáticamente a la función.)

### 1.4 Realtime

Las migraciones agregan las tablas necesarias a la publicación `supabase_realtime`
(`messages`, `notifications`, `conversation_participants`, `mgmt_ticket_messages`, `shifts`, `attendance_punches`,
`attendance_sessions`). Realtime respeta RLS.

### 1.5 Primer administrador

1. *Authentication → Users → Invite user*: invitar el correo de la persona administradora (o *Add user* con contraseña temporal).
2. En el editor SQL (rol `postgres`):
   ```sql
   select public.bootstrap_first_admin('admin@empresa.com', 'Nombre', 'Apellido', 'grupo-gastronomico', 'Güemes', 'ADM-001');
   ```
3. Al ingresar, la app le pedirá configurar la verificación en dos pasos (MFA). Desde ahí puede invitar personal,
   asignar roles y configurar sucursales.

### 1.6 Datos iniciales a revisar (obligatorio)

`seed.sql` carga las marcas y sucursales indicadas con estado **"A verificar"**, **sin coordenadas** y con dos
razones sociales **marcadoras** ("Razón social a confirmar · …"). Antes de operar:

- Gerencia → Configuración → *Marcas y razones sociales*: cargar las razones sociales reales (y CUIT), marcar verificadas, subir logos.
- Gerencia → Sucursales: confirmar nombre, dirección, razón social, **coordenadas** (botón "Usar mi ubicación actual" estando en el local, y verificar en el mapa), radio y precisión; luego pasar a "Activa".
- Desactivar o eliminar las sucursales que no correspondan.

## 2. Sitio de Netlify (independiente del sitio principal)

1. *Add new site → Import from Git* → este repositorio.
2. **Base directory: `portal`** · Build command: `npm ci && npm run build` · Publish directory: `portal/dist` (Netlify lo toma de `portal/netlify.toml`).
3. Variables de entorno (*Site configuration → Environment variables*):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `VITE_VAPID_PUBLIC_KEY` = (opcional, ver `NOTIFICACIONES.md`)
4. Dominio personalizado (p. ej. `equipo.<dominio>`), HTTPS automático. Actualizar Site URL/Redirects de Supabase y `ALLOWED_ORIGINS`.
5. Si la CSP bloquea algo por usar un dominio propio de Supabase (custom domain), agregarlo a `connect-src`/`img-src` en `portal/netlify.toml`.

> El sitio principal (`netlify.toml` de la raíz) ignora los cambios de `portal/` y además devuelve 404 para `/portal/*`.

## 3. Tablets y pantallas de QR

1. Gerencia → Sucursales → (sucursal) → *Dispositivos* → "Vincular nuevo" (modo Tablet, Pantalla de QR o ambos).
2. En la tablet abrir `https://<dominio>/kiosco/vincular` e ingresar el código (válido 15 min, un uso).
3. Recomendado: fijar la app en modo kiosco del sistema (Android: *Fijar pantalla* / Guided Access en iPad), brillo alto, sin bloqueo de pantalla, cargador permanente.
4. Revocar desde el mismo panel si el dispositivo se pierde o reemplaza.

## 4. Desarrollo local

```bash
cd portal && npm install && cp .env.example .env.local && npm run dev
```
Con Supabase CLI y Docker: `npx supabase start` levanta todo localmente (`db reset` aplica migraciones y `seed.sql`).

## 5. Copias de seguridad y recuperación

- Plan Pro: backups diarios automáticos; activar **PITR** para recuperar a un punto en el tiempo.
- Exportación adicional periódica: `pg_dump` con la cadena de conexión (guardar cifrado, fuera del proveedor).
- Storage no está incluido en los backups de base de datos: programar una copia de los buckets (script con la API de Storage).
- Probar la restauración al menos una vez por trimestre en un proyecto separado.
- Procedimiento ante incidentes: ver `PRIVACIDAD-Y-LEGAL.md`.
