# Funcionalidades pendientes y verificaciones antes de producción

## Bloqueantes para poner en marcha (requieren datos o cuentas externas)

| # | Qué falta | Dato o acción necesaria |
|---|---|---|
| 1 | Proyecto de Supabase | Crear el proyecto y entregar *Project ref*; aplicar migraciones y `seed.sql` (ver `INSTALACION.md`). |
| 2 | Edge Function `invite-employee` desplegada | `supabase functions deploy` + secrets `SITE_URL`, `ALLOWED_ORIGINS`. |
| 3 | SMTP y plantillas de correo en español | Proveedor de correo de la empresa (remitente, dominio con SPF/DKIM). |
| 4 | Sitio de Netlify para `portal/` | Crear sitio con *Base directory* `portal`, variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, dominio. |
| 5 | Primer administrador | Correo de la persona responsable; ejecutar `bootstrap_first_admin`. |
| 6 | Datos reales de la empresa | Razones sociales y CUIT, asignación de cada sucursal, direcciones y coordenadas verificadas, sucursales activas/inactivas, logos oficiales. |
| 7 | Validación legal | Ver `PRIVACIDAD-Y-LEGAL.md` (política de privacidad, control horario, recibos, conservación). |

## Verificaciones técnicas antes de producción

- [ ] Ejecutar el plan de "Pruebas pendientes en un proyecto real" (`PRUEBAS.md`).
- [ ] Calibrar radio y precisión GPS por sucursal con varios teléfonos en interiores.
- [ ] Probar el QR con iPhone y Android, y la tablet en modo kiosco durante un cambio de turno real.
- [ ] Revisar *Advisors* de seguridad y rendimiento en el panel de Supabase (RLS, índices).
- [ ] Activar backups/PITR y probar una restauración.
- [ ] Verificar que los 4 buckets de Storage sean privados.
- [ ] Confirmar "Allow new users to sign up" desactivado y MFA TOTP habilitado.
- [ ] Revisar la CSP con el dominio final (y el dominio personalizado de Supabase, si se usa).
- [ ] Auditoría de accesibilidad con lector de pantalla (VoiceOver/TalkBack) en los flujos de fichaje y mensajes.
- [ ] Prueba de carga básica de fichajes concurrentes.

## Funcionalidades pendientes o parciales

| Área | Estado | Próximo paso |
|---|---|---|
| Push web | Suscripción lista; falta envío | Función `send-push` + VAPID (`NOTIFICACIONES.md`). |
| Firma digital / notificación fehaciente de documentos | No implementado (por diseño, se informa) | Integrar un proveedor de firma apto si se requiere. |
| Fichadas sin conexión | Cola local enviada al reconectar como "pendiente" | Sincronización en segundo plano (Background Sync) para Android. |
| Gestión de dispositivos de sesión | Cerrar sesión en otros dispositivos / en todos | Listado detallado de sesiones activas (requiere API de administración). |
| Roles personalizados | Tablas y políticas listas; la interfaz asigna roles del sistema | Editor visual de roles propios por organización. |
| Datos personales sensibles (`employee_private`) | Lectura en la ficha; carga por SQL | Formulario de edición para RR. HH. |
| Supresión de cuenta | Baja administrativa disponible | Procedimiento de supresión/anonimización según política de conservación. |
| Asignación de capacitaciones | Por sucursal o todo el personal a cargo | Selección individual y por puesto. |
| Moderación de comentarios | Ocultar desde denuncias | Vista de contexto del comentario denunciado. |
| Reportes | Asistencia (diario/semanal/quincenal/mensual) en Excel y PDF | Reportes de horas extra según convenio, ausentismo histórico y rotación. |
| Pruebas E2E automáticas contra Supabase real | Pendiente (no hay proyecto) | Playwright contra un proyecto de staging. |
| Tamaño del paquete inicial | ~250 kB gzip | Dividir más rutas con carga diferida. |
| Superadministración SaaS (alta de nuevas organizaciones) | Política `org_insert` para `platform_admins` | Consola de plataforma para crear clientes y su primer administrador. |

## Siguiente paso concreto

Crear el proyecto de Supabase, aplicar las migraciones y desplegar el sitio de Netlify (pasos 1 a 5), luego invitar a
2 o 3 personas de una sucursal piloto (por ejemplo Güemes) para validar fichaje, horarios y mensajería en condiciones reales.
