# Despliegue

La app necesita un servidor Node.js (no es un sitio estático) y una base PostgreSQL. HTTPS es obligatorio: los navegadores sólo permiten ubicación y cámara en sitios seguros.

## Opción recomendada: Vercel + Supabase

1. **Supabase**: crear proyecto → *Project Settings → Database* → copiar la cadena de conexión (Session pooler). Ejecutar las migraciones desde tu computadora:
   ```bash
   DATABASE_URL="postgresql://...supabase.com:5432/postgres" DATABASE_SSL=true npm run db:migrate
   DATABASE_URL=... DATABASE_SSL=true npm run db:seed
   DATABASE_URL=... DATABASE_SSL=true npm run admin:create -- admin@tuempresa.com "Nombre" 'ClaveSegura123'
   ```
2. **Vercel**: importar el repositorio, *Root Directory* = `asistencia`. Variables de entorno: `DATABASE_URL`, `DATABASE_SSL=true`, `APP_URL=https://tu-dominio`, `QR_SIGNING_SECRET` y `CRON_SECRET` (generar con `openssl rand -base64 48`), `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`.
3. **Tareas programadas**: agregar `asistencia/vercel.json` con un cron cada minuto o cada 5 minutos hacia `/api/cron` (Vercel envía `Authorization: Bearer $CRON_SECRET`). Alternativa: cualquier cron externo con `curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron`.
4. Dominio propio con HTTPS (lo gestiona Vercel).

## Opción servidor propio (VPS)

```bash
npm ci && npm run build
npm run db:migrate
# Servicios (systemd o pm2):
npm start          # web en :3000 detrás de Nginx/Caddy con HTTPS
npm run worker     # tareas programadas
# Backup diario (crontab):
0 4 * * * cd /ruta/asistencia && DATABASE_URL=... ./scripts/backup.sh /backups
```
Configurar el proxy para enviar `X-Forwarded-For` y `Host` correctos.

## Instalar en los teléfonos

- **iPhone (Safari)**: abrir la URL → Compartir → *Agregar a pantalla de inicio*.
- **Android (Chrome)**: abrir la URL → menú ⋮ → *Instalar aplicación*.
Al primer uso, aceptar los permisos de **ubicación** y **cámara**.

## Terminal del local

Tablet o PC con navegador, en pantalla completa en `https://tu-dominio/terminal`, vinculada con el código del panel (*Terminales*). Mantenerla conectada a internet y con la pantalla siempre encendida.

## Lista de verificación antes de producir

- [ ] Coordenadas reales y radio de cada sucursal verificados en el lugar (probar fichar en la puerta y a 2 cuadras).
- [ ] Una terminal vinculada por sucursal.
- [ ] Secretos generados y distintos de los de ejemplo.
- [ ] Cron/worker funcionando (aparece el “Reporte diario generado” en Alertas).
- [ ] Proveedor de correo configurado y probado.
- [ ] Backups programados y una restauración de prueba realizada.
- [ ] Prueba en iPhone y Android reales (ver *Pendiente* abajo).
- [ ] No cargar datos demo en la base de producción.

## Pendiente de verificación en campo

Las pruebas automáticas usan Chromium con GPS y cámara simulados. Antes del uso real hay que probar en teléfonos iPhone y Android físicos dentro de cada local: precisión GPS real en interiores (ajustar *precisión máxima* y *radio*), lectura del QR con distintas cámaras y la instalación como app.
